import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { DEFAULT_REPORT_RECIPIENT, sendBranchReport } from "@/lib/branchReport";

// Vercel Cron calls this at 13:30 UTC = 7:00 PM IST (see vercel.json) with
// `Authorization: Bearer $CRON_SECRET`. `?to=` (same auth) sends a one-off demo copy instead.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const demoTo = new URL(req.url).searchParams.get("to");
    const to = demoTo || process.env.BRANCH_REPORT_TO || DEFAULT_REPORT_RECIPIENT;
    const result = await sendBranchReport(to, Boolean(demoTo));
    return NextResponse.json({ success: true, to, ...result });
  } catch (err: any) {
    console.error("GET /api/cron/branch-report error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
