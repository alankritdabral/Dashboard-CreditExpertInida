import { BackendApiError, backendRequest } from "@/lib/cibil/backendApi";
import type { UnassignedReason } from "@/lib/leadKinds";

// Website enquiries live in RDS (table website_leads). The dashboard cannot reach RDS, so it
// goes through the backend, like credit reports. The backend groups enquiries and credit
// reports by phone number into one customer, and a customer has at most ONE assignee.

const API = "/internal/website-leads";

export const LEAD_STATUSES = ["NEW", "CONTACTED", "FOLLOW_UP", "CONVERTED", "NOT_INTERESTED"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface LeadReport {
  id: string;
  bureau: string;
  creditScore: number | null;
  source: string;
  pulledBy: string | null;
  createdAt: string; // ISO
}

export interface LeadActivity {
  type: "enquiry" | "credit_report";
  label: string;
  source: string;
  at: string; // ISO
}

// One entry is one CUSTOMER: every enquiry (contact form, calculators, eligibility check) and
// every credit report that shares a phone number. `id` is the customer key (last 10 digits).
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
  createdAt: string | null; // latest enquiry, ISO
  firstSeenAt: string | null;
  assignedToEmail: string | null;
  assignedToName: string | null;
  assignedByEmail: string | null;
  assignedAt: string | null; // ISO
  assignedToPhone: string | null; // employee's number, as told to the customer
  branch: string | null; // owner's branch, or the branch the city routes to while the lead waits
  // Why automatic assignment could not give the lead to anyone (null once it has an owner).
  unassignedReason: UnassignedReason | null;
  // WhatsApp "your advisor is ..." message: SENT, FAILED, SKIPPED, or null when never attempted.
  welcomeStatus: "SENT" | "FAILED" | "SKIPPED" | null;
  welcomeSentAt: string | null; // ISO
  welcomeError: string | null;
  welcomeCampaignId: number | null; // MessageBot campaign, used to look up delivery
  // WhatsApp "new lead for you" sent to the assigned employee.
  employeeNotifyStatus: "SENT" | "FAILED" | "SKIPPED" | null;
  employeeNotifiedAt: string | null; // ISO
  employeeNotifyError: string | null;
  enquiryCount: number;
  reports: LeadReport[]; // newest first
  latestScore: number | null;
  latestReportId: string | null;
  activity: LeadActivity[]; // newest first
}

export class LeadError extends Error {
  constructor(message: string, public httpStatus: number) {
    super(message);
  }
}

export const normalizeEmail = (e: unknown) => String(e || "").trim().toLowerCase();

// Same customer, however the number was typed (+91, spaces, leading 0).
export const phoneKey = (phone: unknown) => String(phone || "").replace(/\D/g, "").slice(-10);

async function call<T>(method: "GET" | "POST", path: string, opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {}): Promise<T> {
  try {
    return await backendRequest<T>(method, path, { basePath: API, target: "crm", ...opts });
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 404) throw new LeadError("Lead not found", 404);
    throw err;
  }
}

// Who is asking. `branch` and `manager` come from the signed session cookie, never from the browser.
export interface LeadSession {
  role: string;
  email: string;
  branch?: string;
  manager?: boolean;
}

// A branch manager: a branch user with the manager flag and a real branch. (Admins are not managers;
// they see everything anyway.) Without a branch there is nothing to scope to, so no manager powers.
export const isLeadManager = (s: LeadSession) => s.role !== "admin" && s.manager === true && !!s.branch && s.branch !== "All";

// What the backend should return for this person:
//   admin    -> every customer
//   manager  -> their branch's customers (routed to it, held by its staff, or nobody's yet)
//   employee -> only customers assigned to them
function scopeQuery(s: LeadSession): Record<string, string> {
  if (s.role === "admin") return {};
  if (isLeadManager(s)) return { branch: s.branch as string };
  return { ownerEmail: normalizeEmail(s.email) };
}

// Admin sees every customer; a manager their branch; an employee only those assigned to them.
export async function listLeads(session: LeadSession): Promise<Lead[]> {
  const data = await call<{ customers: Lead[] }>("GET", "", { query: scopeQuery(session) });
  return data.customers;
}

