import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { invalidateWhatsappMessagesCache } from "@/lib/whatsappLogs";

export async function GET() {
  return NextResponse.json({
    status: "active",
    endpoint: "WhatsApp Webhook Callback Gateway",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let body: any = {};

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        body[key] = value;
      }
    } else {
      const text = await req.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }

    console.log("[WhatsApp Webhook Callback Received]:", body);

    const campaignId =
      body.WhatsAppCampaignId ||
      body.whatsAppCampaignId ||
      body.campaignId ||
      body.CampaignId ||
      body.campaign_id;

    const dlrStatus =
      body.DlrStatus ||
      body.dlrStatus ||
      body.Status ||
      body.status ||
      body.DeliveryStatus ||
      "Delivered";

    const cost = body.TotalCost ?? body.Cost ?? body.cost;

    if (campaignId && adminDb && typeof (adminDb as any).collection === "function") {
      const cIdNum = Number(campaignId);
      const querySnapshot = await adminDb
        .collection("whatsapp_messages")
        .where("campaignId", "==", cIdNum)
        .get();

      if (!querySnapshot.empty) {
        const updatePayload: Record<string, any> = {
          dlrStatus: String(dlrStatus),
          updatedAt: new Date().toISOString(),
          lastDlrCheck: new Date().toISOString(),
          callbackData: body,
        };

        if (cost !== undefined && !isNaN(Number(cost))) {
          updatePayload.cost = Number(cost);
        }

        const batch = adminDb.batch();
        querySnapshot.docs.forEach((doc: any) => {
          batch.update(doc.ref, updatePayload);
        });
        await batch.commit();
        invalidateWhatsappMessagesCache();

        console.log(`[WhatsApp Webhook] Updated Campaign #${campaignId} DLR status: ${dlrStatus}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Callback processed successfully",
      campaignId: campaignId || null,
      status: dlrStatus,
    });
  } catch (error: any) {
    console.error("[WhatsApp Webhook Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process callback" },
      { status: 500 }
    );
  }
}
