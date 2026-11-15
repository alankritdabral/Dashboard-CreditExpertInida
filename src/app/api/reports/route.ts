import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";
import { parseBureauData } from "@/lib/bureauParsers";
import { reportsListCache, activityCache } from "@/lib/api-caches";
import { backendErrorStatus } from "@/lib/cibil/backendApi";
import { listReports } from "@/lib/cibil/reportStore";
import { saveBureauReport } from "@/lib/cibil/saveReport";

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("credit_dashboard_session");
    const session = sessionCookie?.value ? verifySessionToken(sessionCookie.value) : null;

    if (!session) {
      return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("startDate");
    const end = searchParams.get("endDate");
    const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || searchParams.get("limit") || "12") || 12, 1), 100);
    const cursor = searchParams.get("cursor");
    const bureau = searchParams.get("bureau");
    const rawQuery = (searchParams.get("q") || "").trim();
    const withTotal = searchParams.get("withTotal") === "1";
    const requestedBranch = searchParams.get("branch");
    const source = searchParams.get("source");

    // Employees (branch logins) only see reports they pulled themselves; admins may filter by branch.
    // A branch login can never widen its scope with ?branch=.
    const ownerEmail = session.role === "branch" ? String(session.email || "").trim().toLowerCase() || null : null;
    const effectiveBranch = session.role === "branch" ? session.branch : requestedBranch;

    const cacheKey = JSON.stringify([ownerEmail, effectiveBranch, source, start, end, pageSize, cursor, bureau, rawQuery, withTotal]);
    const cachedPage = reportsListCache.get(cacheKey);
    if (cachedPage) {
      return NextResponse.json({ success: true, ...cachedPage });
    }

    const payload = await listReports({
      ownerEmail,
      branch: effectiveBranch,
      source,
      bureau,
      q: rawQuery,
      startDate: start,
      endDate: end,
      pageSize,
      cursor,
      withTotal,
    });

    reportsListCache.set(cacheKey, payload);
    return NextResponse.json({ success: true, ...payload });
  } catch (err: any) {
    console.error("GET /api/reports error:", err);
    const status = backendErrorStatus(err);
    return NextResponse.json({ success: false, error: err.message || "Failed to load reports" }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("credit_dashboard_session");
    const session = sessionCookie?.value ? verifySessionToken(sessionCookie.value) : null;

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
      fallbackData,
      sourceOverride,
      fetchedByOverride,
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

    // Determine attribution
    const isSessionAdmin = session?.role === "admin";
    const isSessionBranch = session?.role === "branch";

    let fetchedByType: "admin" | "branch" | "customer" | "app" = "customer";
    let source: "dashboard_admin" | "dashboard_branch" | "website" | "mobile_app" = "website";
    let branchName = "Website";
    let userName = name;
    let userEmail = extractedEmail || "N/A";

    if (fetchedByOverride) {
      fetchedByType = fetchedByOverride.type;
      source = fetchedByOverride.source;
      branchName = fetchedByOverride.branch || "Website";
      userName = fetchedByOverride.name || userName;
      userEmail = fetchedByOverride.email || userEmail;
    } else if (isSessionAdmin) {
      fetchedByType = "admin";
      source = "dashboard_admin";
      branchName = "Admin";
      userName = session?.name || "Admin";
      userEmail = session?.email || "admin@creditexpertindia.com";
    } else if (isSessionBranch) {
      fetchedByType = "branch";
      source = "dashboard_branch";
      branchName = session?.branch || "Branch";
      userName = session?.name || "Branch Staff";
      userEmail = session?.email || `${branchName.toLowerCase()}@creditexpertindia.com`;
    }

    if (sourceOverride) {
      source = sourceOverride;
    }

    const attribution = {
      type: fetchedByType,
      name: userName,
      email: userEmail,
      branch: branchName,
      role: session?.role || fetchedByType,
      employee_id: (session as any)?.employeeId || "N/A",
      source: source,
      timestamp: new Date().toISOString(),
    };

    // The backend parses it into RDS, archives it to S3 and records it for the dashboard lists.
    const saved = await saveBureauReport({
      bureau: usedBureau,
      raw: raw_api_data || null,
      name: name || "N/A",
      mobile,
      pan: safePan,
      gender: gender || null,
      dob: dob || null,
      email: extractedEmail,
      pdfLink: pdf_link || null,
      creditScore: score || null,
      fallbackData,
      branch: branchName,
      source,
      fetchedByType,
      fetchedByName: userName,
      fetchedByEmail: userEmail,
      fetchedBy: attribution,
    });
    reportsListCache.clear();
    activityCache.clear();

    return NextResponse.json({
      success: true,
      id: saved.id,
      credit_report_id: saved.creditReportId,
      no_hit: saved.noHit,
      message: "Report saved with full attribution",
      attribution,
    });
  } catch (err: any) {
    console.error("POST /api/reports error:", err);
    const status = backendErrorStatus(err);
    return NextResponse.json({ success: false, error: err.message }, { status });
  }
}