// Assign (or unassign with null). An explicit choice by the admin moves the customer, with all
// of their enquiries, to that employee.
export async function assignLead(
  id: string,
  employee: { email: string; name: string } | null,
  assignedBy: string
): Promise<Lead> {
  if (employee) {
    await call("POST", "/assign", { body: { keys: [id], employees: [employee], assignedBy } });
  } else {
    await call("POST", "/unassign", { body: { key: id } });
  }
  return fetchOne(id);
}

// One customer, scoped to what this person may see (admin: any, manager: their branch, employee: only their own).
export async function getLead(id: string, session: LeadSession): Promise<Lead | null> {
  const data = await call<{ customers: Lead[] }>("GET", "", { query: { key: id, ...scopeQuery(session) } });
  return data.customers.find((c) => c.id === id) ?? null;
}

// 404 unless this person may see the customer. Looked up through the same scope as the list, so a
// manager can never touch another branch's lead by guessing its id.
async function requireVisible(id: string, session: LeadSession): Promise<Lead> {
  const lead = await getLead(id, session);
  if (!lead) throw new LeadError("Lead not found", 404);
  return lead;
}

// Which of these customers this person may see: used to check a bulk action before it runs.
export async function visibleLeadIds(ids: string[], session: LeadSession): Promise<Set<string>> {
  const wanted = new Set(ids);
  return new Set((await listLeads(session)).filter((l) => wanted.has(l.id)).map((l) => l.id));
}

// Permanently delete customers' enquiries. Their credit reports are kept.
export async function deleteLeads(ids: string[]): Promise<number> {
  const keys = Array.from(new Set(ids)).slice(0, 200);
  if (!keys.length) throw new LeadError("Select at least one lead", 400);
  try {
    return (await call<{ deleted: number }>("POST", "/delete", { body: { keys } })).deleted;
  } catch (err) {
    // `call` reports every 404 as "Lead not found"; here it means the backend has no delete endpoint yet.
    if (err instanceof LeadError && err.httpStatus === 404) {
      throw new LeadError("Delete is not available on the backend yet. Deploy the latest backend, then try again.", 501);
    }
    throw err;
  }
}

// Admin may update any customer; a manager their branch's; an employee only their own.
export async function updateLeadStatus(id: string, status: LeadStatus, session: LeadSession): Promise<Lead> {
  const manager = isLeadManager(session);
  if (manager) await requireVisible(id, session);
  await call("POST", "/status", {
    body: {
      key: id,
      status,
      updatedBy: normalizeEmail(session.email),
      ...(session.role !== "admin" && !manager && { ownerEmail: normalizeEmail(session.email) }),
    },
  });
  return fetchOne(id);
}

// Send the "your advisor is ..." WhatsApp message to the customer again. Admin, a manager for their
// branch, or the employee who holds the lead.
export async function resendWelcome(id: string, session: LeadSession): Promise<Lead> {
  const lead = isLeadManager(session) ? await requireVisible(id, session) : await fetchOne(id);
  if (session.role !== "admin" && !isLeadManager(session) && normalizeEmail(lead.assignedToEmail) !== normalizeEmail(session.email)) {
    throw new LeadError("Lead not found", 404);
  }
  if (!lead.assignedToEmail) throw new LeadError("Assign the lead to an employee first", 400);
  await call("POST", "/resend-welcome", { body: { key: id } });
  return fetchOne(id);
}

// Re-read one customer so the screen shows the backend's state after a change.
async function fetchOne(id: string): Promise<Lead> {
  const all = await call<{ customers: Lead[] }>("GET", "", { query: { key: id } });
  const lead = all.customers.find((c) => c.id === id);
  if (!lead) throw new LeadError("Lead not found", 404);
  return lead;
}

export interface BulkAssignResult {
  assigned: Record<string, number>; // employee email -> customers given in this batch
  notified: number; // customers whose WhatsApps (customer + employee) were sent for this batch
  keptWithOwner: { phone: string; owner: string; count: number }[]; // customer already held by someone else
  skipped: number; // ids that no longer exist
}

const MAX_BULK = 200;

