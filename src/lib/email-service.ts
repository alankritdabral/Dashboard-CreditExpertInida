import nodemailer from "nodemailer";

interface OtpEntry {
  otp: string;
  expiresAt: number;
  attempts: number;
  verified: boolean;
}

const otpStore = new Map<string, OtpEntry>();
const MAX_ATTEMPTS = 5;

function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

export function isLocalhost(): boolean {
  return process.env.NODE_ENV !== "production";
}

export async function sendPasswordResetOtp(
  email: string,
  userName: string
): Promise<{ success: boolean; message: string; devOtp?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  otpStore.set(normalizedEmail, {
    otp: code,
    expiresAt,
    attempts: 0,
    verified: false,
  });

  const transporter = getTransporter();
  const fromAddress = process.env.SMTP_FROM || `"Credit Expert India Security" <security@creditexpertindia.com>`;
  const subject = `Your Password Reset Code: ${code} - Credit Expert India`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #2563eb; margin: 0; font-size: 24px;">Credit Expert India</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Staff & Admin Portal Security Verification</p>
      </div>
      <div style="padding: 24px; background-color: #f8fafc; border-radius: 8px; margin-bottom: 20px;">
        <p style="color: #334155; font-size: 15px; margin: 0 0 12px 0;">Hello <strong>${userName}</strong>,</p>
        <p style="color: #475569; font-size: 14px; margin: 0 0 20px 0;">
          A password reset was requested for your Credit Expert India Dashboard account (${normalizedEmail}).
          Use the 6-digit verification code below to authorize this change:
        </p>
        <div style="text-align: center; padding: 18px; background-color: #ffffff; border: 2px dashed #93c5fd; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #2563eb; font-family: monospace;">${code}</span>
        </div>
        <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
          This verification code is strictly valid for 10 minutes. Do not disclose this code to anyone.
        </p>
      </div>
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        &copy; ${new Date().getFullYear()} Credit Expert India. Secure Authorized Workplace Access.
      </p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        to: normalizedEmail,
        subject,
        html: htmlContent,
      });

      console.log(`[SMTP] Reset OTP dispatched to ${normalizedEmail}`);
      return {
        success: true,
        message: `A 6-digit verification code has been dispatched to ${normalizedEmail}.`,
        devOtp: isLocalhost() ? code : undefined,
      };
    } catch (smtpErr: any) {
      console.warn("[SMTP Error] Falling back to console output:", smtpErr.message);
      if (isLocalhost()) {
        console.log(`\n==================================================`);
        console.log(`🔐 [DEV DASHBOARD RESET OTP] Email: ${normalizedEmail}`);
        console.log(`🔐 [DEV DASHBOARD RESET OTP] Code:  ${code} (Valid for 10m)`);
        console.log(`==================================================\n`);
      }
      return {
        success: true,
        message: `Verification code generated (SMTP note: ${smtpErr.message}).`,
        devOtp: isLocalhost() ? code : undefined,
      };
    }
  }

  // Fallback for environment without SMTP configuration
  console.log(`\n==================================================`);
  console.log(`🔐 [DEV DASHBOARD RESET OTP] Email: ${normalizedEmail}`);
  console.log(`🔐 [DEV DASHBOARD RESET OTP] Code:  ${code} (Valid for 10m)`);
  console.log(`==================================================\n`);

  return {
    success: true,
    message: `Verification code generated. (Check server logs).`,
    devOtp: isLocalhost() ? code : undefined,
  };
}

export async function verifyPasswordResetOtp(
  email: string,
  submittedOtp: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const record = otpStore.get(normalizedEmail);

  if (!record) {
    return {
      success: false,
      error: "No active password reset request found for this email. Please request a new code.",
    };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalizedEmail);
    return {
      success: false,
      error: "Verification code has expired. Please request a new one.",
    };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(normalizedEmail);
    return {
      success: false,
      error: "Maximum verification attempts exceeded. Please request a new code.",
    };
  }

  record.attempts += 1;

  if (record.otp !== submittedOtp.trim()) {
    const remaining = MAX_ATTEMPTS - record.attempts;
    return {
      success: false,
      error: `Invalid verification code. ${remaining} attempt(s) remaining.`,
    };
  }

  record.verified = true;
  return { success: true };
}

export function isPasswordResetOtpVerified(email: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  const record = otpStore.get(normalizedEmail);
  return Boolean(record && record.verified && Date.now() <= record.expiresAt + 15 * 60 * 1000);
}

export function clearPasswordResetOtp(email: string): void {
  const normalizedEmail = email.toLowerCase().trim();
  otpStore.delete(normalizedEmail);
}

export async function sendPasswordChangedEmail(email: string, userName: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const transporter = getTransporter();
  const fromAddress = process.env.SMTP_FROM || `"Credit Expert India Security" <security@creditexpertindia.com>`;
  const subject = `Security Notice: Your Dashboard Password Was Updated`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h3 style="color: #059669; margin: 0 0 12px 0;">Password Reset Confirmed</h3>
      <p style="color: #334155; font-size: 14px;">Hello ${userName},</p>
      <p style="color: #475569; font-size: 14px;">
        Your password for the Credit Expert India Dashboard was successfully reset on <strong>${new Date().toLocaleString()}</strong>.
      </p>
      <p style="color: #dc2626; font-size: 13px; font-weight: bold;">
        If you did NOT perform this action, please contact executive administration immediately.
      </p>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        to: normalizedEmail,
        subject,
        html: htmlContent,
      });
      return true;
    } catch (e) {
      console.error("Failed to send confirmation email:", e);
    }
  }

  return true;
}
