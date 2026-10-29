import { adminDb } from "@/lib/firebaseAdmin";
import { getWhatsappDlrDetails, WhatsappDlrData } from "@/lib/messagebotWhatsapp";

export interface WhatsappMessageRecord {
  id?: string;
  campaignId?: number | null;
  type: "MESSAGE" | "OTP";
  recipientPhone: string;
  templateId: string;
  templateName?: string | null;
  templateType?: string | null;
  sample?: string | null;
  buttonExample?: string | null;
  campaignName?: string | null;
  callbackUrl?: string | null;
  hasMedia: boolean;
  mediaFileName?: string | null;
  mediaFileExtension?: string | null;
  isScheduled: boolean;
  timeZoneId?: number | null;
  scheduledDateTime?: string | null;
  status: "ACCEPTED" | "REJECTED" | "FAILED" | "PENDING";
  errorCode?: number;
  errorDescription?: string;
  // Delivery status: Delivered, Submitted, Rejected, Failed, Pending, Read
  dlrStatus: string;
  cost: number;
  currency: string;
  totalSms: number;
  lastDlrCheck?: string | null;
  rawGatewayResponse?: any;
  dlrDetails?: any;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappLogStats {
  totalMessages: number;
  totalDelivered: number;
  totalSubmitted: number;
  totalRejectedOrFailed: number;
  totalCost: number;
  currency: string;
  deliveryRatePercent: number;
}

const COLLECTION_NAME = "whatsapp_messages";

/**
 * 1. Save WhatsApp Message Log into Firestore
 */
export async function saveWhatsappMessageLog(
  data: Partial<WhatsappMessageRecord>
): Promise<string | null> {
  try {
    if (!adminDb || typeof (adminDb as any).collection !== "function") {
      console.warn("[whatsappLogs] Firestore adminDb is not initialized.");
      return null;
    }

    const now = new Date().toISOString();
    const docData: WhatsappMessageRecord = {
      campaignId: data.campaignId ? Number(data.campaignId) : null,
      type: data.type || "MESSAGE",
      recipientPhone: String(data.recipientPhone || ""),
      templateId: String(data.templateId || ""),
      templateName: data.templateName || null,
      templateType: data.templateType || null,
      sample: data.sample || null,
      buttonExample: data.buttonExample || null,
      campaignName: data.campaignName || null,
      callbackUrl: data.callbackUrl || null,
      hasMedia: Boolean(data.hasMedia),
      mediaFileName: data.mediaFileName || null,
      mediaFileExtension: data.mediaFileExtension || null,
      isScheduled: Boolean(data.isScheduled),
      timeZoneId: data.timeZoneId ? Number(data.timeZoneId) : null,
      scheduledDateTime: data.scheduledDateTime || null,
      status: data.status || (data.campaignId ? "ACCEPTED" : "FAILED"),
      errorCode: data.errorCode ?? (data.campaignId ? 0 : -1),
      errorDescription: data.errorDescription || "",
      dlrStatus: data.dlrStatus || (data.campaignId ? "Submitted" : "Failed"),
      cost: Number(data.cost ?? 0),
      currency: data.currency || "INR",
      totalSms: Number(data.totalSms ?? (data.campaignId ? 1 : 0)),
      lastDlrCheck: data.lastDlrCheck || null,
      rawGatewayResponse: data.rawGatewayResponse || null,
      dlrDetails: data.dlrDetails || null,
      createdAt: data.createdAt || now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection(COLLECTION_NAME).add(docData);
    return docRef.id;
  } catch (error) {
    console.error("[whatsappLogs:saveWhatsappMessageLog Error]", error);
    return null;
  }
}

/**
 * 2. Get WhatsApp Message Logs with Search, Status filter & Stats
 */
export async function getWhatsappMessageLogs(options?: {
  search?: string;
  status?: string;
  type?: string;
  limit?: number;
}): Promise<{ messages: WhatsappMessageRecord[]; stats: WhatsappLogStats }> {
  try {
    if (!adminDb || typeof (adminDb as any).collection !== "function") {
      return {
        messages: [],
        stats: {
          totalMessages: 0,
          totalDelivered: 0,
          totalSubmitted: 0,
          totalRejectedOrFailed: 0,
          totalCost: 0,
          currency: "INR",
          deliveryRatePercent: 0,
        },
      };
    }

    const maxLimit = Math.min(options?.limit || 100, 300);
    const snapshot = await adminDb
      .collection(COLLECTION_NAME)
      .orderBy("createdAt", "desc")
      .limit(maxLimit)
      .get();

    let allMessages: WhatsappMessageRecord[] = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // In-memory stats on recent records
    let totalDelivered = 0;
    let totalSubmitted = 0;
    let totalRejectedOrFailed = 0;
    let totalCost = 0;

    for (const msg of allMessages) {
      const statusLower = (msg.dlrStatus || msg.status || "").toLowerCase();
      if (statusLower.includes("delivered") || statusLower.includes("reached") || statusLower.includes("read")) {
        totalDelivered++;
      } else if (statusLower.includes("submitted") || statusLower.includes("accepted") || statusLower.includes("pending")) {
        totalSubmitted++;
      } else {
        totalRejectedOrFailed++;
      }
      totalCost += Number(msg.cost || 0);
    }

    const totalMessages = allMessages.length;
    const deliveryRatePercent =
      totalMessages > 0 ? Math.round((totalDelivered / totalMessages) * 100) : 0;

    // Apply search filter if provided
    let filteredMessages = allMessages;
    const search = options?.search?.trim().toLowerCase();
    if (search) {
      filteredMessages = filteredMessages.filter((m) => {
        const phone = (m.recipientPhone || "").toLowerCase();
        const cid = String(m.campaignId || "");
        const tname = (m.templateName || "").toLowerCase();
        const tid = String(m.templateId || "");
        const cname = (m.campaignName || "").toLowerCase();
        const sample = (m.sample || "").toLowerCase();
        return (
          phone.includes(search) ||
          cid.includes(search) ||
          tname.includes(search) ||
          tid.includes(search) ||
          cname.includes(search) ||
          sample.includes(search)
        );
      });
    }

    // Apply status filter
    const statusFilter = options?.status?.toLowerCase();
    if (statusFilter && statusFilter !== "all") {
      filteredMessages = filteredMessages.filter((m) => {
        const dStatus = (m.dlrStatus || m.status || "").toLowerCase();
        if (statusFilter === "delivered") {
          return dStatus.includes("delivered") || dStatus.includes("reached") || dStatus.includes("read");
        }
        if (statusFilter === "submitted") {
          return dStatus.includes("submitted") || dStatus.includes("accepted") || dStatus.includes("pending");
        }
        if (statusFilter === "failed" || statusFilter === "rejected") {
          return dStatus.includes("failed") || dStatus.includes("rejected");
        }
        return dStatus.includes(statusFilter);
      });
    }

    // Apply type filter
    const typeFilter = options?.type?.toUpperCase();
    if (typeFilter && typeFilter !== "ALL") {
      filteredMessages = filteredMessages.filter((m) => m.type === typeFilter);
    }

    return {
      messages: filteredMessages,
      stats: {
        totalMessages,
        totalDelivered,
        totalSubmitted,
        totalRejectedOrFailed,
        totalCost: Number(totalCost.toFixed(2)),
        currency: "INR",
        deliveryRatePercent,
      },
    };
  } catch (error) {
    console.error("[whatsappLogs:getWhatsappMessageLogs Error]", error);
    return {
      messages: [],
      stats: {
        totalMessages: 0,
        totalDelivered: 0,
        totalSubmitted: 0,
        totalRejectedOrFailed: 0,
        totalCost: 0,
        currency: "INR",
        deliveryRatePercent: 0,
      },
    };
  }
}

/**
 * 3. Sync live DLR delivery status and costing from MessageBot API into Firestore
 */
export async function syncWhatsappMessageDlr(
  campaignId: number | string,
  apiToken?: string
): Promise<{ success: boolean; record?: WhatsappMessageRecord; error?: string }> {
  try {
    if (!campaignId) {
      return { success: false, error: "Campaign ID is required for DLR sync." };
    }

    const cIdNum = Number(campaignId);
    const dlrResult = await getWhatsappDlrDetails({ campaignId: cIdNum, apiToken });

    if (!dlrResult.success || !dlrResult.dlr) {
      return {
        success: false,
        error: dlrResult.error || `No DLR record returned for Campaign #${campaignId}`,
      };
    }

    const dlr = dlrResult.dlr;
    // Extract main delivery status from CampaignStatus array
    const primaryStatus =
      Array.isArray(dlr.CampaignStatus) && dlr.CampaignStatus.length > 0
        ? dlr.CampaignStatus[0].DlrStatus
        : "Completed";

    const updatePayload: Partial<WhatsappMessageRecord> = {
      dlrStatus: primaryStatus,
      cost: dlr.TotalCost ?? 0,
      currency: dlr.Currency || "INR",
      totalSms: dlr.TotalSms ?? 1,
      lastDlrCheck: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dlrDetails: dlr,
    };

    if (adminDb && typeof (adminDb as any).collection === "function") {
      const querySnapshot = await adminDb
        .collection(COLLECTION_NAME)
        .where("campaignId", "==", cIdNum)
        .get();

      if (!querySnapshot.empty) {
        const batch = adminDb.batch();
        querySnapshot.docs.forEach((doc: any) => {
          batch.update(doc.ref, updatePayload);
        });
        await batch.commit();

        const updatedDoc = querySnapshot.docs[0];
        return {
          success: true,
          record: {
            id: updatedDoc.id,
            ...updatedDoc.data(),
            ...updatePayload,
          } as WhatsappMessageRecord,
        };
      } else {
        // If not yet in Firestore, auto-create an entry for this campaign
        const newDocId = await saveWhatsappMessageLog({
          campaignId: cIdNum,
          type: "MESSAGE",
          recipientPhone: "Recipient",
          templateId: "N/A",
          status: "ACCEPTED",
          ...updatePayload,
        });

        return {
          success: true,
          record: {
            id: newDocId || undefined,
            campaignId: cIdNum,
            type: "MESSAGE",
            recipientPhone: "Recipient",
            templateId: "N/A",
            status: "ACCEPTED",
            hasMedia: false,
            isScheduled: false,
            createdAt: new Date().toISOString(),
            ...updatePayload,
          } as WhatsappMessageRecord,
        };
      }
    }

    return {
      success: true,
      record: {
        campaignId: cIdNum,
        type: "MESSAGE",
        recipientPhone: "Recipient",
        templateId: "N/A",
        status: "ACCEPTED",
        hasMedia: false,
        isScheduled: false,
        createdAt: new Date().toISOString(),
        ...updatePayload,
      } as WhatsappMessageRecord,
    };
  } catch (error: any) {
    console.error("[whatsappLogs:syncWhatsappMessageDlr Error]", error);
    return { success: false, error: error.message || "Failed to sync DLR." };
  }
}

/**
 * 4. Sync Multiple Pending / Submitted WhatsApp DLRs
 */
export async function syncMultipleWhatsappMessageDlrs(
  campaignIds: (number | string)[],
  apiToken?: string
): Promise<{ success: boolean; syncedCount: number; results: any[] }> {
  let syncedCount = 0;
  const results: any[] = [];

  for (const cid of campaignIds) {
    try {
      const res = await syncWhatsappMessageDlr(cid, apiToken);
      results.push({ campaignId: cid, ...res });
      if (res.success) syncedCount++;
    } catch {
      results.push({ campaignId: cid, success: false });
    }
  }

  return { success: true, syncedCount, results };
}
