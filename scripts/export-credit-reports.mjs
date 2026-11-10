// Export every document in the Firestore `credit_reports` collection to a folder,
// one JSON file per document (file name = Firestore doc id).
//
// Usage:  node --env-file=.env.local scripts/export-credit-reports.mjs [outDir]
// Default outDir: exports/credit_reports
//
// Read-only: this script never writes to Firestore.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from "firebase-admin/firestore";

const COLLECTION = "credit_reports";
const PAGE_SIZE = 500;
const outDir = path.resolve(process.argv[2] || "exports/credit_reports");

function getCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf-8");
    return cert(JSON.parse(decoded));
  }
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    });
  }
  throw new Error("No Firebase credentials found in environment (run with --env-file=.env.local).");
}

// Convert Firestore-specific types into plain JSON-friendly values.
function serialize(value) {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof GeoPoint) return { latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return value.path;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  }
  return value;
}

const safeName = (id) => id.replace(/[^A-Za-z0-9._-]/g, "_");

async function main() {
  initializeApp({ credential: getCredential() });
  const db = getFirestore();
  await mkdir(outDir, { recursive: true });

  let count = 0;
  let last = null;
  const usedNames = new Set();
  const manifest = [];

  for (;;) {
    let q = db.collection(COLLECTION).orderBy("__name__").limit(PAGE_SIZE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      let file = safeName(doc.id);
      // Avoid collisions if sanitising made two ids identical.
      if (usedNames.has(file)) file = `${file}__${count}`;
      usedNames.add(file);

      const record = { _id: doc.id, ...serialize(doc.data()) };
      await writeFile(path.join(outDir, `${file}.json`), JSON.stringify(record, null, 2));
      manifest.push({ id: doc.id, file: `${file}.json` });
      count++;
    }

    last = snap.docs[snap.docs.length - 1];
    console.log(`Exported ${count} documents...`);
  }

  await writeFile(
    path.join(outDir, "_manifest.json"),
    JSON.stringify({ collection: COLLECTION, exported_at: new Date().toISOString(), count, files: manifest }, null, 2)
  );
  console.log(`Done. ${count} documents written to ${outDir}`);
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
