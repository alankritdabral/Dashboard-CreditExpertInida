import { adminDb } from "@/lib/firebaseAdmin";

// Website enquiries live in the Firestore "leads" collection (written by the
// public site's /api/contact). A lead has at most ONE assignee, stored in
// assignedToEmail, so two employees can never hold the same customer.

export const LEAD_STATUSES = ["NEW", "CONTACTED", "FOLLOW_UP", "CONVERTED", "NOT_INTERESTED"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface Lead {
  id: string;
  name: string;
  phone: string;
  requirement: string;
  netSalary: number | null;
  ongoingEmi: number | null;
  city: string | null;
  source: string;
  status: LeadStatus;
  createdAt: string | null; // ISO
  assignedToEmail: string | null;
  assignedToName: string | null;
  assignedByEmail: string | null;
  assignedAt: string | null; // ISO
}

export class LeadError extends Error {
  constructor(message: string, public httpStatus: number) {
    super(message);
  }
}

const MAX_LEADS = 500;

export const normalizeEmail = (e: unknown) => String(e || "").trim().toLowerCase();

// Same customer, however the number was typed (+91, spaces, leading 0).
export const phoneKey = (phone: unknown) => String(phone || "").replace(/\D/g, "").slice(-10);

const iso = (v: any): string | null => {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  if (typeof v.seconds === "number") return new Date(v.seconds * 1000).toISOString();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

function toLead(id: string, d: any): Lead {
  const status = LEAD_STATUSES.includes(d.status) ? d.status : "NEW";
  return {
    id,
    name: d.name || "",
    phone: d.phone || "",
    requirement: d.requirement || "",
    netSalary: typeof d.netSalary === "number" ? d.netSalary : null,
    ongoingEmi: typeof d.ongoingEmi === "number" ? d.ongoingEmi : null,
    city: d.city || null,
    source: d.source || "Website",
    status,
    createdAt: iso(d.createdAt),
    assignedToEmail: d.assignedToEmail || null,
    assignedToName: d.assignedToName || null,
    assignedByEmail: d.assignedByEmail || null,
    assignedAt: iso(d.assignedAt),
  };
}

const byNewest = (a: Lead, b: Lead) => (b.createdAt || "").localeCompare(a.createdAt || "");

// Admin sees everything; an employee sees only what is assigned to them.
export async function listLeads(session: { role: string; email: string }): Promise<Lead[]> {
  const col = adminDb.collection("leads");
  if (session.role === "admin") {
    const snap = await col.orderBy("createdAt", "desc").limit(MAX_LEADS).get();
    return snap.docs.map((d: any) => toLead(d.id, d.data()));
  }
  // Equality-only query (no orderBy) so it needs no composite index.
  const snap = await col.where("assignedToEmail", "==", normalizeEmail(session.email)).limit(MAX_LEADS).get();
  return snap.docs.map((d: any) => toLead(d.id, d.data())).sort(byNewest);
}

// Assign (or unassign with null) inside one transaction. Refuses when the same
// phone number is already held by a different employee on another lead, so a
// customer who submits the form twice still reaches only one person.
export async function assignLead(
  id: string,
  employee: { email: string; name: string } | null,
  assignedBy: string
): Promise<Lead> {
  const ref = adminDb.collection("leads").doc(id);
  return adminDb.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new LeadError("Lead not found", 404);
    const data = snap.data();

    if (!employee) {
      tx.update(ref, { assignedToEmail: null, assignedToName: null, assignedByEmail: null, assignedAt: null });
      return toLead(id, { ...data, assignedToEmail: null, assignedToName: null, assignedByEmail: null, assignedAt: null });
    }

    const key = phoneKey(data.phone);
    if (key) {
      const dupes = await tx.get(adminDb.collection("leads").where("phoneKey", "==", key));
      const clash = dupes.docs.find(
        (d: any) => d.id !== id && d.data().assignedToEmail && d.data().assignedToEmail !== employee.email
      );
      if (clash) {
        throw new LeadError(
          `This customer (${data.phone}) is already assigned to ${clash.data().assignedToName || clash.data().assignedToEmail}.`,
          409
        );
      }
    }

    const update = {
      phoneKey: key,
      assignedToEmail: employee.email,
      assignedToName: employee.name,
      assignedByEmail: assignedBy,
      assignedAt: new Date(),
    };
    tx.update(ref, update);
    return toLead(id, { ...data, ...update });
  });
}

