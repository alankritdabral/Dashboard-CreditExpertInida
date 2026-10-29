import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/user-service";
import { sendPasswordResetOtp } from "@/lib/email-service";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid work email address." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await getUserByEmail(normalizedEmail);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "No account found registered with this email address." },
        { status: 404 }
      );
    }

    if (user.status !== "Active") {
      return NextResponse.json(
        { success: false, error: "This account is inactive. Please contact administration." },
        { status: 403 }
      );
    }

    const result = await sendPasswordResetOtp(normalizedEmail, user.name);

    return NextResponse.json({
      success: true,
      message: result.message,
      devOtp: result.devOtp,
    });
  } catch (err: any) {
    console.error("send-otp route error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to dispatch verification code." },
      { status: 500 }
    );
  }
}
