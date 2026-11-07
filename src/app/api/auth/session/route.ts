import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("credit_dashboard_session");
    if (!sessionCookie?.value) {
      return NextResponse.json({ success: true, user: null }, { status: 200 });
    }

    const session = verifySessionToken(sessionCookie.value);
    if (!session) {
      return NextResponse.json({ success: true, user: null }, { status: 200 });
    }

    // TEMP: no DB read; the user comes straight from the signed session cookie.
    return NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
        branch: session.branch,
        employeeId: "TEMP-001",
        status: "Active",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
