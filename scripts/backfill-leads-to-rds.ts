// One-off import of the Firestore `leads` collection into RDS (website_leads), so enquiries
// received before the switch appear in the dashboard's Leads tab.
//
// Sent to NodeBankend-Server (BACKEND_API_URL / BACKEND_API_KEY). Assignment, status and
// notes made in the old Leads tab are carried over via a follow-up call per assigned customer.
//
// Usage:  npm run backfill:leads -- [--dry-run] [--limit N] [--ipv4]
//
// Safe to re-run: each record carries its Firestore document id and the backend skips ones it
// already has. Never writes to or deletes from Firestore.

import dns from "node:dns";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { backendRequest } from "@/lib/cibil/backendApi";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const dryRun = flag("--dry-run");
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;

if (flag("--ipv4")) {
  const lookup = dns.lookup;
  (dns as any).lookup = (h: string, o: any, cb: any) => {
    if (typeof o === "function") return (lookup as any)(h, { family: 4 }, o);
    return (lookup as any)(h, { ...(typeof o === "number" ? {} : o || {}), family: 4 }, cb);
  };
}

const toIso = (v: unknown): string | undefined => {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (v && typeof v === "object" && typeof (v as any)._seconds === "number") return new Date((v as any)._seconds * 1000).toISOString();
  const d = v ? new Date(v as any) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined;
};
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined);

async function main() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not set (run through `npm run backfill:leads`).");
  initializeApp({ credential: cert(JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"))) });
  const db = getFirestore();
  db.settings({ preferRest: true });

  const snap = await db.collection("leads").orderBy("createdAt", "asc").get();
  let sent = 0, existing = 0, skipped = 0;
  for (const doc of snap.docs) {
    if (sent + existing >= limit) break;
    const d = doc.data();
    if (!d.name || !d.phone) { skipped++; continue; }
    const extra: Record<string, unknown> = {};
    for (const k of ["totalDebt", "currentMonthlyEMI", "estimatedNewEMI", "estimatedMonthlySavings", "debtsCount", "debtsSummary"]) {
      if (d[k] !== undefined) extra[k] = d[k];
    }
    if (dryRun) { sent++; continue; }

    const res = await backendRequest<{ id: string; alreadyImported?: boolean }>("POST", "", {
      basePath: "/internal/website-leads",
      body: {
        legacyId: doc.id,
        name: String(d.name),
        phone: String(d.phone),
        requirement: d.requirement ? String(d.requirement) : undefined,
        netSalary: int(d.netSalary),
        ongoingEmi: int(d.ongoingEmi),
        city: d.city && d.city !== "Not provided" ? String(d.city) : undefined,
        source: d.source ? String(d.source) : undefined,
        consent: d.consent ? { ...d.consent, recordedAt: toIso(d.consent.recordedAt) } : undefined,
        attribution: d.attribution,
        extra: Object.keys(extra).length ? extra : undefined,
        createdAt: toIso(d.createdAt),
      },
    });
    if (res.alreadyImported) { existing++; continue; }
    sent++;

    if (d.assignedToEmail) {
      await backendRequest("POST", "/assign", {
        basePath: "/internal/website-leads",
        body: {
          keys: [String(d.phone).replace(/\D/g, "").slice(-10) || `id:${res.id}`],
          employees: [{ email: d.assignedToEmail, name: d.assignedToName || d.assignedToEmail }],
          assignedBy: d.assignedByEmail || d.assignedToEmail,
        },
      });
    }
    if (d.status && d.status !== "NEW") {
      await backendRequest("POST", "/status", {
        basePath: "/internal/website-leads",
        body: {
          key: String(d.phone).replace(/\D/g, "").slice(-10) || `id:${res.id}`,
          status: d.status,
          updatedBy: d.statusUpdatedBy || d.assignedByEmail || "backfill@creditexpertindia.com",
        },
      });
    }
  }
  console.log(`${dryRun ? "[dry run] would import" : "Imported"} ${sent}, already there ${existing}, skipped (no name/phone) ${skipped}, of ${snap.size} in Firestore.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
