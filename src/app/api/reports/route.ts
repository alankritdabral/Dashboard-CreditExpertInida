import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionToken } from "@/lib/user-service";
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
    const limitQuery = searchParams.get("limit") || "1000";
    const requestedBranch = searchParams.get("branch");
    const source = searchParams.get("source");

    // Scope enforcement: branch users can ONLY see their branch's reports
    let effectiveBranch = session.role === "branch" ? session.branch : requestedBranch;

    if (!adminDb || typeof adminDb.collection !== "function") {
      return NextResponse.json({ success: true, reports: [] });
    }

    let queryRef: any = adminDb.collection("credit_reports");

    if (effectiveBranch && effectiveBranch !== "all" && effectiveBranch !== "All") {
      queryRef = queryRef.where("branch", "==", effectiveBranch);
    }

    if (source && source !== "all") {
      queryRef = queryRef.where("source", "==", source);
    }

    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      queryRef = queryRef.where("created_at", ">=", startDate).where("created_at", "<=", endDate);
    } else {
      const qLimit = parseInt(limitQuery);
      if (!effectiveBranch || effectiveBranch === "all" || effectiveBranch === "All") {
        queryRef = queryRef.orderBy("created_at", "desc");
      }
      queryRef = queryRef.limit(qLimit);
    }

    queryRef = queryRef.select(
      "name",
      "mobile",
      "pan",
      "bureau",
      "credit_score",
      "created_at",
      "branch",
      "source",
      "fetched_by",
      "fetched_by_type",
      "fetched_by_name",
      "fetched_by_email",
      "search_tokens",
      "fallbackData"
    );

    const snapshot = await queryRef.get();

    const reports = snapshot.docs.map((docSnap: any) => {
      const d = docSnap.data();

      let score = d.credit_score;
      if (!score && d.raw_api_data) {
        try {
          const parsed = parseBureauData(d.bureau, d.raw_api_data);
          score = parsed?.personalInfo?.score || null;
        } catch (e) {}
      }

      // Backward compatibility normalization for attribution
      const fetchedByType = d.fetched_by_type || (d.branch === "admin" ? "admin" : (d.branch === "customer" ? "customer" : "branch"));
      const fetchedByName = d.fetched_by_name || (d.fetched_by?.name) || (fetchedByType === "admin" ? "Admin" : (fetchedByType === "customer" ? d.name || "Website Customer" : `${d.branch || "Branch"} Staff`));

      return {
        id: docSnap.id,
        name: d.name || "N/A",
        mobile: d.mobile || "N/A",
        pan: d.pan || "N/A",
        bureau: d.bureau || "v1",
        credit_score: score,
        branch: d.branch || "Online",
        source: d.source || (d.branch === "admin" ? "dashboard_admin" : (d.branch === "customer" ? "website" : "dashboard_branch")),
        fetched_by_type: fetchedByType,
        fetched_by_name: fetchedByName,
        fetched_by_email: d.fetched_by_email || d.fetched_by?.email || "N/A",
        fetched_by: d.fetched_by || {
          type: fetchedByType,
          name: fetchedByName,
          email: d.fetched_by_email || "N/A",
          branch: d.branch || "Online",
          source: d.source || "dashboard_branch",
          timestamp: d.created_at ? new Date(d.created_at._seconds * 1000).toISOString() : new Date().toISOString()
        },
        search_tokens: d.search_tokens || [],
        fallbackData: d.fallbackData || null,
        created_at: d.created_at ? { seconds: d.created_at._seconds } : null,
      };
    });

    if (effectiveBranch && !(start && end)) {
      reports.sort((a: any, b: any) => {
        const timeA = a.created_at?.seconds || 0;
        const timeB = b.created_at?.seconds || 0;
        return timeB - timeA;
      });
    }

    return NextResponse.json({ success: true, reports });
  } catch (err: any) {
    console.error("GET /api/reports error:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to load reports" }, { status: 500 });
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

    const docPayload = {
      name: name || "N/A",
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
      source: source,
      fetched_by: attribution,
      fetched_by_type: fetchedByType,
      fetched_by_name: userName,
      fetched_by_email: userEmail,
      search_tokens: generateSearchTokens(name, mobile, safePan),
      ...(fallbackData && { fallbackData }),
    };

    if (adminDb && typeof adminDb.collection === "function") {
      await adminDb.collection("credit_reports").doc(docId).set(docPayload, { merge: true });
    }

    return NextResponse.json({
      success: true,
      id: docId,
      message: "Report saved with full attribution",
      attribution,
    });
  } catch (err: any) {
    console.error("POST /api/reports error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
