export type UserRole = "admin" | "branch";

export type ReportSource = "dashboard_admin" | "dashboard_branch" | "website" | "mobile_app";

export type FetchedByType = "admin" | "branch" | "customer" | "app";

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  branch: string; // e.g. "Rudrapur", "Delhi", "Dehradun", "Head Office", "All"
  employeeId?: string;
  avatar?: string;
  status: "Active" | "Suspended";
  createdAt: string;
  lastLoginAt?: string;
}

export interface UserAccount extends DashboardUser {
  password?: string;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  branch: string;
  createdAt: number;
  expiresAt: number;
}

export interface CreditReportAttribution {
  type: FetchedByType;
  name: string;
  email: string;
  branch: string;
  role?: string;
  employee_id?: string;
  source: ReportSource;
  timestamp: string;
}

export interface CreditReportRecord {
  id: string;
  name: string;
  mobile: string;
  pan: string;
  gender?: string;
  bureau: string;
  credit_score: number | null;
  email?: string | null;
  pdf_link?: string | null;
  raw_api_data?: any;
  created_at: { seconds: number } | string | any;
  branch: string;
  source: ReportSource;
  fetched_by: CreditReportAttribution;
  fetched_by_type: FetchedByType;
  fetched_by_name: string;
  fetched_by_email: string;
  search_tokens?: string[];
  fallbackData?: any;
}

export interface SystemLogEntry {
  id: string;
  timestamp: string | { seconds: number };
  event: string;
  level: "info" | "warn" | "error" | "critical";
  request_id?: string;
  application_id?: string;
  duration_ms?: number;
  provider?: {
    requested?: string;
    fallback?: string;
    http_status?: number;
    error_code?: string;
  };
  identifiers?: {
    pan?: string;
    pan_hash?: string;
    mobile?: string;
    mobile_last4?: string;
  };
  message?: string;
  raw_payload?: any;
}
