import type { Lead } from "@/lib/leads";

// Why automatic assignment could not give a lead to anyone. Lives here (not in lib/leads.ts, which
// has server-only code) so the leads screen can show it.
export type UnassignedReason = "NO_ACTIVE_EMPLOYEE" | "NO_EMPLOYEE_IN_BRANCH" | "ALL_AT_LIMIT";

export const UNASSIGNED_REASON_LABEL: Record<UnassignedReason, string> = {
  NO_ACTIVE_EMPLOYEE: "No one is taking leads",
  NO_EMPLOYEE_IN_BRANCH: "No one in this branch",
  ALL_AT_LIMIT: "Everyone is at their limit",
};

// Client-safe: no server imports, so the leads screen can use it.
// Where the customer came from. A customer who used several forms has several kinds.
export type LeadKind = "eligibility" | "details" | "other";

export const LEAD_KIND_LABEL: Record<LeadKind, string> = {
  eligibility: "Eligibility check",
  details: "Leave details form",
  other: "Calculator / other",
};

export function sourceKind(source: string | null | undefined): LeadKind {
  const s = String(source || "").toLowerCase();
  if (s.includes("eligibility")) return "eligibility";
  if (s.includes("contact")) return "details";
  return "other";
}

export function leadKinds(lead: Pick<Lead, "source" | "activity">): LeadKind[] {
  const found = new Set<LeadKind>();
  for (const a of lead.activity) if (a.type === "enquiry") found.add(sourceKind(a.source));
  if (!found.size) found.add(sourceKind(lead.source));
  return (["eligibility", "details", "other"] as const).filter((k) => found.has(k));
}
