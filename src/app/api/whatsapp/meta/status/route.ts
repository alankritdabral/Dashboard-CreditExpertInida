import { NextRequest, NextResponse } from "next/server";
import { metaError, metaRequest, requireWhatsappAdmin, type MetaStatus } from "@/lib/whatsappMeta";

// GET — Meta connection health (admin). Never includes the token or App Secret.
export async function GET(req: NextRequest) {
  const a = requireWhatsappAdmin(req);
  if ("error" in a) return a.error;
  try {
    return NextResponse.json({ success: true, status: await metaRequest<MetaStatus>("GET", "/status") });
  } catch (err) {
    return metaError(err, "Could not load WhatsApp status");
  }
}
