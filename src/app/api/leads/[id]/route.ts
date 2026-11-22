import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";
import { assignLead, deleteLeads, getLead, isLeadManager, LeadError, LEAD_STATUSES, LeadStatus, listLeadEmployees, normalizeEmail, resendWelcome, updateLeadStatus } from "@/lib/leads";

// PATCH { assignTo: email | null }  — admin, or a branch manager for a lead in their branch and an employee of that branch.
//                                      One employee per lead. Unassigning (null) is admin only.
// PATCH { status }                   — admin, or the employee the lead is assigned to.
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
      const manager = isLeadManager(session);
      if (session.role !== "admin" && !manager) {
        return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
      }
      if (manager) {
        if (!body.assignTo) {
          return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
        }
        // The lead must be one this manager can see (their branch's, or nobody's yet).
        if (!(await getLead(id, session))) {
          return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
        }
      }
      let employee: { email: string; name: string } | null = null;
      if (body.assignTo) {
        const email = normalizeEmail(body.assignTo);
        const team = await listLeadEmployees();
        const u = team.find((x) => normalizeEmail(x.email) === email && x.active);
        if (!u) {
          return NextResponse.json({ success: false, error: "Employee is not on the active lead team" }, { status: 400 });
        }
        if (manager && u.branch !== session.branch) {
          return NextResponse.json({ success: false, error: "You can only assign to your own branch" }, { status: 403 });
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