// Spread the chosen customers evenly over the chosen employees in ONE transaction (backend).
// A customer already held by an employee stays with them, so nobody else receives the same person.
export async function bulkAssignEvenly(
  leadIds: string[],
  employees: { email: string; name: string }[],
  assignedBy: string
): Promise<BulkAssignResult> {
  const keys = Array.from(new Set(leadIds)).slice(0, MAX_BULK);
  if (!keys.length) throw new LeadError("Select at least one lead", 400);
  if (!employees.length) throw new LeadError("Select at least one employee", 400);
  return call<BulkAssignResult>("POST", "/assign", { body: { keys, employees, assignedBy, keepExisting: true } });
}

// ---- Employees who receive new leads automatically (table lead_employees) ----

export interface LeadEmployee {
  id: string;
  name: string;
  email: string;
  phone: string;
  hrmsId: string | null;
  branch: string;
  role: "EMPLOYEE" | "MANAGER";
  maxOpenLeads: number | null; // null = no limit
  openCount: number; // customers they hold right now that are not finished
  active: boolean;
  lastAssignedAt: string | null;
}

export async function listLeadEmployees(): Promise<LeadEmployee[]> {
  return (await call<{ employees: LeadEmployee[] }>("GET", "/employees")).employees;
}

export async function saveLeadEmployee(e: {
  name: string;
  email: string;
  phone: string;
  hrmsId?: string;
  branch?: string;
  active?: boolean;
  role?: "EMPLOYEE" | "MANAGER";
  maxOpenLeads?: number | null; // null removes the limit; leave out to keep it
}): Promise<LeadEmployee> {
  return call<LeadEmployee>("POST", "/employees", { body: e });
}

// ---- Which branch a city goes to ----

export interface BranchRule {
  city: string; // saved lower-case, punctuation removed
  branch: string;
}

export async function listBranchRules(): Promise<BranchRule[]> {
  return (await call<{ rules: BranchRule[] }>("GET", "/branch-rules")).rules;
}

export async function saveBranchRule(city: string, branch: string): Promise<BranchRule> {
  return call<BranchRule>("POST", "/branch-rules", { body: { city, branch } });
}

export async function deleteBranchRule(city: string): Promise<void> {
  await call("POST", "/branch-rules/delete", { body: { city } });
}

// Try again to give every waiting lead an owner (backend does this every 5 minutes as well).
export async function retryUnassigned(): Promise<{ tried: number; assigned: number; stillUnassigned: number }> {
  return call("POST", "/auto-assign-pending");
}

// Delivery of the "your advisor is ..." message: looked up at MessageBot on demand.
export async function leadWelcomeDelivery(id: string, session: LeadSession) {
  const lead = isLeadManager(session) ? await requireVisible(id, session) : await fetchOne(id);
  if (session.role !== "admin" && !isLeadManager(session) && normalizeEmail(lead.assignedToEmail) !== normalizeEmail(session.email)) {
    throw new LeadError("Lead not found", 404);
  }
  if (!lead.welcomeCampaignId) throw new LeadError("No WhatsApp message has been sent for this lead", 404);
  const { getWhatsappDlrDetails } = await import("@/lib/messagebotWhatsapp");
  const r = await getWhatsappDlrDetails({ campaignId: lead.welcomeCampaignId });
  if (!r.success) throw new LeadError(r.error || "Could not check delivery", 502);
  return (r.dlr?.CampaignStatus || []).map((c) => `${c.DlrStatus}${c.NumberofSms > 1 ? ` (${c.NumberofSms})` : ""}`).join(", ") || "Submitted";
}

// ---- Lead-team sign-in: passwordless, a WhatsApp code to the number saved in RDS ----

export interface LeadTeamIdentity {
  id: string;
  name: string;
  email: string;
  phone: string;
  hrmsId: string | null;
  branch: string;
  role: "EMPLOYEE" | "MANAGER";
}

export async function isLeadTeamMember(email: string): Promise<boolean> {
  return (await call<{ leadEmployee: boolean }>("POST", "/employees/is-member", { body: { email } })).leadEmployee;
}

export async function requestLeadTeamCode(email: string): Promise<void> {
  await call("POST", "/employees/otp/request", { body: { email } });
}

export async function verifyLeadTeamCode(email: string, otp: string): Promise<LeadTeamIdentity | null> {
  return (await call<{ employee: LeadTeamIdentity | null }>("POST", "/employees/otp/verify", { body: { email, otp } })).employee;
}
