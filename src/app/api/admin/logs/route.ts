import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionToken } from "@/lib/user-service";

export async function GET(req: NextRequest) {
  try {
    const cookie = req.cookies.get("credit_dashboard_session");
    const session = cookie?.value ? verifySessionToken(cookie.value) : null;

    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limitQuery = searchParams.get("limit") || "150";

    if (!adminDb || typeof adminDb.collection !== "function") {
      return NextResponse.json({ success: true, logs: [] });
    }

    const snap = await adminDb
      .collection("system_logs")
      .orderBy("timestamp", "desc")
      .limit(parseInt(limitQuery))
      .get();

    const logs = snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ success: true, logs });
  } catch (err: any) {
    console.error("GET /api/admin/logs error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
