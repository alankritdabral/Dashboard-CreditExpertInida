import crypto from "crypto";
import { getTransporter } from "@/lib/email-service";
import { sendWhatsappOtp } from "@/lib/messagebotWhatsapp";

// Admin sign-in: an allow-listed email gets the full admin dashboard, but only after a 6-digit code
// sent by WhatsApp (email as fallback). The code is not stored on the server (serverless instances do not
// share memory): a signed, httpOnly challenge cookie carries a hash of it, and verify recomputes it.
const SECRET = process.env.ENCRYPTION_SECRET || "credit-expert-dashboard-secret-32-bytes!";
const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
export const ADMIN_CHALLENGE_COOKIE = "credit_admin_otp";

export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || "alankrit.dabral@creditexpertindia.com";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().includes(email.trim().toLowerCase());
}

const mac = (email: string, code: string, exp: number) =>
  crypto.createHmac("sha256", SECRET).update(`${email}|${code}|${exp}`).digest("hex");

// Best-effort per-instance brake on guessing; the 10 minute expiry is the hard limit.
const attempts = new Map<string, number>();

export async function issueAdminChallenge(email: string): Promise<string> {
  const code = crypto.randomInt(100000, 1000000).toString();
  const exp = Date.now() + TTL_MS;
  attempts.delete(email);

  // WhatsApp first (ADMIN_OTP_PHONE, template ADMIN_OTP_WHATSAPP_TEMPLATE_ID = the approved
  // employee7otpv1 template, MessageBot id 160). Email is the fallback if that send fails.
  const phone = process.env.ADMIN_OTP_PHONE || "9105567268";
  const wa = await sendWhatsappOtp({ phoneNumber: phone, otpCode: code, templateId: process.env.ADMIN_OTP_WHATSAPP_TEMPLATE_ID || "160" });
  if (!wa.success) console.error("[Admin login] WhatsApp send failed, trying email:", wa.error);

  const transporter = wa.success ? null : getTransporter();
  if (!wa.success && transporter) {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Credit Expert India Security" <security@creditexpertindia.com>`,
      to: email,
      subject: `Your admin sign-in code: ${code}`,
      text: `Your Credit Expert India admin sign-in code is ${code}. It is valid for 10 minutes. If you did not try to sign in, ignore this email.`,
    });
  } else if (wa.success) {
    // delivered on WhatsApp
  } else if (process.env.NODE_ENV !== "production") {
    console.log(`[Admin login] code for ${email}: ${code}`);
  } else {
    throw new Error("Email is not configured");
  }

  const payload = Buffer.from(JSON.stringify({ email, exp, h: mac(email, code, exp) })).toString("base64");
  return `${payload}.${crypto.createHmac("sha256", SECRET).update(payload).digest("hex")}`;
}

export function verifyAdminChallenge(email: string, code: string, cookie: string | undefined): boolean {
  try {
    if (!cookie) return false;
    const [payload, sig] = cookie.split(".");
    const good = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    if (!sig || sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
    const { email: e, exp, h } = JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
    if (e !== email || Date.now() > exp) return false;
    const n = (attempts.get(email) || 0) + 1;
    attempts.set(email, n);
    if (n > MAX_ATTEMPTS) return false;
    const want = mac(email, String(code).trim(), exp);
    const ok = want.length === h.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(h));
    if (ok) attempts.delete(email);
    return ok;
  } catch {
    return false;
  }
}
