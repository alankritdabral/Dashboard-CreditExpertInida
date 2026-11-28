import { NextRequest, NextResponse } from "next/server";
import { metaError, metaRequest, requireWhatsappAdmin, type MetaConversation, type MetaMessage } from "@/lib/whatsappMeta";

// GET — one conversation with its messages; marks it read (admin).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = requireWhatsappAdmin(req);
  if ("error" in a) return a.error;
  const { id } = await params;
  try {
    const r = await metaRequest<{ conversation: MetaConversation; messages: MetaMessage[] }>("GET", `/conversations/${encodeURIComponent(id)}`);
    return NextResponse.json({ success: true, ...r });
  } catch (err) {
    return metaError(err, "Could not load the conversation");
  }
}