// Admin may update any lead; an employee only their own.
export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
  session: { role: string; email: string }
): Promise<Lead> {
  const ref = adminDb.collection("leads").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new LeadError("Lead not found", 404);
  const data = snap.data();
  if (session.role !== "admin" && normalizeEmail(data.assignedToEmail) !== normalizeEmail(session.email)) {
    // Same answer as a missing lead so IDs can't be probed.
    throw new LeadError("Lead not found", 404);
  }
  await ref.update({ status, statusUpdatedAt: new Date(), statusUpdatedBy: normalizeEmail(session.email) });
  return toLead(id, { ...data, status });
}

export interface BulkAssignResult {
  assigned: Record<string, number>; // employee email -> leads given in this batch
  keptWithOwner: { phone: string; owner: string; count: number }[]; // customer already held by someone else
  skipped: number; // ids that no longer exist
}

const MAX_BULK = 200;

// Spread the chosen leads evenly over the chosen employees in ONE transaction.
//  - Leads of the same customer (same phone) are never split: they travel together.
//  - A customer already held by an employee (on a lead outside this batch) stays with
//    that employee, so nobody else receives the same customer.
//  - Each group goes to the employee with the fewest leads from this batch so far; ties go to
//    whoever currently holds the fewest assigned leads.
export async function bulkAssignEvenly(
  leadIds: string[],
  employees: { email: string; name: string }[],
  assignedBy: string
): Promise<BulkAssignResult> {
  const ids = Array.from(new Set(leadIds)).slice(0, MAX_BULK);
  if (!ids.length) throw new LeadError("Select at least one lead", 400);
  if (!employees.length) throw new LeadError("Select at least one employee", 400);

  const col = adminDb.collection("leads");
  return adminDb.runTransaction(async (tx: any) => {
    // All reads first (Firestore requirement), then writes.
    const snaps = await tx.getAll(...ids.map((id) => col.doc(id)));
    const assignedSnap = await tx.get(col.where("assignedToEmail", ">", "").limit(5000));

    const inBatch = new Set(ids);
    const ownerOf = new Map<string, { email: string; name: string }>(); // phoneKey -> holder (outside batch)
    const load = new Map<string, number>(); // email -> leads held now (outside batch)
    for (const d of assignedSnap.docs) {
      if (inBatch.has(d.id)) continue;
      const v = d.data();
      load.set(v.assignedToEmail, (load.get(v.assignedToEmail) || 0) + 1);
      const k = phoneKey(v.phone);
      if (k && !ownerOf.has(k)) ownerOf.set(k, { email: v.assignedToEmail, name: v.assignedToName || v.assignedToEmail });
    }

    // Group the selected leads by customer.
    const groups = new Map<string, { phone: string; ids: string[] }>();
    let skipped = 0;
    for (const s of snaps) {
      if (!s.exists) { skipped++; continue; }
      const k = phoneKey(s.data().phone) || `id:${s.id}`;
      const g = groups.get(k) || { phone: s.data().phone, ids: [] as string[] };
      g.ids.push(s.id);
      groups.set(k, g);
    }

    const result: BulkAssignResult = { assigned: {}, keptWithOwner: [], skipped };
    const given = new Map<string, number>(employees.map((e) => [e.email, 0]));
    const writes: { id: string; to: { email: string; name: string } }[] = [];

    // Biggest groups first keeps the split tight when a customer has several leads.
    const ordered = Array.from(groups.entries()).sort((a, b) => b[1].ids.length - a[1].ids.length);
    for (const [k, g] of ordered) {
      const holder = ownerOf.get(k);
      let to: { email: string; name: string };
      if (holder) {
        to = holder;
        result.keptWithOwner.push({ phone: g.phone, owner: holder.name, count: g.ids.length });
      } else {
        to = employees.reduce((best, e) => {
          const a = given.get(e.email)!, b = given.get(best.email)!;
          if (a !== b) return a < b ? e : best;
          return (load.get(e.email) || 0) < (load.get(best.email) || 0) ? e : best;
        });
        given.set(to.email, given.get(to.email)! + g.ids.length);
      }
      for (const id of g.ids) writes.push({ id, to });
      result.assigned[to.email] = (result.assigned[to.email] || 0) + g.ids.length;
    }

    const now = new Date();
    for (const w of writes) {
      const k = phoneKey(snaps.find((s: any) => s.id === w.id).data().phone);
      tx.update(col.doc(w.id), {
        phoneKey: k,
        assignedToEmail: w.to.email,
        assignedToName: w.to.name,
        assignedByEmail: assignedBy,
        assignedAt: now,
      });
    }
    return result;
  });
}
