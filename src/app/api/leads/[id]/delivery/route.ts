import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";
import { LeadError, leadWelcomeDelivery } from "@/lib/leads";

// GET — delivery status (Delivered / Read / Failed ...) of the "your advisor is ..." WhatsApp message.
// Admin, or the employee the lead is assigned to.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookie = req.cookies.get("credit_dashboard_session");
  const session = cookie?.value ? verifySessionToken(cookie.value) : null;
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }
  try {
    const { id } = await params;
    return NextResponse.json({ success: true, delivery: await leadWelcomeDelivery(id, session) });
  } catch (err: any) {
    if (err instanceof LeadError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.httpStatus });
    }
    console.error("GET /api/leads/[id]/delivery error:", err);
    return NextResponse.json({ success: false, error: "Could not check delivery" }, { status: 500 });
  }
}
