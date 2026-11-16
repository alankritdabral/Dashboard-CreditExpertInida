import { NextRequest, NextResponse } from "next/server";
import { getAllBranchUsers, verifySessionToken } from "@/lib/user-service";
import { bulkAssignEvenly, LeadError, normalizeEmail } from "@/lib/leads";

// Admin only. POST { leadIds: string[], employeeEmails: string[] } -> spread evenly.
export async function POST(req: NextRequest) {
  const cookie = req.cookies.get("credit_dashboard_session");
  const session = cookie?.value ? verifySessionToken(cookie.value) : null;
  if (!session || session.role !== "admin") {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }
  try {
    const { leadIds, employeeEmails } = await req.json();
    if (!Array.isArray(leadIds) || !Array.isArray(employeeEmails)) {
      return NextResponse.json({ success: false, error: "leadIds and employeeEmails are required" }, { status: 400 });
    }
    const wanted = new Set(employeeEmails.map(normalizeEmail));
    const users = await getAllBranchUsers();
    const employees = users
      .filter((u) => u.role !== "admin" && u.status !== "Suspended" && wanted.has(normalizeEmail(u.email)))
      .map((u) => ({ email: normalizeEmail(u.email), name: u.name }));
    if (employees.length !== wanted.size) {
      return NextResponse.json({ success: false, error: "An employee was not found or is suspended" }, { status: 400 });
    }
    const result = await bulkAssignEvenly(leadIds.map(String), employees, normalizeEmail(session.email));
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    if (err instanceof LeadError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.httpStatus });
    }
    console.error("POST /api/leads/bulk error:", err);
    return NextResponse.json({ success: false, error: "Could not assign leads" }, { status: 500 });
  }
}
