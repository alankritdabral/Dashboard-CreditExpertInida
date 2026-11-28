import { NextRequest, NextResponse } from "next/server";
import { metaError, metaRequest, requireWhatsappAdmin, type MetaConversation } from "@/lib/whatsappMeta";

// GET ?q= — WhatsApp conversations, newest first (admin: all).
export async function GET(req: NextRequest) {
  const a = requireWhatsappAdmin(req);
  if ("error" in a) return a.error;
  const q = req.nextUrl.searchParams.get("q")?.slice(0, 100) || undefined;
  try {
    const r = await metaRequest<{ conversations: MetaConversation[] }>("GET", "/conversations", { query: { q, limit: 100 } });
    return NextResponse.json({ success: true, conversations: r.conversations });
  } catch (err) {
    return metaError(err, "Could not load conversations");
  }
}
