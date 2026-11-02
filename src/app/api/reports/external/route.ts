import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { reportsListCache } from "@/lib/api-caches";
import { parseBureauData } from "@/lib/bureauParsers";

function generateSearchTokens(name: string = "", mobile: string = "", pan: string = ""): string[] {
  const tokens = new Set<string>();
  const cleanName = name.toLowerCase().trim();
  const cleanPan = pan.toUpperCase().trim();
  const cleanMobile = mobile.trim();

  if (cleanPan) tokens.add(cleanPan);
  if (cleanMobile) tokens.add(cleanMobile);

  if (cleanName) {
    tokens.add(cleanName);
    cleanName.split(/\s+/).forEach((part) => {
      if (part.length > 1) tokens.add(part);
    });
  }

  return Array.from(tokens);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      mobile,
      pan,
      gender,
      bureau,
      credit_score,
      email,
      pdf_link,
      raw_api_data,
      source = "website", // "website" | "mobile_app"
      fetched_by,
      fallbackData,
    } = body;

    if (!mobile || !pan) {
      return NextResponse.json({ success: false, error: "Mobile and PAN are required." }, { status: 400 });
    }

    const safePan = pan.toUpperCase().trim();
    const usedBureau = bureau || "v1";
    const docId = `${safePan}_${mobile}_${usedBureau}`;

    let score = credit_score;
    let extractedEmail = email || null;

    if (!score && raw_api_data) {
      try {
        const parsed = parseBureauData(usedBureau, raw_api_data);
        if (parsed?.personalInfo?.score) score = parsed.personalInfo.score;
        if (!extractedEmail && parsed?.personalInfo?.email) extractedEmail = parsed.personalInfo.email;
      } catch (e) {}
    }

    const reportSource: "website" | "mobile_app" = source === "mobile_app" ? "mobile_app" : "website";
    const fetchedByType: "customer" | "app" = reportSource === "mobile_app" ? "app" : "customer";
    const branchName = reportSource === "mobile_app" ? "Mobile App" : "Website Direct";

    const attribution = fetched_by || {
      type: fetchedByType,
      name: name || (reportSource === "mobile_app" ? "App User" : "Website Customer"),
      email: extractedEmail || "N/A",
      branch: branchName,
      role: fetchedByType,
      source: reportSource,
      timestamp: new Date().toISOString(),
    };

    const docPayload = {
      name: name || "Website Customer",
      mobile: mobile,
      pan: safePan,
      gender: gender || null,
      bureau: usedBureau,
      credit_score: score || null,
      email: extractedEmail,
      pdf_link: pdf_link || null,
      raw_api_data: raw_api_data || null,
      created_at: new Date(),
      branch: branchName,
      source: reportSource,
      fetched_by: attribution,
      fetched_by_type: fetchedByType,
      fetched_by_name: attribution.name,
      fetched_by_email: attribution.email,
      search_tokens: generateSearchTokens(name, mobile, safePan),
      ...(fallbackData && { fallbackData }),
    };

    if (adminDb && typeof adminDb.collection === "function") {
      await adminDb.collection("credit_reports").doc(docId).set(docPayload, { merge: true });
      reportsListCache.clear();
    }

    return NextResponse.json({
      success: true,
      id: docId,
      message: `Report saved successfully from ${reportSource}`,
      attribution,
    });
  } catch (err: any) {
    console.error("External reports API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
