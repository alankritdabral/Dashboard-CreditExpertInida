import { adminDb } from "./firebaseAdmin";
import { UserAccount, UserSession, UserRole } from "./types";
import crypto from "crypto";

const SEED_USERS: UserAccount[] = [
  {
    id: "usr_admin_1",
    name: "Super Admin",
    email: "admin@creditexpertindia.com",
    password: "Password@123",
    role: "admin",
    branch: "All",
    employeeId: "ADM-001",
    status: "Active",
    createdAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "usr_branch_rudrapur",
    name: "Rudrapur Branch Manager",
    email: "rudrapur@creditexpertindia.com",
    password: "Password@123",
    role: "branch",
    branch: "Rudrapur",
    employeeId: "BR-RUD-01",
    status: "Active",
    createdAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "usr_branch_delhi",
    name: "Delhi Branch Executive",
    email: "delhi@creditexpertindia.com",
    password: "Password@123",
    role: "branch",
    branch: "Delhi",
    employeeId: "BR-DEL-01",
    status: "Active",
    createdAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "usr_branch_dehradun",
    name: "Dehradun Branch Executive",
    email: "dehradun@creditexpertindia.com",
    password: "Password@123",
    role: "branch",
    branch: "Dehradun",
    employeeId: "BR-DDN-01",
    status: "Active",
    createdAt: "2024-01-01T00:00:00.000Z",
  },
];

// In-memory cache for fast lookups & offline dev fallback
const inMemoryUsers = new Map<string, UserAccount>();
SEED_USERS.forEach((u) => inMemoryUsers.set(u.email.toLowerCase(), u));

export async function getUserByEmail(email: string): Promise<UserAccount | null> {
  const normalized = email.toLowerCase().trim();

  // Try Firestore if available
  if (adminDb && typeof adminDb.collection === "function") {
    try {
      const snap = await adminDb
        .collection("dashboard_users")
        .where("email", "==", normalized)
        .limit(1)
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        return { id: doc.id, ...doc.data() } as UserAccount;
      }
    } catch (err) {
      console.warn("Firestore lookup failed, falling back to memory store:", err);
    }
  }

  // Memory fallback
  return inMemoryUsers.get(normalized) || null;
}

export async function getAllBranchUsers(): Promise<UserAccount[]> {
  const list: UserAccount[] = [];

  if (adminDb && typeof adminDb.collection === "function") {
    try {
      const snap = await adminDb.collection("dashboard_users").get();
      if (!snap.empty) {
        snap.docs.forEach((d: any) => {
          list.push({ id: d.id, ...d.data() } as UserAccount);
        });
        return list;
      }
    } catch (err) {
      console.warn("Firestore getAllBranchUsers failed, falling back to memory store:", err);
    }
  }

  // Fallback to in-memory
  return Array.from(inMemoryUsers.values());
}

export async function createBranchAccount(accountData: {
  name: string;
  email: string;
  password?: string;
  branch: string;
  employeeId?: string;
}): Promise<UserAccount> {
  const normalizedEmail = accountData.email.toLowerCase().trim();
  const newAccount: UserAccount = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: accountData.name,
    email: normalizedEmail,
    password: accountData.password || "Password@123",
    role: "branch",
    branch: accountData.branch,
    employeeId: accountData.employeeId || `BR-${accountData.branch.substring(0, 3).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
    status: "Active",
    createdAt: new Date().toISOString(),
  };

  // Save to memory
  inMemoryUsers.set(normalizedEmail, newAccount);

  // Save to Firestore
  if (adminDb && typeof adminDb.collection === "function") {
    try {
      await adminDb.collection("dashboard_users").doc(newAccount.id).set(newAccount);
    } catch (err) {
      console.error("Failed to write user to Firestore:", err);
    }
  }

  return newAccount;
}

export async function updateUserAccount(
  id: string,
  updates: Partial<UserAccount>
): Promise<boolean> {
  for (const [key, user] of inMemoryUsers.entries()) {
    if (user.id === id) {
      inMemoryUsers.set(key, { ...user, ...updates });
      break;
    }
  }

  if (adminDb && typeof adminDb.collection === "function") {
    try {
      await adminDb.collection("dashboard_users").doc(id).update(updates);
      return true;
    } catch (err) {
      console.error("Failed to update user in Firestore:", err);
    }
  }

  return true;
}

export async function updateUserPassword(email: string, newPassword: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  const user = inMemoryUsers.get(normalized);
  if (user) {
    user.password = newPassword;
  }

  if (adminDb && typeof adminDb.collection === "function") {
    try {
      const snap = await adminDb
        .collection("dashboard_users")
        .where("email", "==", normalized)
        .limit(1)
        .get();

      if (!snap.empty) {
        await snap.docs[0].ref.update({ password: newPassword });
      }
    } catch (err) {
      console.error("Failed to update password in Firestore:", err);
    }
  }

  return true;
}

export async function deleteBranchUser(id: string): Promise<boolean> {
  for (const [key, user] of inMemoryUsers.entries()) {
    if (user.id === id) {
      inMemoryUsers.delete(key);
      break;
    }
  }

  if (adminDb && typeof adminDb.collection === "function") {
    try {
      await adminDb.collection("dashboard_users").doc(id).delete();
      return true;
    } catch (err) {
      console.error("Failed to delete user in Firestore:", err);
    }
  }

  return true;
}

// Session Token helper
const SESSION_SECRET = process.env.ENCRYPTION_SECRET || "credit-expert-dashboard-secret-32-bytes!";

export function createSessionToken(session: UserSession): string {
  const payload = JSON.stringify(session);
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(payload).toString("base64") + "." + hmac;
}

export function verifySessionToken(token: string): UserSession | null {
  try {
    const [b64, signature] = token.split(".");
    if (!b64 || !signature) return null;

    const payload = Buffer.from(b64, "base64").toString("utf-8");
    const expectedHmac = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");

    if (signature !== expectedHmac) {
      return null;
    }

    const session = JSON.parse(payload) as UserSession;
    if (Date.now() > session.expiresAt) {
      return null;
    }

    return session;
  } catch (e) {
    return null;
  }
}
