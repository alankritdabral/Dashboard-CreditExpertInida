// One-off import of the old Firestore `credit_reports` collection into RDS, so reports pulled
// before the switch still show up in the admin / branch report lists.
//
// The records are sent to NodeBankend-Server (BACKEND_API_URL / BACKEND_API_KEY), which writes
// them to RDS. Only the dashboard's own record of each pull is created: no user and no credit
// report is created for past applicants.
//
// Usage:
//   npm run backfill:rds -- [options]
//
// Options:
//   --dry-run       Read and count only; send nothing.
//   --limit N       Stop after N documents (try a small number first).
//   --dir PATH      Read exported JSON files (scripts/export-credit-reports.mjs) instead of live Firestore.
//   --ipv4          Use IPv4 only. For networks where IPv6 is advertised but does not work (connections hang).
//
// Safe to re-run: every record carries its Firestore document id, and the backend skips documents
// it already has. Never writes to or deletes from Firestore.

import dns from "node:dns";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { saveBureauReport } from "@/lib/cibil/saveReport";

const COLLECTION = "credit_reports";
const PAGE_SIZE = 200;
/** Used when a document has no creation time at all, so it sorts after every dated report. */
const UNKNOWN_DATE = new Date("2000-01-01T00:00:00.000Z");

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const dryRun = flag("--dry-run");
const limit = option("--limit") ? Number(option("--limit")) : Infinity;
const dir = option("--dir");

if (flag("--ipv4")) {
  // Every hostname lookup made by this process (Firestore, Google auth, the backend) returns IPv4 only.
  const lookup = dns.lookup;
  (dns as any).lookup = (hostname: string, options: any, callback: any) => {
    if (typeof options === "function") return (lookup as any)(hostname, { family: 4 }, options);
    const opts = typeof options === "number" ? {} : options || {};
    return (lookup as any)(hostname, { ...opts, family: 4 }, callback);
  };
}

interface LegacyDoc {
  id: string;
  data: Record<string, any>;
  createdAt: Date;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value && typeof value === "object") {
    const seconds = (value as any)._seconds ?? (value as any).seconds;
    if (typeof seconds === "number") return new Date(seconds * 1000);
  }
  return null;
}

async function* fromFirestore(): AsyncGenerator<LegacyDoc[]> {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not set (run through `npm run backfill:rds`).");
  initializeApp({ credential: cert(JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"))) });
  const firestore = getFirestore();
  // REST instead of gRPC: plain HTTPS works on networks and proxies where gRPC does not.
  firestore.settings({ preferRest: true });
  const collection = firestore.collection(COLLECTION);

  let last: QueryDocumentSnapshot | null = null;
  for (;;) {
    let query = collection.orderBy("__name__").limit(PAGE_SIZE);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) return;
    yield snap.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
      createdAt: toDate(doc.data().created_at) || doc.createTime?.toDate() || UNKNOWN_DATE,
    }));
    last = snap.docs[snap.docs.length - 1];
  }
}

async function* fromDirectory(folder: string): AsyncGenerator<LegacyDoc[]> {
  const files = (await readdir(folder)).filter((f) => f.endsWith(".json") && !f.startsWith("_")).sort();
  for (let i = 0; i < files.length; i += PAGE_SIZE) {
    const batch: LegacyDoc[] = [];
    for (const file of files.slice(i, i + PAGE_SIZE)) {
      const data = JSON.parse(await readFile(path.join(folder, file), "utf-8"));
      if (!data || typeof data !== "object" || Array.isArray(data)) continue;
      batch.push({ id: String(data._id || file.replace(/\.json$/, "")), data, createdAt: toDate(data.created_at) || UNKNOWN_DATE });
    }
    yield batch;
  }
}

/** Same attribution defaults the old Firestore list API applied to records saved before attribution existed. */
function toSaveInput(doc: LegacyDoc) {
  const d = doc.data;
  const branch = String(d.branch || "Online");
  const fetchedByType = d.fetched_by_type || (branch === "admin" ? "admin" : branch === "customer" ? "customer" : "branch");
  const source = d.source || (branch === "admin" ? "dashboard_admin" : branch === "customer" ? "website" : "dashboard_branch");
  const fetchedByName =
    d.fetched_by_name || d.fetched_by?.name || (fetchedByType === "admin" ? "Admin" : fetchedByType === "customer" ? d.name || "Website Customer" : `${branch} Staff`);
  const fetchedByEmail = String(d.fetched_by_email || d.fetched_by?.email || "");

  return {
    legacyId: doc.id,
    createdAt: doc.createdAt,
    normalize: false,
    bureau: String(d.bureau || "v1"),
    raw: d.raw_api_data ?? null,
    name: String(d.name || "N/A"),
    mobile: String(d.mobile || ""),
    pan: String(d.pan || ""),
    gender: d.gender || null,
    email: d.email || null,
    pdfLink: d.pdf_link || null,
    creditScore: d.credit_score ?? null,
    fallbackData: d.fallbackData,
    branch,
    source,
    fetchedByType,
    fetchedByName,
    fetchedByEmail: fetchedByEmail === "N/A" ? "" : fetchedByEmail,
    fetchedBy: d.fetched_by || {
      type: fetchedByType,
      name: fetchedByName,
      email: fetchedByEmail || "N/A",
      branch,
      source,
      timestamp: doc.createdAt.toISOString(),
    },
  };
}

async function main() {
  const batches = dir ? fromDirectory(path.resolve(dir)) : fromFirestore();
  const totals = { read: 0, imported: 0, alreadyImported: 0, failed: 0 };

  console.log(`Backfill ${dir ? `from ${dir}` : `from Firestore "${COLLECTION}"`} → backend API → RDS${dryRun ? " — DRY RUN" : ""}`);

  outer: for await (const batch of batches) {
    for (const doc of batch) {
      if (totals.read >= limit) break outer;
      totals.read++;
      if (dryRun) continue;
      try {
        const saved = await saveBureauReport(toSaveInput(doc));
        if (saved.alreadyImported) totals.alreadyImported++;
        else totals.imported++;
      } catch (err) {
        totals.failed++;
        // The document id is PAN_mobile_bureau for most records, so it is not printed.
        console.error(`  failed on document #${totals.read}: ${(err as Error).message}`);
        // A wrong URL or key fails every record the same way — stop instead of repeating it.
        if (totals.failed >= 5 && totals.imported + totals.alreadyImported === 0) {
          console.error("Stopping: nothing has succeeded. Check BACKEND_API_URL and BACKEND_API_KEY.");
          break outer;
        }
      }
    }
    console.log(`  ${totals.read} read, ${totals.imported} imported, ${totals.alreadyImported} already there, ${totals.failed} failed`);
  }

  console.log("Done:", totals);
  if (totals.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
