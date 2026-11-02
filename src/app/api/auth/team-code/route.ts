import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { createSessionToken } from "@/lib/user-service";

const BRANCH_CODE_IDS = ["rudrapur", "delhi", "dehradun"] as const;

// Daily access-code login for branch teams. Code is rotated by /api/cron/rotate-codes.
export async function POST(req: NextRequest) {
  try {
    const { branch, code } = await req.json();
    const branchId = typeof branch === "string" ? branch.toLowerCase() : "";

    if (!BRANCH_CODE_IDS.includes(branchId as (typeof BRANCH_CODE_IDS)[number]) || !code) {
      return NextResponse.json(
        { success: false, error: "Please select a branch and enter the daily access code." },
        { status: 400 }
      );
    }

    const docSnap = await adminDb.collection("access_code_creditexpert").doc(branchId).get();
    if (!docSnap.exists) {
      return NextResponse.json(
        { success: false, error: "Access code not configured for this branch." },
        { status: 400 }
      );
    }
    if (docSnap.data()?.code !== String(code).trim()) {
      return NextResponse.json(
        { success: false, error: "Invalid daily access code." },
        { status: 401 }
      );
    }

    const branchName = branchId.charAt(0).toUpperCase() + branchId.slice(1);

    // Session lasts until the next 12:00 AM IST, when the code rotates.
    const IST_OFFSET_MS = (5 * 60 + 30) * 60000;
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    nowIST.setUTCDate(nowIST.getUTCDate() + 1);
    nowIST.setUTCHours(0, 0, 0, 0);
    const expiresAt = nowIST.getTime() - IST_OFFSET_MS;

    const user = {
      id: `code_${branchId}`,
      name: `${branchName} Branch Team`,
      email: `${branchId}@access-code.creditexpertindia.com`,
      role: "branch" as const,
      branch: branchName,
      employeeId: `CODE-${branchId.toUpperCase()}`,
      status: "Active" as const,
      createdAt: new Date().toISOString(),
    };

    const token = createSessionToken({
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branch: user.branch,
      createdAt: Date.now(),
      expiresAt,
    });

    const response = NextResponse.json({ success: true, user });
    response.cookies.set({
      name: "credit_dashboard_session",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(expiresAt),
    });
    return response;
  } catch (err) {
    console.error("Team code login error:", err);
    return NextResponse.json({ success: false, error: "An internal error occurred." }, { status: 500 });
  }
}
