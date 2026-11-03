import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, getUserByEmail } from "@/lib/user-service";

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

    const user = await getUserByEmail(session.email);
    if (!user || user.status !== "Active") {
      return NextResponse.json({ success: true, user: null }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch,
        employeeId: user.employeeId,
        status: user.status,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
