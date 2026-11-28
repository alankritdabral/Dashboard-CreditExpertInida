import { NextRequest, NextResponse } from "next/server";
import { metaError, metaRequest, requireWhatsappAdmin } from "@/lib/whatsappMeta";

// POST { phone, status: OPTED_IN | OPTED_OUT, source, evidence? } — record consent (admin).
export async function POST(req: NextRequest) {
  const a = requireWhatsappAdmin(req);
  if ("error" in a) return a.error;
  const b = await req.json().catch(() => ({}));
  try {
    const consent = await metaRequest("POST", "/consent", {
      body: {
        phone: String(b.phone ?? ""),
        status: b.status,
        purpose: b.purpose || "ALL",
        source: String(b.source || "STAFF").slice(0, 60),
        ...(b.evidence && { evidence: String(b.evidence).slice(0, 500) }),
        actorEmail: a.session.email,
      },
    });
    return NextResponse.json({ success: true, consent });
  } catch (err) {
    return metaError(err, "Could not save consent");
  }
}
