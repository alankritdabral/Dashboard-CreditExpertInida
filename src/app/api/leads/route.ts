import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";
import { listLeads } from "@/lib/leads";

// Admin: every lead. Employee: only leads assigned to them.
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("credit_dashboard_session");
  const session = cookie?.value ? verifySessionToken(cookie.value) : null;
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }
  try {
    return NextResponse.json({ success: true, leads: await listLeads(session) });
  } catch (err: any) {
    console.error("GET /api/leads error:", err);
    return NextResponse.json({ success: false, error: "Could not load leads" }, { status: 500 });
  }
}
