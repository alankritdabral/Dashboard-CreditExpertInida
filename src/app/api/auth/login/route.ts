import { NextRequest, NextResponse } from "next/server";
import { createSessionToken } from "@/lib/user-service";
import { ADMIN_CHALLENGE_COOKIE, isAdminEmail, issueAdminChallenge, verifyAdminChallenge } from "@/lib/adminOtp";
import { isLeadTeamMember, requestLeadTeamCode, verifyLeadTeamCode } from "@/lib/leads";

// TEMP: branch assigned to the temporary login. Change as needed.
const TEMP_BRANCH = "Delhi";

// Three calls, one endpoint:
//   { email }            -> { step: "otp" }      lead-team member: a 6-digit code was WhatsApped to their saved number
//                           { step: "password" } everyone else: ask for the (temporary) password
//   { email, otp }       -> session, for lead-team members only. Their identity comes from RDS.
//   { email, password }  -> TEMP login for everyone who is NOT on the lead team.
//
// The lead team signs in with the code only. Their session unlocks customers' phone numbers, so a
// typed-in email must never be enough. If the team cannot be loaded we do not fall back to the open
// login (that would let anyone in as a lead employee): sign-in just asks to try again.
export async function POST(req: NextRequest) {
  try {
    const { email, password, otp } = await req.json();
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json({ success: false, error: "Please enter a valid work email." }, { status: 400 });
    }

    // Admins: the full admin dashboard, behind a code emailed to the same address.
    if (isAdminEmail(cleanEmail)) {
      if (otp !== undefined) {
        if (!verifyAdminChallenge(cleanEmail, String(otp), req.cookies.get(ADMIN_CHALLENGE_COOKIE)?.value)) {
          return NextResponse.json({ success: false, error: "That code is wrong or has expired. Request a new one." }, { status: 401 });
        }
        const res = startSession({
          id: `admin_${cleanEmail}`,
          name: cleanEmail.split("@")[0],
          email: cleanEmail,
          role: "admin",
          branch: "All",
          employeeId: "ADMIN",
          status: "Active",
          createdAt: new Date().toISOString(),
        });
        res.cookies.delete(ADMIN_CHALLENGE_COOKIE);
        return res;
      }
      if (password !== undefined) {
        return NextResponse.json({ success: false, error: "Use the code sent to you to sign in." }, { status: 403 });
      }
      let challenge: string;
      try {
        challenge = await issueAdminChallenge(cleanEmail);
      } catch (err) {
        console.error("[Auth Login] Could not email the admin code:", err);
        return NextResponse.json({ success: false, error: "Could not send the code. Please try again shortly." }, { status: 503 });
      }
      const res = NextResponse.json({ success: true, step: "otp" });
      res.cookies.set({ name: ADMIN_CHALLENGE_COOKIE, value: challenge, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/login", maxAge: 600 });
      return res;
    }

    let member: boolean;
    try {
      member = await isLeadTeamMember(cleanEmail);
    } catch (err) {
      console.error("[Auth Login] Could not check the lead team:", err);
      return NextResponse.json({ success: false, error: "Sign-in is temporarily unavailable. Please try again shortly." }, { status: 503 });
    }

    if (member) {
      if (otp !== undefined) {
        const identity = await verifyLeadTeamCode(cleanEmail, String(otp)).catch(() => null);
        if (!identity) {
          return NextResponse.json({ success: false, error: "That code is wrong or has expired. Request a new one." }, { status: 401 });
        }
        return startSession({
          id: `emp_${identity.id}`,
          name: identity.name,
          email: identity.email,
          role: "branch",
          branch: identity.branch,
          employeeId: identity.hrmsId || undefined,
          status: "Active",
          createdAt: new Date().toISOString(),
        });
      }
      if (password !== undefined) {
        return NextResponse.json({ success: false, error: "Use the code sent to your WhatsApp to sign in." }, { status: 403 });
      }
      await requestLeadTeamCode(cleanEmail).catch((err) => console.error("[Auth Login] Could not send the code:", err));
      return NextResponse.json({ success: true, step: "otp" });
    }

    // Not on the lead team.
    if (password === undefined && otp === undefined) {
      return NextResponse.json({ success: true, step: "password" });
    }
    if (!password) {
      return NextResponse.json({ success: false, error: "Email and password are required." }, { status: 400 });
    }

    // TEMP: no DB read, no password check. Any other email/password logs in as a branch employee.
    // The email is kept in the session and saved with every report this employee fetches.
    return startSession({
      id: `tmp_${cleanEmail}`,
      name: cleanEmail.split("@")[0],
      email: cleanEmail,
      role: "branch",
      branch: TEMP_BRANCH,
      employeeId: "TEMP-001",
      status: "Active",
      createdAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Login API error:", err);
    return NextResponse.json({ success: false, error: err.message || "Internal server error" }, { status: 500 });
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
