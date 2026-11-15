import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionToken } from "@/lib/user-service";
import { activityCache } from "@/lib/api-caches";
import { backendErrorStatus } from "@/lib/cibil/backendApi";
import { pullCountsByEmployee, pullHistory } from "@/lib/cibil/reportStore";

const HISTORY_LIMIT = 200;

// Admin-only. No params: employee roster with per-employee pull counts.
// ?branch=X: latest pulls for a branch. ?email=X: one employee's pull history.
export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get("credit_dashboard_session");
    const session = cookie?.value ? verifySessionToken(cookie.value) : null;
    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch");
    const email = searchParams.get("email");
    const range = { startDate: searchParams.get("startDate"), endDate: searchParams.get("endDate") };

    // Switching between list/summary or branch/employee in the Activity tab re-requests the
    // same data; serve repeats from memory. Cleared whenever a report is written or deleted.
    const cacheKey = searchParams.toString();
    const cached = activityCache.get(cacheKey);
    if (cached) return NextResponse.json({ success: true, ...cached });
    const respond = (payload: Record<string, any>) => {
      activityCache.set(cacheKey, payload);
      return NextResponse.json({ success: true, ...payload });
    };

    // ?summary=1[&branch=][&startDate=&endDate=]: pulls per employee (counts only, no rows).
    if (searchParams.get("summary") === "1") {
      return respond(await pullCountsByEmployee({ branch, ...range }));
    }

    if (email) {
      return respond({ reports: await pullHistory({ email }, range, HISTORY_LIMIT) });
    }

    if (branch) {
      return respond({ reports: await pullHistory({ branch }, range, HISTORY_LIMIT) });
    }

    // Roster: staff live in Firestore ("users" / "dashboard_users"); merge and dedupe by email.
    const byEmail = new Map<string, any>();
    if (adminDb && typeof adminDb.collection === "function") {
      const userSnaps = await Promise.all(
        ["users", "dashboard_users"].map((c) => adminDb.collection(c).select("name", "email", "branch", "role").get().catch(() => ({ docs: [] as any[] })))
      );
      userSnaps.forEach((snap: any) =>
        snap.docs.forEach((d: any) => {
          const u = d.data();
          if (u.email && u.role !== "admin" && !byEmail.has(String(u.email).toLowerCase().trim())) {
            byEmail.set(String(u.email).toLowerCase().trim(), u);
          }
        })
      );
    }
    const { counts } = await pullCountsByEmployee();
    const employees = Array.from(byEmail.entries()).map(([key, u]) => ({
      name: u.name || u.email,
      email: key,
      branch: u.branch || "Online",
      count: counts[key]?.count || 0,
    }));
    return respond({ employees });
  } catch (err: any) {
    console.error("GET /api/reports/activity error:", err);
    const status = backendErrorStatus(err);
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
