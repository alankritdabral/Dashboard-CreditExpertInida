import { BackendApiError, backendRequest } from "./backendApi";

/**
 * Read / delete side of the dashboard's credit-report records, served by NodeBankend-Server.
 * Rows are returned in the shape the screens already consumed from Firestore
 * (`credit_score`, `fetched_by_email`, `created_at: { seconds }`, ...).
 */

/** A pull as the backend returns it. */
interface BackendReport {
  id: string;
  name: string | null;
  mobile: string | null;
  pan: string;
  bureau: string | null;
  creditScore: number | null;
  branch: string | null;
  source: string;
  fetchedByType: string | null;
  fetchedByName: string | null;
  fetchedByEmail: string | null;
  fetchedBy: Record<string, any> | null;
  fallbackData: any;
  createdAt: string;
}

interface BackendReportDetail extends BackendReport {
  gender: string | null;
  email: string | null;
  pdfLink: string | null;
  rawApiData: any;
  creditReportId: string | null;
}

function toRecord(row: BackendReport) {
  const createdAt = new Date(row.createdAt);
  const fetchedByType =
    row.fetchedByType || (row.branch === "admin" ? "admin" : row.branch === "customer" ? "customer" : "branch");
  const fetchedByName =
    row.fetchedByName ||
    (fetchedByType === "admin" ? "Admin" : fetchedByType === "customer" ? row.name || "Website Customer" : `${row.branch || "Branch"} Staff`);
  return {
    id: row.id,
    name: row.name || "N/A",
    mobile: row.mobile || "N/A",
    pan: row.pan || "N/A",
    bureau: row.bureau || "v1",
    credit_score: row.creditScore,
    branch: row.branch || "Online",
    source: row.source,
    fetched_by_type: fetchedByType,
    fetched_by_name: fetchedByName,
    fetched_by_email: row.fetchedByEmail || "N/A",
    fetched_by: row.fetchedBy || {
      type: fetchedByType,
      name: fetchedByName,
      email: row.fetchedByEmail || "N/A",
      branch: row.branch || "Online",
      source: row.source,
      timestamp: createdAt.toISOString(),
    },
    search_tokens: [] as string[],
    fallbackData: row.fallbackData ?? null,
    created_at: { seconds: Math.floor(createdAt.getTime() / 1000) },
  };
}

export interface ListReportsParams {
  /** Employee view: only reports this person pulled. */
  ownerEmail?: string | null;
  branch?: string | null;
  source?: string | null;
  bureau?: string | null;
  /** PAN (exact), mobile digits, or part of a name. */
  q?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  pageSize: number;
  /** Opaque value from a previous page's `nextCursor`. */
  cursor?: string | null;
  withTotal?: boolean;
}

export async function listReports(params: ListReportsParams) {
  const page = await backendRequest<{ reports: BackendReport[]; hasMore: boolean; nextCursor: string | null; total?: number }>("GET", "", {
    query: {
      ownerEmail: params.ownerEmail,
      branch: params.branch,
      source: params.source,
      bureau: params.bureau,
      q: params.q,
      startDate: params.startDate,
      endDate: params.endDate,
      pageSize: params.pageSize,
      cursor: params.cursor,
      withTotal: params.withTotal ? "1" : undefined,
    },
  });
  return {
    reports: page.reports.map(toRecord),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
    ...(page.total !== undefined && { total: page.total }),
  };
}

/** Full report including the raw bureau response, for the report viewer. Null when it does not exist. */
export async function getReport(id: string) {
  let row: BackendReportDetail;
  try {
    row = await backendRequest<BackendReportDetail>("GET", `/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 404) return null;
    throw err;
  }
  return {
    ...toRecord(row),
    gender: row.gender,
    email: row.email,
    pdf_link: row.pdfLink,
    raw_api_data: row.rawApiData ?? null,
    credit_report_id: row.creditReportId,
  };
}

/**
 * Permanently deletes a pull: the dashboard record and the credit report it produced in RDS.
 * The applicant's user is kept.
 */
export async function deleteReport(id: string): Promise<boolean> {
  const result = await backendRequest<{ deleted: boolean }>("DELETE", `/${encodeURIComponent(id)}`);
  return result.deleted;
}

/** Total pulls and pulls per branch (branch names merged case-insensitively, keyed in lowercase). */
export async function reportStats() {
  return backendRequest<{ total: number; byBranch: Record<string, number> }>("GET", "/stats");
}

export interface ActivityFilter {
  branch?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

/** Pulls per employee email. `unattributed` counts pulls with no staff email on record. */
export async function pullCountsByEmployee(filter: ActivityFilter = {}) {
  return backendRequest<{ counts: Record<string, { name: string; count: number }>; unattributed: number }>("GET", "/pull-counts", {
    query: { branch: filter.branch, startDate: filter.startDate, endDate: filter.endDate },
  });
}

/** Latest pulls for one employee or one branch, newest first. */
export async function pullHistory(by: { email?: string; branch?: string }, filter: ActivityFilter, limit: number) {
  const { reports } = await backendRequest<{ reports: BackendReport[] }>("GET", "/history", {
    query: { email: by.email, branch: by.branch, startDate: filter.startDate, endDate: filter.endDate, limit },
  });
  return reports.map((row) => {
    const r = toRecord(row);
    return {
      id: r.id,
      name: r.name,
      mobile: r.mobile,
      pan: r.pan,
      bureau: r.bureau,
      credit_score: r.credit_score,
      branch: r.branch,
      fetched_by_name: row.fetchedByName || "N/A",
      fetched_by_email: r.fetched_by_email,
      created_at: r.created_at,
    };
  });
}
