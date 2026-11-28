import { NextRequest, NextResponse } from "next/server";
import { metaError, metaRequest, requireWhatsappAdmin } from "@/lib/whatsappMeta";

// POST { text, idempotencyKey? } — free-form reply; the backend allows it only inside the 24h window (admin).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = requireWhatsappAdmin(req);
  if ("error" in a) return a.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  try {
    const message = await metaRequest("POST", `/conversations/${encodeURIComponent(id)}/messages`, {
      body: { text: String(b.text ?? "").slice(0, 4096), ...(b.idempotencyKey && { idempotencyKey: String(b.idempotencyKey) }), actorEmail: a.session.email },
    });
    return NextResponse.json({ success: true, message });
  } catch (err) {
    return metaError(err, "Could not send the reply");
  }
}
