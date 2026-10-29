import dns from "dns";

// Ensure Node.js prioritizes IPv4 over IPv6 to prevent ETIMEDOUT on networks with unrouted IPv6
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Ignore in environments where this method is unavailable
}

interface SendSmsOptions {
  to: string;
  message: string;
  messageType?: string; // "3" for OTP, "2" for Transactional, "1" for Promotional
  sourceAddress?: string; // Approved DLT Sender ID
  dltEntityId?: string;
  dltEntityTemplateId?: string;
  userReferenceId?: string;
}

interface MessageBotResponseItem {
  MessageId?: number | string;
  OperationCode?: number;
  Status?: string;
  DlrStatus?: string | null;
  UserReferenceId?: string | null;
  DestinationAddress?: string;
  Remarks?: string;
  CallBackUrl?: string | null;
  [key: string]: any;
}

export async function sendMessageBotSms({
  to,
  message,
  messageType = "3",
  sourceAddress,
  dltEntityId,
  dltEntityTemplateId,
  userReferenceId,
}: SendSmsOptions): Promise<{ success: boolean; data?: MessageBotResponseItem; error?: string }> {
  const apiToken = process.env.MESSAGEBOT_API_TOKEN || "nMb2CLiQwoN51oLB";
  const apiUrl = process.env.MESSAGEBOT_API_URL || "https://papi.messagebot.in/SendSmsV2";
  const senderId = sourceAddress || process.env.MESSAGEBOT_SENDER_ID || "CIBIL";
  const rawEntityId = dltEntityId || process.env.MESSAGEBOT_DLT_ENTITY_ID;
  const rawTemplateId = dltEntityTemplateId || process.env.MESSAGEBOT_DLT_TEMPLATE_ID;

  // Clean phone number: keep only digits
  const cleanedPhone = to.replace(/\D/g, "");
  // Destination address must be prefixed with 91 for India
  const destinationAddress = cleanedPhone.length === 10 ? `91${cleanedPhone}` : cleanedPhone;

  const payload: Record<string, any> = {
    apiToken,
    messageType,
    messageEncoding: "0",
    destinationAddress,
    sourceAddress: senderId,
    messageText: message,
  };

  // MessageBot API requires dltEntityId and dltEntityTemplateId to be valid 32-bit integers if provided.
  // Passing non-numeric strings (like "CIBIL") or 19-digit numbers causes MessageBot 400 rejection.
  const isValidInt32 = (val: any): boolean => {
    if (!val) return false;
    const str = String(val).trim();
    if (!/^\d+$/.test(str)) return false;
    const num = Number(str);
    return num > 0 && num <= 2147483647;
  };

  if (isValidInt32(rawEntityId)) {
    payload.dltEntityId = String(rawEntityId);
  }
  if (isValidInt32(rawTemplateId)) {
    payload.dltEntityTemplateId = String(rawTemplateId);
  }
  if (userReferenceId) {
    payload.userReferenceId = userReferenceId;
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([payload]),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[MessageBot] HTTP error response:", response.status, errText);
      return {
        success: false,
        error: `MessageBot service responded with status ${response.status}`,
      };
    }

    const resJson = await response.json();
    console.log("[MessageBot] API response:", JSON.stringify(resJson));

    // MessageBot returns an array of response items
    if (Array.isArray(resJson) && resJson.length > 0) {
      const item = resJson[0];
      if (item.Status === "Success" || item.OperationCode === 0) {
        return {
          success: true,
          data: item,
        };
      } else {
        return {
          success: false,
          data: item,
          error: item.Remarks || item.Status || "Failed to dispatch SMS",
        };
      }
    }

    if (resJson && (resJson.IsSuccess || resJson.Status === "Success")) {
      return { success: true, data: resJson };
    }

    return {
      success: false,
      error: resJson?.error || resJson?.message || "Unexpected response from SMS gateway",
    };
  } catch (err: any) {
    console.error("[MessageBot] Request exception:", err);
    return {
      success: false,
      error: err.message || "Network error while connecting to SMS gateway",
    };
  }
}
