import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";
import { isLeadManager, retryUnassigned } from "@/lib/leads";

// POST — try again to give every waiting lead an owner. Admin or a branch manager.
// (The backend also does this every 5 minutes, and whenever a team setting or a city rule changes.)
export async function POST(req: NextRequest) {
  const cookie = req.cookies.get("credit_dashboard_session");
  const session = cookie?.value ? verifySessionToken(cookie.value) : null;
  if (!session) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  if (session.role !== "admin" && !isLeadManager(session)) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }
  try {
    return NextResponse.json({ success: true, result: await retryUnassigned() });
  } catch (err) {
    console.error("POST /api/leads/retry error:", err);
    return NextResponse.json({ success: false, error: "Could not retry assignment" }, { status: 500 });
  }
}
