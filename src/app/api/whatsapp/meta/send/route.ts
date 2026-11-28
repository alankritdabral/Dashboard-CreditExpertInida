import { NextRequest, NextResponse } from "next/server";
import { metaError, metaRequest, requireWhatsappAdmin } from "@/lib/whatsappMeta";

// POST { to, templateName, language, bodyParams?, headerMediaLink?, idempotencyKey? } — send one
// approved template (admin). The backend enforces the sending switch, opt-out and parameter count.
export async function POST(req: NextRequest) {
  const a = requireWhatsappAdmin(req);
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  const bodyParams = Array.isArray(b.bodyParams) ? b.bodyParams.slice(0, 20).map((v: unknown) => String(v ?? "")) : [];
  try {
    const message = await metaRequest("POST", "/messages/template", {
      body: {
        to: String(b.to ?? ""),
        templateName: String(b.templateName ?? ""),
        language: String(b.language ?? ""),
        bodyParams,
        ...(b.headerMediaLink && { headerMediaLink: String(b.headerMediaLink) }),
        ...(b.idempotencyKey && { idempotencyKey: String(b.idempotencyKey) }),
        actorEmail: a.session.email,
      },
    });
    return NextResponse.json({ success: true, message });
  } catch (err) {
    return metaError(err, "Could not send the template");
  }
}
