import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";
import { isLeadManager, listLeadEmployees, normalizeEmail, saveLeadEmployee } from "@/lib/leads";

// Admin only: the staff who receive new website leads automatically.
function adminSession(req: NextRequest) {
  const cookie = req.cookies.get("credit_dashboard_session");
  const session = cookie?.value ? verifySessionToken(cookie.value) : null;
  if (!session) return { error: NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 }) };
  if (session.role !== "admin") return { error: NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 }) };
  return { session };
}

// Admin: the whole team. A branch manager: only their own branch's active employees, and only the
// fields the assign picker needs (no phone numbers, no HRMS ids).
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("credit_dashboard_session");
  const session = cookie?.value ? verifySessionToken(cookie.value) : null;
  if (!session) return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  if (session.role !== "admin" && !isLeadManager(session)) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }
  try {
    const team = await listLeadEmployees();
    if (session.role === "admin") return NextResponse.json({ success: true, employees: team });
    const own = team
      .filter((e) => e.active && e.role === "EMPLOYEE" && e.branch === session.branch)
      .map((e) => ({ name: e.name, email: e.email, branch: e.branch, active: e.active, openCount: e.openCount, maxOpenLeads: e.maxOpenLeads }));
    return NextResponse.json({ success: true, employees: own });
  } catch (err) {
    console.error("GET /api/lead-employees error:", err);
    return NextResponse.json({ success: false, error: "Could not load employees" }, { status: 500 });
  }
}

// POST { name, email, phone, hrmsId?, active? } — add, or update the employee with that email.
export async function POST(req: NextRequest) {
  const a = adminSession(req);
  if (a.error) return a.error;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = normalizeEmail(body.email);
  const phone = String(body.phone || "").replace(/\D/g, "").slice(-10);
  const role = body.role === "MANAGER" ? "MANAGER" : body.role === "EMPLOYEE" ? "EMPLOYEE" : undefined;
  // undefined = leave the saved limit alone; null or "" = remove it; a whole number = set it.
  let maxOpenLeads: number | null | undefined;
  if (body.maxOpenLeads === null || body.maxOpenLeads === "") maxOpenLeads = null;
  else if (body.maxOpenLeads !== undefined) {
    const n = Number(body.maxOpenLeads);
    if (!Number.isInteger(n) || n < 0 || n > 1000) {
      return NextResponse.json({ success: false, error: "The lead limit must be a whole number from 0 to 1000" }, { status: 400 });
    }
    maxOpenLeads = n;
  }
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || phone.length !== 10) {
    return NextResponse.json({ success: false, error: "Name, a valid email and a 10-digit phone are required" }, { status: 400 });
  }
  try {
    const employee = await saveLeadEmployee({
      name,
      email,
      phone,
      hrmsId: body.hrmsId ? String(body.hrmsId).trim() : undefined,
      branch: ["Delhi", "Dehradun", "Rudrapur"].includes(body.branch) ? body.branch : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined,
      role,
      maxOpenLeads,
    });
    return NextResponse.json({ success: true, employee });
  } catch (err) {
    console.error("POST /api/lead-employees error:", err);
    return NextResponse.json({ success: false, error: "Could not save employee" }, { status: 500 });
  }
}
