import { NextRequest, NextResponse } from "next/server";
import { metaError, metaRequest, requireWhatsappAdmin, type MetaTemplate } from "@/lib/whatsappMeta";

// GET — templates as last synced from Meta. POST — sync them from Meta now (admin).
export async function GET(req: NextRequest) {
  const a = requireWhatsappAdmin(req);
  if ("error" in a) return a.error;
  try {
    const r = await metaRequest<{ templates: MetaTemplate[] }>("GET", "/templates");
    return NextResponse.json({ success: true, templates: r.templates });
  } catch (err) {
    return metaError(err, "Could not load templates");
  }
}

export async function POST(req: NextRequest) {
  const a = requireWhatsappAdmin(req);
  if ("error" in a) return a.error;
  try {
    const r = await metaRequest<{ synced: number; removed: number }>("POST", "/templates/sync", { body: { actorEmail: a.session.email } });
    return NextResponse.json({ success: true, ...r });
  } catch (err) {
    return metaError(err, "Could not sync templates");
  }
}
