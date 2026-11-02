import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/user-service";
import {
  sendWhatsappOtp,
  sendWhatsappMessage,
  getWhatsappTimeZoneList,
  getWhatsappDlrDetails,
  getWhatsappCampaignDetails,
  addWhatsappTemplate,
  getWhatsappTemplatesList,
  getWhatsappTemplateById,
  getWhatsappApiToken,
  formatWhatsappNumber,
} from "@/lib/messagebotWhatsapp";
import {
  saveWhatsappMessageLog,
  getWhatsappMessageLogs,
  syncWhatsappMessageDlr,
  syncMultipleWhatsappMessageDlrs,
} from "@/lib/whatsappLogs";

async function requireAdmin() {
  const token = (await cookies()).get("credit_dashboard_session")?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session || session.role !== "admin") {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }
  return null;
}

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const tokenOverride = searchParams.get("apiToken") || undefined;

    switch (action) {
      case "status": {
        const configuredToken = getWhatsappApiToken(tokenOverride);
        const hasToken = Boolean(configuredToken && configuredToken.length > 5);
        const maskedToken = hasToken
          ? `${configuredToken.slice(0, 4)}••••••••${configuredToken.slice(-4)}`
          : null;

        return NextResponse.json({
          success: true,
          status: {
            hasToken,
            maskedToken,
            tokenSource: process.env.MESSAGEBOT_WHATSAPP_API_TOKEN
              ? "MESSAGEBOT_WHATSAPP_API_TOKEN"
              : process.env.MESSAGEBOT_API_TOKEN
              ? "MESSAGEBOT_API_TOKEN (Fallback)"
              : "None",
            otpTemplateId: process.env.MESSAGEBOT_WHATSAPP_OTP_TEMPLATE_ID || "3",
            businessNumber: process.env.MESSAGEBOT_WHATSAPP_BUSINESS_NUMBER || null,
            callbackUrl: process.env.MESSAGEBOT_WHATSAPP_CALLBACK_URL || null,
          },
        });
      }

      case "timezones": {
        const result = await getWhatsappTimeZoneList(tokenOverride);
        return NextResponse.json(result);
      }

      case "templates": {
        const result = await getWhatsappTemplatesList(tokenOverride);
        return NextResponse.json(result);
      }

      case "template": {
        const templateId = searchParams.get("templateId");
        if (!templateId) {
          return NextResponse.json(
            { success: false, error: "Missing templateId parameter" },
            { status: 400 }
          );
        }
        const result = await getWhatsappTemplateById({
          templateId,
          apiToken: tokenOverride,
        });
        return NextResponse.json(result);
      }

      case "dlr": {
        const campaignId = searchParams.get("campaignId");
        if (!campaignId) {
          return NextResponse.json(
            { success: false, error: "Missing campaignId parameter" },
            { status: 400 }
          );
        }
        const result = await getWhatsappDlrDetails({
          campaignId,
          apiToken: tokenOverride,
        });
        return NextResponse.json(result);
      }

      case "campaigns": {
        const campaignIds = searchParams.get("campaignIds");
        if (!campaignIds) {
          return NextResponse.json(
            { success: false, error: "Missing campaignIds parameter" },
            { status: 400 }
          );
        }
        const result = await getWhatsappCampaignDetails({
          campaignIds,
          apiToken: tokenOverride,
        });
        return NextResponse.json(result);
      }

      case "messages": {
        const search = searchParams.get("search") || undefined;
        const status = searchParams.get("status") || undefined;
        const type = searchParams.get("type") || undefined;
        const limitParam = searchParams.get("limit");
        const limit = limitParam ? Number(limitParam) : 100;
        const data = await getWhatsappMessageLogs({ search, status, type, limit });
        return NextResponse.json({ success: true, ...data });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unsupported action: '${action}'. Supported: status, timezones, templates, template, dlr, campaigns, messages`,
          },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("[API WhatsApp GET Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const contentType = req.headers.get("content-type") || "";
    let action = "";
    let params: Record<string, any> = {};
    let uploadedFile: File | Blob | undefined = undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      action = (formData.get("action") as string) || "";
      for (const [key, value] of formData.entries()) {
        if (key === "action") continue;
        if (key === "templateFile" && value instanceof File) {
          uploadedFile = value;
        } else {
          params[key] = value;
        }
      }
    } else {
      const body = await req.json();
      action = body.action;
      const { action: _, ...rest } = body;
      params = rest;
      if (params.templateFileBase64) {
        const buffer = Buffer.from(params.templateFileBase64, "base64");
        uploadedFile = new Blob([buffer]);
      }
    }

    switch (action) {
      case "send-otp": {
        const { phoneNumber, otpCode, templateId, callbackUrl, apiToken } = params;
        if (!phoneNumber || !otpCode) {
          return NextResponse.json(
            { success: false, error: "phoneNumber and otpCode are required" },
            { status: 400 }
          );
        }

        const result = await sendWhatsappOtp({
          phoneNumber,
          otpCode,
          templateId,
          callbackUrl,
          apiToken,
        });

        // Save OTP log to DB
        await saveWhatsappMessageLog({
          campaignId: result.campaignId || null,
          type: "OTP",
          recipientPhone: formatWhatsappNumber(phoneNumber),
          templateId: String(templateId || process.env.MESSAGEBOT_WHATSAPP_OTP_TEMPLATE_ID || "3"),
          templateName: "WhatsApp OTP Verification",
          templateType: "Authentication",
          sample: otpCode,
          status: result.success ? "ACCEPTED" : "REJECTED",
          errorCode: result.data?.ErrorCode ?? (result.success ? 0 : -1),
          errorDescription: result.error || (result.data?.ErrorDescription ?? ""),
          dlrStatus: result.success ? "Submitted" : "Failed",
          rawGatewayResponse: result.data,
        });

        return NextResponse.json(result);
      }

      case "send-message": {
        const {
          templateId,
          templateName,
          templateType,
          quickNumber,
          sample,
          buttonExample,
          campaignName,
          callbackUrl,
          isScheduled,
          timeZoneId,
          finalEffectiveDate,
          finalEffectiveTime,
          templateFileExtension,
          apiToken,
        } = params;

        if (!templateId || !quickNumber) {
          return NextResponse.json(
            { success: false, error: "templateId and quickNumber are required" },
            { status: 400 }
          );
        }

        let fileExt = templateFileExtension;
        if (!fileExt && uploadedFile instanceof File) {
          fileExt = uploadedFile.name.split(".").pop() || "png";
        }

        const result = await sendWhatsappMessage({
          templateId,
          quickNumber,
          sample,
          buttonExample,
          campaignName,
          callbackUrl,
          templateFile: uploadedFile,
          templateFileExtension: fileExt,
          isScheduled: isScheduled === true || isScheduled === "true",
          timeZoneId: timeZoneId !== undefined ? Number(timeZoneId) : undefined,
          finalEffectiveDate,
          finalEffectiveTime,
          apiToken,
        });

        // Save Message log to DB
        await saveWhatsappMessageLog({
          campaignId: result.campaignId || null,
          type: "MESSAGE",
          recipientPhone: formatWhatsappNumber(quickNumber),
          templateId: String(templateId),
          templateName: templateName || null,
          templateType: templateType || (uploadedFile ? "Image" : "Text"),
          sample: sample || null,
          buttonExample: buttonExample || null,
          campaignName: campaignName || null,
          callbackUrl: callbackUrl || null,
          hasMedia: Boolean(uploadedFile),
          mediaFileName: uploadedFile instanceof File ? uploadedFile.name : null,
          mediaFileExtension: fileExt,
          isScheduled: isScheduled === true || isScheduled === "true",
          timeZoneId: timeZoneId !== undefined ? Number(timeZoneId) : null,
          scheduledDateTime: finalEffectiveDate
            ? `${finalEffectiveDate} ${finalEffectiveTime || ""}`.trim()
            : null,
          status: result.success ? "ACCEPTED" : "REJECTED",
          errorCode: result.data?.ErrorCode ?? (result.success ? 0 : -1),
          errorDescription: result.error || (result.data?.ErrorDescription ?? ""),
          dlrStatus: result.success ? "Submitted" : "Failed",
          rawGatewayResponse: result.data,
        });

        return NextResponse.json(result);
      }

      case "sync-dlr": {
        const { campaignId, apiToken } = params;
        if (!campaignId) {
          return NextResponse.json(
            { success: false, error: "campaignId is required" },
            { status: 400 }
          );
        }
        const result = await syncWhatsappMessageDlr(campaignId, apiToken);
        return NextResponse.json(result);
      }

      case "sync-multiple-dlr": {
        const { campaignIds, apiToken } = params;
        if (!campaignIds || !Array.isArray(campaignIds)) {
          return NextResponse.json(
            { success: false, error: "campaignIds array is required" },
            { status: 400 }
          );
        }
        const result = await syncMultipleWhatsappMessageDlrs(campaignIds, apiToken);
        return NextResponse.json(result);
      }

      case "get-dlr": {
        const { campaignId, apiToken } = params;
        if (!campaignId) {
          return NextResponse.json(
            { success: false, error: "campaignId is required" },
            { status: 400 }
          );
        }
        const result = await getWhatsappDlrDetails({ campaignId, apiToken });
        return NextResponse.json(result);
      }

      case "get-campaigns": {
        const { campaignIds, apiToken } = params;
        if (!campaignIds) {
          return NextResponse.json(
            { success: false, error: "campaignIds is required" },
            { status: 400 }
          );
        }
        const result = await getWhatsappCampaignDetails({ campaignIds, apiToken });
        return NextResponse.json(result);
      }

      case "add-template": {
        const {
          templateName,
          templateCategoryId,
          customerWhatsAppNumber,
          bodyText,
          buttonTypeId,
          buttonText,
          buttonPhoneNumber,
          buttonUrl,
          buttonExample,
          componentFormatId,
          headerText,
          exampleBodyText,
          footerText,
          apiToken,
        } = params;

        if (!templateName || !templateCategoryId || !customerWhatsAppNumber || !componentFormatId) {
          return NextResponse.json(
            {
              success: false,
              error:
                "templateName, templateCategoryId, customerWhatsAppNumber, and componentFormatId are required",
            },
            { status: 400 }
          );
        }

        const result = await addWhatsappTemplate({
          templateName,
          templateCategoryId: Number(templateCategoryId) as 1 | 2 | 3,
          customerWhatsAppNumber,
          bodyText,
          buttonTypeId: buttonTypeId ? (Number(buttonTypeId) as 1 | 2 | 3 | 4) : undefined,
          buttonText,
          buttonPhoneNumber,
          buttonUrl,
          buttonExample,
          componentFormatId: Number(componentFormatId) as 1 | 2 | 3 | 4,
          headerText,
          exampleBodyText,
          footerText,
          apiToken,
        });
        return NextResponse.json(result);
      }

      case "test-connection": {
        const { apiToken } = params;
        const result = await getWhatsappTimeZoneList(apiToken);
        if (result.success) {
          return NextResponse.json({
            success: true,
            message: "Successfully connected to MessageBot WhatsApp API gateway!",
            totalTimeZones: result.timezones?.length || 0,
          });
        }
        return NextResponse.json({
          success: false,
          error: result.error || "Failed to connect to MessageBot API gateway.",
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unsupported action: '${action}'. Supported: send-otp, send-message, get-dlr, get-campaigns, add-template, test-connection`,
          },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("[API WhatsApp POST Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
