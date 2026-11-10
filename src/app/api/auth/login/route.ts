import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/user-service";

// TEMP: branch assigned to the temporary login. Change as needed.
const TEMP_BRANCH = "Delhi";

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

    // TEMP: no DB read, no password check. Any email/password logs in as a branch employee.
    // The email is kept in the session and saved with every report this employee fetches.
    const user = {
      id: `tmp_${cleanEmail.toLowerCase()}`,
      name: cleanEmail.split("@")[0],
      email: cleanEmail.toLowerCase(),
      role: "branch" as const,
      branch: TEMP_BRANCH,
      employeeId: "TEMP-001",
      status: "Active",
      createdAt: new Date().toISOString(),
    };

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
