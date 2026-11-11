import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionToken } from "@/lib/user-service";
import { activityCache } from "@/lib/api-caches";

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

    // Switching between list/summary or branch/employee in the Activity tab re-requests the
    // same data; serve repeats from memory. Cleared whenever a report is written or deleted.
    const cacheKey = searchParams.toString();
    const cached = activityCache.get(cacheKey);
    if (cached) return NextResponse.json({ success: true, ...cached });
    const respond = (payload: Record<string, any>) => {
      activityCache.set(cacheKey, payload);
      return NextResponse.json({ success: true, ...payload });
    };

    const spellings = (v: string, extra: string[] = []) => {
      const t = v.trim();
      return Array.from(new Set([t, t.toLowerCase(), t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(), ...extra]));
    };
    const startMs = Date.parse(searchParams.get("startDate") || "");
    const endMs = Date.parse(searchParams.get("endDate") || "");
    // History rows: let Firestore apply the date range, ordering and limit so only the
    // HISTORY_LIMIT newest docs are read. Needs the composite index <field> ASC + created_at DESC
    // (firestore.indexes.json). If it isn't deployed yet (FAILED_PRECONDITION) fall back to
    // reading every doc for the branch/employee and filtering in memory.
    const byField = async (field: string, values: string[]) => {
      try {
        let q: any = reports.where(field, "in", values);
        if (!Number.isNaN(startMs)) q = q.where("created_at", ">=", new Date(startMs));
        if (!Number.isNaN(endMs)) q = q.where("created_at", "<=", new Date(endMs));
        const snap = await q.orderBy("created_at", "desc").limit(HISTORY_LIMIT).select(...FIELDS).get();
        return snap.docs.map(toRow);
      } catch (e: any) {
        if (e?.code !== 9 && !/index/i.test(String(e?.message))) throw e;
        console.warn(`activity: missing ${field}+created_at index, scanning all docs:`, e?.message);
      }
      const snap = await reports.where(field, "in", values).select(...FIELDS).get();
      return snap.docs
        .map(toRow)
        .filter((r: any) => {
          const ms = (r.created_at?.seconds || 0) * 1000;
          return (Number.isNaN(startMs) || ms >= startMs) && (Number.isNaN(endMs) || ms <= endMs);
        })
        .sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0))
        .slice(0, HISTORY_LIMIT);
    };

    // ?summary=1[&branch=][&startDate=&endDate=]: pulls per employee (counts only, no rows).
    // Date range alone hits the automatic single-field index; branch is matched in memory.
    if (searchParams.get("summary") === "1") {
      let q: any = reports;
      if (!Number.isNaN(startMs)) q = q.where("created_at", ">=", new Date(startMs));
      if (!Number.isNaN(endMs)) q = q.where("created_at", "<=", new Date(endMs));
      const snap = await q.select("branch", "fetched_by_email", "fetched_by_name", "fetched_by").get();
      const wanted = branch ? branch.trim().toLowerCase() : null;
      const counts: Record<string, { name: string; count: number }> = {};
      let unattributed = 0;
      snap.docs.forEach((doc: any) => {
        const d = doc.data();
        if (wanted && String(d.branch || "").trim().toLowerCase() !== wanted && !(wanted === "website" && d.branch === "customer")) return;
        const em = String(d.fetched_by_email || d.fetched_by?.email || "").trim().toLowerCase();
        if (!em || em === "n/a") { unattributed++; return; }
        const name = d.fetched_by_name || d.fetched_by?.name || em;
        (counts[em] ||= { name, count: 0 }).count++;
      });
      return respond({ counts, unattributed });
    }

    if (email) {
      return respond({ reports: await byField("fetched_by_email", [email.trim(), email.trim().toLowerCase()].filter((v, i, a) => a.indexOf(v) === i)) });
    }

    if (branch) {
      return respond({ reports: await byField("branch", spellings(branch, branch.trim() === "Website" ? ["customer"] : [])) });
    }

    // Staff live in either "users" or "dashboard_users"; merge and dedupe by email.
    const userSnaps = await Promise.all(
      ["users", "dashboard_users"].map((c) => adminDb.collection(c).select("name", "email", "branch", "role").get().catch(() => ({ docs: [] as any[] })))
    );
    const byEmail = new Map<string, any>();
    userSnaps.forEach((snap: any) =>
      snap.docs.forEach((d: any) => {
        const u = d.data();
        if (u.email && u.role !== "admin" && !byEmail.has(String(u.email).toLowerCase().trim())) {
          byEmail.set(String(u.email).toLowerCase().trim(), u);
        }
      })
    );
    const users = Array.from(byEmail.entries()).map(([key, u]) => ({ ...u, key }));
    const counts = await Promise.all(
      users.map((u: any) => {
        const variants = Array.from(new Set([u.key, String(u.email).trim()]));
        return reports.where("fetched_by_email", "in", variants).count().get();
      })
    );
    const employees = users.map((u: any, i: number) => ({
      name: u.name || u.email,
      email: u.key,
      branch: u.branch || "Online",
      count: counts[i].data().count,
    }));
    return respond({ employees });
  } catch (err: any) {
    console.error("GET /api/reports/activity error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
