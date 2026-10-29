import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, updateUserPassword } from "@/lib/user-service";
import {
  isPasswordResetOtpVerified,
  clearPasswordResetOtp,
  sendPasswordChangedEmail,
} from "@/lib/email-service";

export async function POST(req: NextRequest) {
  try {
    const { email, newPassword, confirmPassword } = await req.json();

    if (!email || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Email and new password are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!isPasswordResetOtpVerified(normalizedEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: "Verification expired or invalid. Please verify the 6-digit code first.",
        },
        { status: 403 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "New password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: "New password and confirmation do not match." },
        { status: 400 }
      );
    }

    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User account could not be found." },
        { status: 404 }
      );
    }

    await updateUserPassword(normalizedEmail, newPassword);
    clearPasswordResetOtp(normalizedEmail);

    // Send confirmation email asynchronously
    sendPasswordChangedEmail(normalizedEmail, user.name).catch((e) =>
      console.warn("Notice email error:", e)
    );

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You may now sign in with your new credentials.",
    });
  } catch (err: any) {
    console.error("reset password error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update password." },
      { status: 500 }
    );
  }
}
