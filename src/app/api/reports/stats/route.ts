import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionToken } from "@/lib/user-service";
import { backendErrorStatus } from "@/lib/cibil/backendApi";
import { reportStats } from "@/lib/cibil/reportStore";

const titleCase = (v: string) => v.replace(/\b[a-z]/g, (c) => c.toUpperCase());

// Aggregate counts only (one GROUP BY on the backend), so no report rows are downloaded.
export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get("credit_dashboard_session");
    const session = cookie?.value ? verifySessionToken(cookie.value) : null;
    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
    }

    // Staff still live in Firestore ("users" / "dashboard_users"); their branch names give the
    // display spelling for each branch.
    const displayNames = new Map<string, string>([["admin", "Admin"], ["website", "Website"], ["online", "Online"]]);
    if (adminDb && typeof adminDb.collection === "function") {
      const userSnaps = await Promise.all(
        ["users", "dashboard_users"].map((c) => adminDb.collection(c).select("branch").get().catch(() => ({ docs: [] as any[] })))
      );
      userSnaps.forEach((snap: any) =>
        snap.docs.forEach((d: any) => {
          const b = String(d.data().branch || "").trim();
          if (b && !displayNames.has(b.toLowerCase())) displayNames.set(b.toLowerCase(), b);
        })
      );
    }

    // Reports were saved with mixed-case branch names over time; reportStats merges them.
    const { total, byBranch } = await reportStats();
    const branches: Record<string, number> = {};
    Object.entries(byBranch).forEach(([key, count]) => {
      if (key && count > 0) branches[displayNames.get(key) || titleCase(key)] = count;
    });

    return NextResponse.json({ success: true, total, branches });
  } catch (err: any) {
    console.error("GET /api/reports/stats error:", err);
    const status = backendErrorStatus(err);
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
