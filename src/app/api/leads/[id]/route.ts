import { NextRequest, NextResponse } from "next/server";
import { getAllBranchUsers, verifySessionToken } from "@/lib/user-service";
import { assignLead, LeadError, LEAD_STATUSES, LeadStatus, normalizeEmail, updateLeadStatus } from "@/lib/leads";

// PATCH { assignTo: email | null }  — admin only; one employee per lead.
// PATCH { status }                   — admin, or the employee the lead is assigned to.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookie = req.cookies.get("credit_dashboard_session");
  const session = cookie?.value ? verifySessionToken(cookie.value) : null;
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    if ("assignTo" in body) {
      if (session.role !== "admin") {
        return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
      }
      let employee: { email: string; name: string } | null = null;
      if (body.assignTo) {
        const email = normalizeEmail(body.assignTo);
        const users = await getAllBranchUsers();
        const u = users.find((x) => normalizeEmail(x.email) === email && x.role !== "admin");
        if (!u || u.status === "Suspended") {
          return NextResponse.json({ success: false, error: "Employee not found or suspended" }, { status: 400 });
        }
        employee = { email, name: u.name };
      }
      const lead = await assignLead(id, employee, normalizeEmail(session.email));
      return NextResponse.json({ success: true, lead });
    }

    if (body.status) {
      if (!LEAD_STATUSES.includes(body.status)) {
        return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
      }
      const lead = await updateLeadStatus(id, body.status as LeadStatus, session);
      return NextResponse.json({ success: true, lead });
    }

    return NextResponse.json({ success: false, error: "Nothing to update" }, { status: 400 });
  } catch (err: any) {
    if (err instanceof LeadError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.httpStatus });
    }
    console.error("PATCH /api/leads/[id] error:", err);
    return NextResponse.json({ success: false, error: "Could not update lead" }, { status: 500 });
  }
}
