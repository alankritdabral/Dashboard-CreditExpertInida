import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";
import { bulkAssignEvenly, deleteLeads, LeadError, listLeadEmployees, normalizeEmail } from "@/lib/leads";

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
    // Only the active lead team can be given leads (they have a phone number for the WhatsApp).
    const team = await listLeadEmployees();
    const employees = team
      .filter((e) => e.active && wanted.has(normalizeEmail(e.email)))
      .map((e) => ({ email: normalizeEmail(e.email), name: e.name }));
    if (employees.length !== wanted.size) {
      return NextResponse.json({ success: false, error: "An employee is not on the active lead team" }, { status: 400 });
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

// DELETE { leadIds: string[] } — admin only. Removes the customers' enquiries; credit reports stay.
export async function DELETE(req: NextRequest) {
  const cookie = req.cookies.get("credit_dashboard_session");
  const session = cookie?.value ? verifySessionToken(cookie.value) : null;
  if (!session || session.role !== "admin") {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }
  try {
    const { leadIds } = await req.json().catch(() => ({}));
    if (!Array.isArray(leadIds) || !leadIds.length) {
      return NextResponse.json({ success: false, error: "leadIds is required" }, { status: 400 });
    }
    const deleted = await deleteLeads(leadIds.map(String));
    return NextResponse.json({ success: true, deleted });
  } catch (err: any) {
    if (err instanceof LeadError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.httpStatus });
    }
    console.error("DELETE /api/leads/bulk error:", err);
    return NextResponse.json({ success: false, error: "Could not delete leads" }, { status: 500 });
  }
}
