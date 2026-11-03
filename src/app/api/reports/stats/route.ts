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

    const usersSnap = await adminDb.collection("dashboard_users").select("branch").get();
    const branchNames = new Set<string>(["Admin", "Website", "Online"]);
    usersSnap.docs.forEach((d: any) => {
      const b = d.data().branch;
      if (b) branchNames.add(b);
    });

    const reports = adminDb.collection("credit_reports");
    const [totalSnap, ...branchSnaps] = await Promise.all([
      reports.count().get(),
      ...Array.from(branchNames).map((b) => reports.where("branch", "==", b).count().get()),
    ]);

    const branches: Record<string, number> = {};
    Array.from(branchNames).forEach((b, i) => {
      const c = branchSnaps[i].data().count;
      if (c > 0) branches[b] = c;
    });

    return NextResponse.json({ success: true, total: totalSnap.data().count, branches });
  } catch (err: any) {
    console.error("GET /api/reports/stats error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
