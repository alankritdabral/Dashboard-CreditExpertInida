import { adminDb } from "./firebaseAdmin";
import { TtlCache } from "./ttl-cache";

// Daily branch codes are rotated at 12:00 AM IST by /api/cron/rotate-codes.
// Cache reads briefly so a burst of logins costs one Firestore read per branch.
const codeCache = new TtlCache<string>(60_000, 10);

export async function getBranchAccessCode(branch: string): Promise<string | null> {
  const id = branch.trim().toLowerCase();
  if (!id) return null;
  const cached = codeCache.get(id);
  if (cached) return cached;
  const snap = await adminDb.collection("access_code_creditexpert").doc(id).get();
  const code = snap.exists ? snap.data()?.code : null;
  if (typeof code !== "string" || !code) return null;
  codeCache.set(id, code);
  return code;
}

// Epoch ms of the next 12:00 AM IST, when the daily code rotates.
export function nextCodeRotation(): number {
  const IST_OFFSET_MS = (5 * 60 + 30) * 60000;
  const d = new Date(Date.now() + IST_OFFSET_MS);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - IST_OFFSET_MS;
}
