import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionToken } from "@/lib/user-service";
import { reportsListCache } from "@/lib/api-caches";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });
    }

    if (!adminDb || typeof adminDb.collection !== "function") {
      return NextResponse.json({ success: false, error: "Database not connected" }, { status: 500 });
    }

    const docSnap = await adminDb.collection("credit_reports").doc(id).get();
    if (!docSnap.exists) {
      return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
    }

    const data = docSnap.data();
    return NextResponse.json({
      success: true,
      report: {
        id: docSnap.id,
        ...data,
        created_at: data.created_at ? { seconds: data.created_at._seconds } : null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
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

    if (adminDb && typeof adminDb.collection === "function") {
      await adminDb.collection("credit_reports").doc(id).delete();
      reportsListCache.clear();
    }

    return NextResponse.json({ success: true, message: "Report deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
