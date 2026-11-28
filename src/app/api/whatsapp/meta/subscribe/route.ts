import { NextRequest, NextResponse } from "next/server";
import { metaError, metaRequest, requireWhatsappAdmin } from "@/lib/whatsappMeta";

// POST — subscribe our Meta app to the WhatsApp account's webhooks (admin, once per account).
export async function POST(req: NextRequest) {
  const a = requireWhatsappAdmin(req);
  if ("error" in a) return a.error;
  try {
    const r = await metaRequest<{ success: boolean }>("POST", "/subscribe", { body: { actorEmail: a.session.email } });
    return NextResponse.json({ success: true, subscribed: r.success });
  } catch (err) {
    return metaError(err, "Could not subscribe to webhooks");
  }
}
