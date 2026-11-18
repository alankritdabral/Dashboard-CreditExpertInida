import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, getUserByEmail } from "@/lib/user-service";
import { verifyPassword } from "@/lib/password";
import { listLeadEmployees } from "@/lib/leads";

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

    // The lead team (people who are given customers automatically) must sign in for real: their
    // session unlocks customers' phone numbers, so a typed-in email alone is not enough.
    // Everyone else still uses the temporary login below.
    let leadTeamEmails: Set<string>;
    try {
      leadTeamEmails = new Set((await listLeadEmployees()).map((e) => e.email.toLowerCase()));
    } catch (err) {
      // Cannot tell whether this email is on the lead team, so do not fall back to the open login.
      console.error("[Auth Login] Could not load the lead team:", err);
      return NextResponse.json({ success: false, error: "Sign-in is temporarily unavailable. Please try again shortly." }, { status: 503 });
    }

    if (leadTeamEmails.has(cleanEmail.toLowerCase())) {
      const account = await getUserByEmail(cleanEmail);
      const typed = typeof password === "string" ? password : String(password);
      if (!account) {
        return NextResponse.json(
          { success: false, error: "Your account is not set up yet. Ask the administrator to create it." },
          { status: 401 }
        );
      }
      if (!verifyPassword(typed, account.password) && !verifyPassword(typed.trim(), account.password)) {
        return NextResponse.json({ success: false, error: "Invalid work email or password." }, { status: 401 });
      }
      if (account.status !== "Active") {
        return NextResponse.json({ success: false, error: "This account has been suspended. Contact Administrator." }, { status: 403 });
      }
      return startSession(account);
    }

    // TEMP: no DB read, no password check. Any other email/password logs in as a branch employee.
    // The email is kept in the session and saved with every report this employee fetches.
    return startSession({
      id: `tmp_${cleanEmail.toLowerCase()}`,
      name: cleanEmail.split("@")[0],
      email: cleanEmail.toLowerCase(),
      role: "branch" as const,
      branch: TEMP_BRANCH,
      employeeId: "TEMP-001",
      status: "Active",
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

function startSession(user: { id: string; name: string; email: string; role: "admin" | "branch"; branch: string; employeeId?: string; status: string; createdAt: string }) {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const sessionToken = createSessionToken({
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    branch: user.branch,
    employeeId: user.employeeId,
    createdAt: Date.now(),
    expiresAt,
  });

  const response = NextResponse.json({
    success: true,
    message: "Authentication successful.",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch: user.branch,
      employeeId: user.employeeId,
      status: user.status,
      createdAt: user.createdAt,
    },
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
}
