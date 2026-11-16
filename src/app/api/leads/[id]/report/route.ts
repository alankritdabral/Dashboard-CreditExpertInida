import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";
import { backendErrorStatus } from "@/lib/cibil/backendApi";
import { getReport } from "@/lib/cibil/reportStore";
import { listLeads } from "@/lib/leads";

// GET ?reportId=…  — a credit report belonging to this customer (lead).
// Admin: any customer. Employee: only a customer assigned to them, and only a report that is
// attached to that customer (same phone number), never an arbitrary report id.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookie = req.cookies.get("credit_dashboard_session");
  const session = cookie?.value ? verifySessionToken(cookie.value) : null;
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const reportId = req.nextUrl.searchParams.get("reportId") || "";
    const leads = await listLeads(session); // already scoped to what this person may see
    const lead = leads.find((l) => l.id === id);
    if (!lead || !lead.reports.some((r) => r.id === reportId)) {
      return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
    }
    const report = await getReport(reportId);
    if (!report) {
      return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    console.error("GET /api/leads/[id]/report error:", err);
    return NextResponse.json({ success: false, error: "Could not load the report" }, { status: backendErrorStatus(err) });
  }
}
