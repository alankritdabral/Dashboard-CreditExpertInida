import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";
import { reportsListCache, activityCache } from "@/lib/api-caches";
import { backendErrorStatus } from "@/lib/cibil/backendApi";
import { deleteReport, getReport } from "@/lib/cibil/reportStore";

const errorStatus = backendErrorStatus;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionCookie = req.cookies.get("credit_dashboard_session");
    const session = sessionCookie?.value ? verifySessionToken(sessionCookie.value) : null;
    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });
    }

    const report = await getReport(id);
    if (!report) {
      return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
    }

    // Branch users (employees) may only open reports they fetched themselves.
    // Same 404 as a missing report so IDs can't be probed.
    if (session.role !== "admin") {
      const owner = String(report.fetched_by_email || "").trim().toLowerCase();
      if (!owner || owner === "n/a" || owner !== String(session.email || "").trim().toLowerCase()) {
        return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    console.error("GET /api/reports/[id] error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: errorStatus(err) });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookie = req.cookies.get("credit_dashboard_session");
    const session = cookie?.value ? verifySessionToken(cookie.value) : null;

    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });
    }

    // The backend removes the dashboard record and the credit report it created.
    await deleteReport(id);
    reportsListCache.clear();
    activityCache.clear();

    return NextResponse.json({ success: true, message: "Report deleted successfully" });
  } catch (err: any) {
    console.error("DELETE /api/reports/[id] error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: errorStatus(err) });
  }
}
