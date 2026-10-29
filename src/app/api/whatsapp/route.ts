import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";

export async function POST(req: NextRequest) {
  try {
    const cookie = req.cookies.get("credit_dashboard_session");
    const session = cookie?.value ? verifySessionToken(cookie.value) : null;

    if (!session || session.role !== "admin") {
      return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
    }

    const { mobile, message, templateId, campaignType } = await req.json();

    if (!mobile) {
      return NextResponse.json({ success: false, error: "Mobile number required" }, { status: 400 });
    }

    const token = process.env.MESSAGEBOT_WHATSAPP_API_TOKEN;
    const baseUrl = process.env.MESSAGEBOT_WHATSAPP_BASE_URL || "https://papi.messagebot.in";

    if (!token) {
      // Mock simulation mode when token not configured
      console.log(`[WHATSAPP SIMULATION] Message to ${mobile}: ${message}`);
      return NextResponse.json({
        success: true,
        simulated: true,
        message: "Message queued successfully (Simulation mode - WhatsApp token not set).",
        details: { mobile, message, templateId },
      });
    }

    // Call MessageBot WhatsApp API
    const res = await fetch(`${baseUrl}/api/v1/send-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        phone: mobile,
        message,
        template_id: templateId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ success: res.ok, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
