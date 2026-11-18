import { BackendApiError, backendRequest } from "@/lib/cibil/backendApi";

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
  // WhatsApp "your advisor is ..." message: SENT, FAILED, SKIPPED, or null when never attempted.
  welcomeStatus: "SENT" | "FAILED" | "SKIPPED" | null;
  welcomeSentAt: string | null; // ISO
  welcomeError: string | null;
  welcomeCampaignId: number | null; // MessageBot campaign, used to look up delivery
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
    return await backendRequest<T>(method, path, { basePath: API, ...opts });
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 404) throw new LeadError("Lead not found", 404);
    throw err;
  }
}

// Admin sees every customer; an employee sees only those assigned to them.
export async function listLeads(session: { role: string; email: string }): Promise<Lead[]> {
  const data = await call<{ customers: Lead[] }>("GET", "", {
    query: session.role === "admin" ? {} : { ownerEmail: normalizeEmail(session.email) },
  });
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

// Admin may update any customer; an employee only their own.
export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
  session: { role: string; email: string }
): Promise<Lead> {
  await call("POST", "/status", {
    body: {
      key: id,
      status,
      updatedBy: normalizeEmail(session.email),
      ...(session.role !== "admin" && { ownerEmail: normalizeEmail(session.email) }),
    },
  });
  return fetchOne(id);
}

// Send the "your advisor is ..." WhatsApp message to the customer again. Admin, or the employee who holds the lead.
export async function resendWelcome(id: string, session: { role: string; email: string }): Promise<Lead> {
  const lead = await fetchOne(id);
  if (session.role !== "admin" && normalizeEmail(lead.assignedToEmail) !== normalizeEmail(session.email)) {
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
  active: boolean;
  lastAssignedAt: string | null;
}

export async function listLeadEmployees(): Promise<LeadEmployee[]> {
  return (await call<{ employees: LeadEmployee[] }>("GET", "/employees")).employees;
}

export async function saveLeadEmployee(e: { name: string; email: string; phone: string; hrmsId?: string; active?: boolean }): Promise<LeadEmployee> {
  return call<LeadEmployee>("POST", "/employees", { body: e });
}

// Delivery of the "your advisor is ..." message: looked up at MessageBot on demand.
export async function leadWelcomeDelivery(id: string, session: { role: string; email: string }) {
  const lead = await fetchOne(id);
  if (session.role !== "admin" && normalizeEmail(lead.assignedToEmail) !== normalizeEmail(session.email)) {
    throw new LeadError("Lead not found", 404);
  }
  if (!lead.welcomeCampaignId) throw new LeadError("No WhatsApp message has been sent for this lead", 404);
  const { getWhatsappDlrDetails } = await import("@/lib/messagebotWhatsapp");
  const r = await getWhatsappDlrDetails({ campaignId: lead.welcomeCampaignId });
  if (!r.success) throw new LeadError(r.error || "Could not check delivery", 502);
  return (r.dlr?.CampaignStatus || []).map((c) => `${c.DlrStatus}${c.NumberofSms > 1 ? ` (${c.NumberofSms})` : ""}`).join(", ") || "Submitted";
}
