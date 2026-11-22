import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";
import { deleteBranchRule, listBranchRules, saveBranchRule } from "@/lib/leads";

// Admin only: which branch each city's leads go to. A city with no rule is routed across every branch.
const BRANCHES = ["Delhi", "Dehradun", "Rudrapur"];

function adminSession(req: NextRequest) {
  const cookie = req.cookies.get("credit_dashboard_session");
  const session = cookie?.value ? verifySessionToken(cookie.value) : null;
  if (!session) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  const denied = adminSession(req);
  if (denied) return denied;
  try {
    return NextResponse.json({ success: true, rules: await listBranchRules() });
  } catch (err) {
    console.error("GET /api/branch-rules error:", err);
    return NextResponse.json({ success: false, error: "Could not load city rules" }, { status: 500 });
  }
}

// POST { city, branch } — add the rule, or change the branch of the city's existing rule.
export async function POST(req: NextRequest) {
  const denied = adminSession(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const city = String(body.city || "").trim();
  if (!city || city.length > 100 || !BRANCHES.includes(body.branch)) {
    return NextResponse.json({ success: false, error: "Enter a city and pick one of the three branches" }, { status: 400 });
  }
  try {
    return NextResponse.json({ success: true, rule: await saveBranchRule(city, body.branch) });
  } catch (err) {
    console.error("POST /api/branch-rules error:", err);
    return NextResponse.json({ success: false, error: "Could not save the rule" }, { status: 500 });
  }
}

// DELETE { city }
export async function DELETE(req: NextRequest) {
  const denied = adminSession(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const city = String(body.city || "").trim();
  if (!city) return NextResponse.json({ success: false, error: "City is required" }, { status: 400 });
  try {
    await deleteBranchRule(city);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/branch-rules error:", err);
    return NextResponse.json({ success: false, error: "Could not delete the rule" }, { status: 500 });
  }
}
