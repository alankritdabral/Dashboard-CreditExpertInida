import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionToken } from "@/lib/user-service";

// Aggregate counts only (Firestore count()), so no report documents are downloaded.
export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get("credit_dashboard_session");
    const session = cookie?.value ? verifySessionToken(cookie.value) : null;
    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
    }
    if (!adminDb || typeof adminDb.collection !== "function") {
      return NextResponse.json({ success: true, total: 0, branches: {} });
    }

    // Staff live in either "users" or "dashboard_users"; collect branches from both.
    const branchNames = new Set<string>(["Admin", "Website", "Online"]);
    const userSnaps = await Promise.all(
      ["users", "dashboard_users"].map((c) => adminDb.collection(c).select("branch").get().catch(() => ({ docs: [] as any[] })))
    );
    userSnaps.forEach((snap: any) =>
      snap.docs.forEach((d: any) => {
        const b = String(d.data().branch || "").trim();
        if (b) branchNames.add(b);
      })
    );

    // Older reports were saved with lowercase branch names ("delhi"), newer ones as "Delhi";
    // count every spelling and report them under the display name.
    const display = Array.from(branchNames);
    const spellings = display.map((b) => {
      const set = new Set([b, b.toLowerCase(), b.charAt(0).toUpperCase() + b.slice(1).toLowerCase()]);
      if (b === "Website") set.add("customer");
      return Array.from(set);
    });

    const reports = adminDb.collection("credit_reports");
    const [totalSnap, ...spellingSnaps] = await Promise.all([
      reports.count().get(),
      ...spellings.map((list) => Promise.all(list.map((s) => reports.where("branch", "==", s).count().get()))),
    ]);

    const branches: Record<string, number> = {};
    display.forEach((b, i) => {
      const c = (spellingSnaps[i] as any[]).reduce((sum, snap) => sum + snap.data().count, 0);
      if (c > 0) branches[b] = c;
    });

    return NextResponse.json({ success: true, total: totalSnap.data().count, branches });
  } catch (err: any) {
    console.error("GET /api/reports/stats error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
