import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, createSessionToken } from "@/lib/user-service";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim();
    const cleanPassword = typeof password === "string" ? password.trim() : password;

    const user = await getUserByEmail(cleanEmail);

    if (!user) {
      console.warn(`[Auth Login] User not found for email: "${cleanEmail}"`);
      return NextResponse.json(
        { success: false, error: "Invalid work email or password." },
        { status: 401 }
      );
    }

    if (user.password !== password && user.password !== cleanPassword) {
      console.warn(`[Auth Login] Password mismatch for email: "${cleanEmail}". Default password is Password@123`);
      return NextResponse.json(
        { success: false, error: "Invalid work email or password." },
        { status: 401 }
      );
    }

    if (user.status !== "Active") {
      return NextResponse.json(
        { success: false, error: "This account has been suspended. Contact Administrator." },
        { status: 403 }
      );
    }

    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const sessionToken = createSessionToken({
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branch: user.branch,
      createdAt: Date.now(),
      expiresAt,
    });

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch: user.branch,
      employeeId: user.employeeId,
      status: user.status,
      createdAt: user.createdAt,
    };

    const response = NextResponse.json({
      success: true,
      message: "Authentication successful.",
      user: userPayload,
    });

    response.cookies.set({
      name: "credit_dashboard_session",
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(expiresAt),
    });

    return response;
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
