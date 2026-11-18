import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";
import { listLeadEmployees, normalizeEmail, saveLeadEmployee } from "@/lib/leads";

// Admin only: the staff who receive new website leads automatically.
function adminSession(req: NextRequest) {
  const cookie = req.cookies.get("credit_dashboard_session");
  const session = cookie?.value ? verifySessionToken(cookie.value) : null;
  if (!session) return { error: NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 }) };
  if (session.role !== "admin") return { error: NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 }) };
  return { session };
}

export async function GET(req: NextRequest) {
  const a = adminSession(req);
  if (a.error) return a.error;
  try {
    return NextResponse.json({ success: true, employees: await listLeadEmployees() });
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
    });
    return NextResponse.json({ success: true, employee });
  } catch (err) {
    console.error("POST /api/lead-employees error:", err);
    return NextResponse.json({ success: false, error: "Could not save employee" }, { status: 500 });
  }
}
