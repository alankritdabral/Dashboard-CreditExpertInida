import { NextRequest, NextResponse } from "next/server";
import { verifyPasswordResetOtp } from "@/lib/email-service";

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: "Email and 6-digit verification code are required." },
        { status: 400 }
      );
    }

    const verification = await verifyPasswordResetOtp(email, otp);

    if (!verification.success) {
      return NextResponse.json(
        { success: false, error: verification.error || "Invalid verification code." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code confirmed successfully. Please enter your new password.",
    });
  } catch (err: any) {
    console.error("verify-otp error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to verify code." },
      { status: 500 }
    );
  }
}
