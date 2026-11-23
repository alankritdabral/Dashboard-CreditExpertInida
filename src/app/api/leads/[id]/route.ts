import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";
import { assignLead, deleteLeads, EMPLOYMENT_TYPES, LeadError, LEAD_STATUSES, updateLeadNotes, LeadStatus, listLeadEmployees, normalizeEmail, resendWelcome, updateLeadStatus } from "@/lib/leads";

// PATCH { assignTo: email | null }  — admin only; one employee per lead.
// PATCH { status }                   — admin, or the employee the lead is assigned to.
// PATCH { employmentType | customerRequirement | remarks } — admin, or the assignee.
// PATCH { resendWelcome: true }      — send the "your advisor is ..." WhatsApp message again; admin or the assignee.
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
        const team = await listLeadEmployees();
        const u = team.find((x) => normalizeEmail(x.email) === email && x.active);
        if (!u) {
          return NextResponse.json({ success: false, error: "Employee is not on the active lead team" }, { status: 400 });
        }
        employee = { email, name: u.name };
      }
      const lead = await assignLead(id, employee, normalizeEmail(session.email));
      return NextResponse.json({ success: true, lead });
    }

    if (body.resendWelcome === true) {
      const lead = await resendWelcome(id, session);
      return NextResponse.json({ success: true, lead });
    }

    if (body.status) {
      if (!LEAD_STATUSES.includes(body.status)) {
        return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
      }
      const lead = await updateLeadStatus(id, body.status as LeadStatus, session);
      return NextResponse.json({ success: true, lead });
    }

    if ("employmentType" in body || "customerRequirement" in body || "remarks" in body) {
      const notes: { employmentType?: (typeof EMPLOYMENT_TYPES)[number] | null; customerRequirement?: string | null; remarks?: string | null } = {};
      if ("employmentType" in body) {
        if (body.employmentType !== null && !EMPLOYMENT_TYPES.includes(body.employmentType)) {
          return NextResponse.json({ success: false, error: "Invalid employment type" }, { status: 400 });
        }
        notes.employmentType = body.employmentType;
      }
      if ("customerRequirement" in body) notes.customerRequirement = String(body.customerRequirement ?? "").slice(0, 500);
      if ("remarks" in body) notes.remarks = String(body.remarks ?? "").slice(0, 2000);
      const lead = await updateLeadNotes(id, notes, session);
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

// DELETE — admin only. Removes the customer's enquiries; credit reports stay.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookie = req.cookies.get("credit_dashboard_session");
  const session = cookie?.value ? verifySessionToken(cookie.value) : null;
  if (!session || session.role !== "admin") {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const deleted = await deleteLeads([id]);
    return NextResponse.json({ success: true, deleted });
  } catch (err: any) {
    if (err instanceof LeadError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.httpStatus });
    }
    console.error("DELETE /api/leads/[id] error:", err);
    return NextResponse.json({ success: false, error: "Could not delete lead" }, { status: 500 });
  }
}
