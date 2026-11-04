import { adminDb } from "./firebaseAdmin";
import { hashPassword } from "@/lib/password";
import { UserAccount, UserSession, UserRole } from "./types";
import crypto from "crypto";
import { TtlCache } from "./ttl-cache";

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

// Session checks hit getUserByEmail on every page load; cache hits for five minutes
// (invalidated on any account change made on this instance).
// Only found users are cached, so failed lookups always re-check Firestore.
const userByEmailCache = new TtlCache<UserAccount>(5 * 60_000, 200);
const allUsersCache = new TtlCache<UserAccount[]>(30_000, 1);

function invalidateUserCaches() {
  userByEmailCache.clear();
  allUsersCache.clear();
}

export async function getUserByEmail(email: string): Promise<UserAccount | null> {
  const normalized = email.toLowerCase().trim();
  const rawEmail = email.trim();

  const cached = userByEmailCache.get(normalized);
  if (cached) return cached;

  const found = await lookupUserByEmail(normalized, rawEmail);
  if (found) userByEmailCache.set(normalized, found);
  return found;
}

async function lookupUserByEmail(normalized: string, rawEmail: string): Promise<UserAccount | null> {

  // Try Firestore if available
  if (adminDb && typeof adminDb.collection === "function") {
    try {
      // 1. Check primary "users" collection (supports both normalized and original casing)
      let userSnap = await adminDb
        .collection("users")
        .where("email", "==", normalized)
        .limit(1)
        .get();

      if (userSnap.empty && rawEmail !== normalized) {
        userSnap = await adminDb
          .collection("users")
          .where("email", "==", rawEmail)
          .limit(1)
          .get();
      }

      if (!userSnap.empty) {
        const doc = userSnap.docs[0];
        const data = doc.data();
        const role: UserRole = data.role === "admin" ? "admin" : "branch";
        return {
          id: doc.id,
          name: data.name || data.displayName || "User",
          email: data.email || normalized,
          password: data.password || "",
          role,
          branch: data.branch || "All",
          employeeId: data.employeeId || doc.id,
          status: data.status || "Active",
          createdAt: data.createdAt || new Date().toISOString(),
        } as UserAccount;
      }

      // 2. Check "dashboard_users" collection
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
  const fallback = inMemoryUsers.get(normalized) || null;
  return fallback;
}

export async function getAllBranchUsers(): Promise<UserAccount[]> {
  const cachedList = allUsersCache.get("all");
  if (cachedList) return cachedList;
  const list = await loadAllBranchUsers();
  allUsersCache.set("all", list);
  return list;
}

async function loadAllBranchUsers(): Promise<UserAccount[]> {
  const list: UserAccount[] = [];

  if (adminDb && typeof adminDb.collection === "function") {
    try {
      // 1. Fetch from primary "users" collection
      const userSnap = await adminDb.collection("users").get();
      if (!userSnap.empty) {
        userSnap.docs.forEach((d: any) => {
          const data = d.data();
          list.push({
            id: d.id,
            name: data.name || "User",
            email: data.email,
            password: data.password,
            role: data.role === "admin" ? "admin" : "branch",
            branch: data.branch || "All",
            employeeId: data.employeeId || d.id,
            status: data.status || "Active",
            createdAt: data.createdAt || new Date().toISOString(),
          } as UserAccount);
        });
        return list;
      }

      // 2. Fallback to "dashboard_users" collection
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
    password: hashPassword(accountData.password || "Password@123"),
    role: "branch",
    branch: accountData.branch,
    employeeId: accountData.employeeId || `BR-${accountData.branch.substring(0, 3).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
    status: "Active",
    createdAt: new Date().toISOString(),
  };

  // Save to memory
  inMemoryUsers.set(normalizedEmail, newAccount);
  invalidateUserCaches();

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
  invalidateUserCaches();
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

export async function updateUserPassword(email: string, plainPassword: string): Promise<boolean> {
  const newPassword = hashPassword(plainPassword);
  const normalized = email.toLowerCase().trim();
  invalidateUserCaches();
  const user = inMemoryUsers.get(normalized);
  if (user) {
    user.password = newPassword;
  }

  if (adminDb && typeof adminDb.collection === "function") {
    try {
      // 1. Update in "users" collection
      const userSnap = await adminDb
        .collection("users")
        .where("email", "==", normalized)
        .limit(1)
        .get();

      if (!userSnap.empty) {
        await userSnap.docs[0].ref.update({ password: newPassword });
        return true;
      }

      // 2. Update in "dashboard_users" collection
      const snap = await adminDb
        .collection("dashboard_users")
        .where("email", "==", normalized)
        .limit(1)
        .get();

      if (!snap.empty) {
        await snap.docs[0].ref.update({ password: newPassword });
      } else if (user) {
        await adminDb.collection("dashboard_users").doc(user.id).set({ ...user, password: newPassword });
      }
    } catch (err) {
      console.error("Failed to update password in Firestore:", err);
    }
  }

  return true;
}

export async function deleteBranchUser(id: string): Promise<boolean> {
  invalidateUserCaches();
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
