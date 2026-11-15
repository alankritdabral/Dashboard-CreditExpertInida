import { NextRequest, NextResponse } from "next/server";
import { reportsListCache, activityCache } from "@/lib/api-caches";
import { parseBureauData } from "@/lib/bureauParsers";
import { backendErrorStatus } from "@/lib/cibil/backendApi";
import { saveBureauReport } from "@/lib/cibil/saveReport";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      mobile,
      pan,
      gender,
      dob,
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

    // The backend parses it into RDS, archives it to S3 and records it for the dashboard lists.
    const saved = await saveBureauReport({
      bureau: usedBureau,
      raw: raw_api_data || null,
      name: name || "Website Customer",
      mobile,
      pan: safePan,
      gender: gender || null,
      dob: dob || null,
      email: extractedEmail,
      pdfLink: pdf_link || null,
      creditScore: score || null,
      fallbackData,
      branch: branchName,
      source: reportSource,
      fetchedByType,
      fetchedByName: attribution.name,
      fetchedByEmail: attribution.email,
      fetchedBy: attribution,
    });
    reportsListCache.clear();
    activityCache.clear();

    return NextResponse.json({
      success: true,
      id: saved.id,
      credit_report_id: saved.creditReportId,
      no_hit: saved.noHit,
      message: `Report saved successfully from ${reportSource}`,
      attribution,
    });
  } catch (err: any) {
    console.error("External reports API error:", err);
    const status = backendErrorStatus(err);
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
