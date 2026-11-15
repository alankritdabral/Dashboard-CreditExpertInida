import { backendRequest } from "./backendApi";

/**
 * Hands a bureau pull to NodeBankend-Server for saving (`POST /internal/dashboard-reports`).
 *
 * The backend finds or creates the applicant's user by mobile number, parses the raw response
 * with its own parsers, writes the credit report to RDS, archives the raw response and the bureau
 * PDF to S3, and records who pulled the report and for which branch. The pull is recorded for the
 * dashboard even when the bureau has no history for the person or the response cannot be parsed.
 */
export interface SaveReportInput {
  /** Dashboard bureau code: "experian", "crif", "v1", ... */
  bureau: string;
  /** Raw bureau response (the IDSPay body, or its `data` object — the backend accepts both). */
  raw: any;
  name: string;
  mobile: string;
  pan: string;
  gender?: string | null;
  /** YYYY-MM-DD */
  dob?: string | null;
  email?: string | null;
  pdfLink?: string | null;
  creditScore?: number | string | null;
  fallbackData?: any;
  branch: string;
  source: string;
  fetchedByType: string;
  fetchedByName: string;
  fetchedByEmail: string;
  fetchedBy: Record<string, any>;
  /** Import of old records only: Firestore document id (makes the import repeatable) and the original pull time. */
  legacyId?: string;
  createdAt?: Date;
  /** false = record the pull for the dashboard only; the backend creates no user or credit report. Default true. */
  normalize?: boolean;
}

export interface SaveReportResult {
  id: string;
  /** credit_reports.id in RDS, or null when the response was recorded for the dashboard only. */
  creditReportId: string | null;
  score: number | null;
  /** The bureau answered but holds no credit history (no score and no accounts). */
  noHit: boolean;
  /** Why no credit report was created, when none was. */
  skippedReason?: string;
  /** Import only: this document had been imported before and was left untouched. */
  alreadyImported: boolean;
}

/** Drops null / undefined / empty-string values: the backend validates optional fields only when present. */
function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== "")) as Partial<T>;
}

export async function saveBureauReport(input: SaveReportInput): Promise<SaveReportResult> {
  return backendRequest<SaveReportResult>("POST", "", {
    body: compact({
      ...input,
      name: input.name || "N/A",
      mobile: String(input.mobile || ""),
      pan: String(input.pan || ""),
      createdAt: input.createdAt?.toISOString(),
    }),
  });
}
