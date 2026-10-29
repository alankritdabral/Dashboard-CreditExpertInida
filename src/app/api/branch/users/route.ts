import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/user-service";
import {
  getAllBranchUsers,
  createBranchAccount,
  updateUserAccount,
  deleteBranchUser,
} from "@/lib/user-service";

function requireAdmin(req: NextRequest) {
  const cookie = req.cookies.get("credit_dashboard_session");
  if (!cookie?.value) return null;
  const session = verifySessionToken(cookie.value);
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function GET(req: NextRequest) {
  const adminSession = requireAdmin(req);
  if (!adminSession) {
    return NextResponse.json({ success: false, error: "Unauthorized. Admin access required." }, { status: 403 });
  }

  const users = await getAllBranchUsers();
  // Sanitize passwords before returning
  const sanitized = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    branch: u.branch,
    employeeId: u.employeeId,
    status: u.status,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }));

  return NextResponse.json({ success: true, users: sanitized });
}

export async function POST(req: NextRequest) {
  const adminSession = requireAdmin(req);
  if (!adminSession) {
    return NextResponse.json({ success: false, error: "Unauthorized. Admin access required." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, email, password, branch, employeeId } = body;

    if (!name || !email || !branch) {
      return NextResponse.json(
        { success: false, error: "Name, email, and branch are required." },
        { status: 400 }
      );
    }

    const created = await createBranchAccount({
      name,
      email,
      password: password || "Password@123",
      branch,
      employeeId,
    });

    return NextResponse.json({
      success: true,
      message: `Branch account created for ${created.name} (${created.branch})`,
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        branch: created.branch,
        employeeId: created.employeeId,
        status: created.status,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const adminSession = requireAdmin(req);
  if (!adminSession) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 403 });
  }

  try {
    const { id, updates } = await req.json();
    if (!id || !updates) {
      return NextResponse.json({ success: false, error: "User ID and updates required." }, { status: 400 });
    }

    await updateUserAccount(id, updates);
    return NextResponse.json({ success: true, message: "User account updated successfully." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const adminSession = requireAdmin(req);
  if (!adminSession) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "User ID required." }, { status: 400 });
    }

    await deleteBranchUser(id);
    return NextResponse.json({ success: true, message: "User account deleted." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
