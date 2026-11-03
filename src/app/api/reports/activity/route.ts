import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionToken } from "@/lib/user-service";

const HISTORY_LIMIT = 200;

function toRow(docSnap: any) {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    name: d.name || "N/A",
    mobile: d.mobile || "N/A",
    pan: d.pan || "N/A",
    bureau: d.bureau || "v1",
    credit_score: d.credit_score ?? null,
    branch: d.branch || "Online",
    fetched_by_name: d.fetched_by_name || d.fetched_by?.name || "N/A",
    fetched_by_email: d.fetched_by_email || d.fetched_by?.email || "N/A",
    created_at: d.created_at ? { seconds: d.created_at._seconds } : null,
  };
}

const FIELDS = [
  "name", "mobile", "pan", "bureau", "credit_score", "branch",
  "created_at", "fetched_by", "fetched_by_name", "fetched_by_email",
];

// Admin-only. No params: employee roster with per-employee pull counts.
// ?branch=X: latest pulls for a branch. ?email=X: one employee's pull history.
export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get("credit_dashboard_session");
    const session = cookie?.value ? verifySessionToken(cookie.value) : null;
    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
    }
    if (!adminDb || typeof adminDb.collection !== "function") {
      return NextResponse.json({ success: true, employees: [], reports: [] });
    }

    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch");
    const email = searchParams.get("email");
    const reports = adminDb.collection("credit_reports");

    if (email) {
      // Equality-only query (sorted in memory) so no composite index is needed.
      const snap = await reports.where("fetched_by_email", "==", email).select(...FIELDS).limit(HISTORY_LIMIT).get();
      const rows = snap.docs.map(toRow).sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      return NextResponse.json({ success: true, reports: rows });
    }

    if (branch) {
      const snap = await reports.where("branch", "==", branch).orderBy("created_at", "desc").select(...FIELDS).limit(HISTORY_LIMIT).get();
      return NextResponse.json({ success: true, reports: snap.docs.map(toRow) });
    }

    const usersSnap = await adminDb.collection("dashboard_users").select("name", "email", "branch", "role").get();
    const users = usersSnap.docs
      .map((d: any) => d.data())
      .filter((u: any) => u.email && u.role !== "admin");
    const counts = await Promise.all(users.map((u: any) => reports.where("fetched_by_email", "==", u.email).count().get()));
    const employees = users.map((u: any, i: number) => ({
      name: u.name || u.email,
      email: u.email,
      branch: u.branch || "Online",
      count: counts[i].data().count,
    }));
    return NextResponse.json({ success: true, employees });
  } catch (err: any) {
    console.error("GET /api/reports/activity error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
