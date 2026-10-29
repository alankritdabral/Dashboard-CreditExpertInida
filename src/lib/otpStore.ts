import crypto from "crypto";
import dns from "dns";

// Ensure Node.js prioritizes IPv4 over IPv6
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Ignore in environments where this method is unavailable
}

interface OtpRecord {
  otp: string;
  attempts: number;
  createdAt: number;
}

// In-memory instant store with fallback
const memoryStore = new Map<string, { record: OtpRecord; expiresAt: number }>();
const cooldownStore = new Map<string, number>();

// Clean up expired items from memoryStore periodically
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
      if (value.expiresAt <= now) {
        memoryStore.delete(key);
      }
    }
    for (const [key, timestamp] of cooldownStore.entries()) {
      if (timestamp <= now) {
        cooldownStore.delete(key);
      }
    }
  }, 60000);
  cleanupTimer.unref?.();
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return { url, token };
}

async function runRedisCommand(command: (string | number)[]): Promise<any> {
  const { url, token } = getRedisConfig();
  if (!url || !token) {
    return null;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(1500), // Fast 1.5s timeout to prevent stalling
    });

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return json.result;
  } catch {
    // Graceful silent fallback to memory store
    return null;
  }
}

/**
 * Generate cryptographically secure numeric OTP
 */
export function generateOtp(length = 4): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const num = crypto.randomInt(min, max + 1);
  return num.toString();
}

/**
 * Check if a mobile number is allowed to request a new OTP (rate limit: 30s cooldown)
 */
export async function canRequestOtp(mobile: string, cooldownSeconds = 30): Promise<{ allowed: boolean; waitSeconds?: number }> {
  const cleanMobile = mobile.replace(/\D/g, "").slice(-10);
  const now = Date.now();

  // 1. Check local fast memory cooldown first (0ms)
  const memCooldown = cooldownStore.get(cleanMobile);
  if (memCooldown && memCooldown > now) {
    const waitSeconds = Math.ceil((memCooldown - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // 2. Check Redis for multi-instance deployments
  const cooldownKey = `otp_cooldown:${cleanMobile}`;
  const redisResult = await runRedisCommand(["TTL", cooldownKey]);
  if (typeof redisResult === "number" && redisResult > 0) {
    return { allowed: false, waitSeconds: redisResult };
  }

  return { allowed: true };
}

/**
 * Store an OTP with an expiration time (default 10 minutes)
 */
export async function storeOtp(
  mobile: string,
  otp: string,
  ttlSeconds = 600,
  cooldownSeconds = 30
): Promise<void> {
  const cleanMobile = mobile.replace(/\D/g, "").slice(-10);
  const otpKey = `otp:${cleanMobile}`;
  const cooldownKey = `otp_cooldown:${cleanMobile}`;
  const record: OtpRecord = {
    otp,
    attempts: 0,
    createdAt: Date.now(),
  };

  const now = Date.now();
  // 1. Instantly store in memory store (synchronous, 0 latency, immune to Redis network issues)
  memoryStore.set(cleanMobile, {
    record,
    expiresAt: now + ttlSeconds * 1000,
  });
  cooldownStore.set(cleanMobile, now + cooldownSeconds * 1000);

  // 2. Synchronize to Redis in background with short timeout
  runRedisCommand(["SET", otpKey, JSON.stringify(record), "EX", ttlSeconds]).catch(() => {});
  runRedisCommand(["SET", cooldownKey, "1", "EX", cooldownSeconds]).catch(() => {});
}

/**
 * Verify an OTP entered by the user
 */
export async function verifyStoredOtp(
  mobile: string,
  enteredOtp: string
): Promise<{ success: boolean; error?: string }> {
  const cleanMobile = mobile.replace(/\D/g, "").slice(-10);
  const otpKey = `otp:${cleanMobile}`;

  // Allow bypass OTP in development/test if configured
  const devBypassOtp = process.env.OTP_DEV_BYPASS;
  if (devBypassOtp && enteredOtp.trim() === devBypassOtp.trim()) {
    return { success: true };
  }

  // 1. Check local memory store first (instant)
  let record: OtpRecord | null = null;
  const memEntry = memoryStore.get(cleanMobile);
  if (memEntry && memEntry.expiresAt > Date.now()) {
    record = memEntry.record;
  }

  // 2. If not found in memory, query Redis
  if (!record) {
    const redisVal = await runRedisCommand(["GET", otpKey]);
    if (redisVal) {
      try {
        record = typeof redisVal === "string" ? JSON.parse(redisVal) : redisVal;
      } catch (e) {
        console.error("[OtpStore] Failed to parse Redis OTP record", e);
      }
    }
  }

  if (!record) {
    return {
      success: false,
      error: "OTP has expired or was not requested. Please request a new code.",
    };
  }

  // Check attempt limit
  if (record.attempts >= 5) {
    // Delete OTP
    runRedisCommand(["DEL", otpKey]).catch(() => {});
    memoryStore.delete(cleanMobile);
    return {
      success: false,
      error: "Too many incorrect attempts. Please request a new verification code.",
    };
  }

  // Compare OTP
  if (record.otp.trim() !== enteredOtp.trim()) {
    record.attempts += 1;
    // Update attempts in memory and Redis
    const memEntry = memoryStore.get(cleanMobile);
    if (memEntry) {
      memEntry.record.attempts = record.attempts;
    }
    runRedisCommand(["SET", otpKey, JSON.stringify(record), "KEEPTTL"]).catch(() => {});

    const remaining = 5 - record.attempts;
    return {
      success: false,
      error: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
    };
  }

  // Success! Invalidate OTP to prevent replay
  runRedisCommand(["DEL", otpKey]).catch(() => {});
  memoryStore.delete(cleanMobile);

  // Set verified flag for 15 minutes (900 seconds)
  const verifiedKey = `otp_verified:${cleanMobile}`;
  runRedisCommand(["SET", verifiedKey, "1", "EX", 900]).catch(() => {});

  return { success: true };
}
