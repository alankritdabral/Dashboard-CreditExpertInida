import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let requestedBureau = "v1";
  let bodyPayload: any = null;

  try {
    const json = await req.json();
    requestedBureau = json.bureau || "v1";
    bodyPayload = json.bodyPayload || {};

    const apiId = process.env.IDSPAY_API_ID;
    const apiKey = process.env.IDSPAY_API_KEY;
    const tokenId = process.env.IDSPAY_TOKEN_ID;

    if (!apiId || !apiKey || !tokenId) {
      // In development or if credentials missing, check if mock bypass is requested or provide simulated response
      console.warn("IDSPay credentials missing. Generating simulated bureau data for testing.");
      const mockScore = 742;
      return NextResponse.json({
        status: "success",
        credit_score: mockScore,
        bureau: requestedBureau,
        message: "Simulation mode: IDSPay credentials not configured in environment.",
        data: {
          credit_score: mockScore,
          personalInfo: {
            name: `${bodyPayload.first_name || ""} ${bodyPayload.last_name || ""}`.trim() || "Simulated Applicant",
            pan: bodyPayload.pan || "ABCDE1234F",
            mobile: bodyPayload.mobile || "9876543210",
            score: mockScore,
          },
          accounts: [
            {
              account_number: "XXXX-9021",
              account_type: "Auto Loan",
              bank_name: "HDFC BANK",
              current_balance: "245000",
              sanctioned_amount: "500000",
              status: "Active",
              payment_rating: "000",
            },
            {
              account_number: "XXXX-4412",
              account_type: "Credit Card",
              bank_name: "ICICI BANK",
              current_balance: "18500",
              sanctioned_amount: "150000",
              status: "Active",
              payment_rating: "000",
            },
          ],
          enquiries: [
            {
              enquiry_date: new Date().toISOString().split("T")[0],
              enquiry_purpose: "Personal Loan",
              institution_name: "AXIS BANK",
              enquiry_amount: "300000",
            },
          ],
        },
      });
    }

    let endpoint = "";
    const b = bodyPayload as {
      first_name?: string;
      last_name?: string;
      mobile?: string;
      pan?: string;
      dob?: string;
      gender?: string;
    };

    // Each IDSPay endpoint takes its own field names (same shapes as the public website's form).
    let providerBody: Record<string, unknown>;
    if (requestedBureau.startsWith("v1")) {
      // TransUnion (CIBIL)
      endpoint = "https://javabackend.idspay.in/api/v1/prod/srv5/transunion-Score-Hybrid";
      const g = (b.gender || "").toLowerCase();
      providerBody = {
        forename: b.first_name,
        surname: b.last_name,
        phone_number: b.mobile,
        gender: g === "male" ? "Male" : g === "female" ? "Female" : "Other",
        pan_id: b.pan,
        date_of_birth: b.dob || undefined,
      };
    } else if (requestedBureau.startsWith("crif")) {
      endpoint = "https://javabackend.idspay.in/api/v1/prod/crif/Credit-ScoreV4";
      providerBody = {
        first_name: b.first_name,
        last_name: b.last_name,
        mobile_no: b.mobile,
        name_lookup: 0,
      };
    } else if (requestedBureau.startsWith("experian")) {
      endpoint = "https://javabackend.idspay.in/api/v1/prod/srv2/credit-report/experian";
      providerBody = {
        first_name: b.first_name,
        last_name: b.last_name,
        mobile_no: b.mobile,
        pan: b.pan,
        dob: b.dob || undefined,
      };
    } else {
      return NextResponse.json({ error: "Unsupported bureau format." }, { status: 400 });
    }

    const finalPayload = {
      api_id: apiId,
      api_key: apiKey,
      token_id: tokenId,
      ...providerBody,
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalPayload),
    });

    const duration = Date.now() - startTime;
    const contentType = res.headers.get("content-type");
    let responseData: any = null;

    if (contentType && contentType.includes("application/json")) {
      responseData = await res.json();
    } else {
      const text = await res.text();
      responseData = { raw: text };
    }

    if (!res.ok) {
      // Surface the provider's reason (never log credentials) so 4xx failures are diagnosable.
      console.warn(`[IDSPay ${requestedBureau}] HTTP ${res.status}:`, JSON.stringify(responseData).slice(0, 4000));
      if (responseData && typeof responseData === "object" && (!responseData.error || typeof responseData.error === "object") && !(typeof responseData.message === "string" && responseData.message)) {
        const detail =
          responseData.detail || responseData.errors || responseData.msg || responseData.raw || responseData.status;
        responseData.error =
          `[${requestedBureau}] ` +
          (typeof detail === "string" ? detail : detail ? JSON.stringify(detail).slice(0, 300) : `Provider returned HTTP ${res.status}`);
      }
    }

    // Async record log to Firestore system_logs
    if (adminDb && typeof adminDb.collection === "function") {
      adminDb
        .collection("system_logs")
        .add({
          timestamp: new Date(),
          event: "IDSPAY_BUREAU_REQUEST",
          level: res.ok ? "info" : "error",
          duration_ms: duration,
          provider: {
            requested: requestedBureau,
            http_status: res.status,
          },
          identifiers: {
            pan_hash: bodyPayload.pan ? bodyPayload.pan.substring(0, 5) + "*****" : "N/A",
            mobile_last4: bodyPayload.mobile ? bodyPayload.mobile.slice(-4) : "N/A",
          },
          request_id: `req_${Date.now()}`,
          message: res.ok ? "Bureau report fetched successfully" : "Bureau API returned non-200 status",
        })
        .catch(() => {});
    }

    return NextResponse.json(responseData, { status: res.status });
  } catch (err: any) {
    console.error("IDSPay API error:", err);
    return NextResponse.json(
      { error: "Internal server error connecting to bureau", details: err.message },
      { status: 500 }
    );
  }
}
