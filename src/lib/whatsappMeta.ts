import { NextRequest, NextResponse } from "next/server";
import { BackendApiError, BackendNotConfiguredError, backendRequest } from "@/lib/cibil/backendApi";
import { verifySessionToken } from "@/lib/user-service";
import type { UserSession } from "@/lib/types";

// WhatsApp through Meta's Cloud API. All state lives in the backend (RDS); Meta credentials live
// only there too. This module is the dashboard's thin, authenticated proxy.
const BASE = "/internal/whatsapp";

export type QueryValue = string | number | undefined;

export function metaRequest<T>(method: "GET" | "POST", path: string, opts: { query?: Record<string, QueryValue>; body?: unknown } = {}) {
  return backendRequest<T>(method, path, { basePath: BASE, ...opts });
}

/**
 * Admin only for now: the dashboard still has a temporary password-less login for non-lead-team
 * staff, so customer conversations are not exposed to branch sessions until real login is back.
 */
export function requireWhatsappAdmin(req: NextRequest): { session: UserSession } | { error: NextResponse } {
  const token = req.cookies.get("credit_dashboard_session")?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session) return { error: NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 }) };
  if (session.role !== "admin") return { error: NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 }) };
  return { session };
}

/** Backend errors carry a readable message (e.g. "The 24-hour reply window is closed"); pass it on. */
export function metaError(err: unknown, fallback: string) {
  if (err instanceof BackendNotConfiguredError) return NextResponse.json({ success: false, error: err.message }, { status: 503 });
  if (err instanceof BackendApiError) {
    const status = err.status >= 400 && err.status < 500 ? err.status : 502;
    return NextResponse.json({ success: false, error: err.message || fallback }, { status });
  }
  console.error(fallback, err);
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}

// ---- Shapes returned by the backend (client-safe types) ----

export interface MetaStatus {
  connection: "NOT_CONFIGURED" | "CONNECTED" | "NEEDS_ATTENTION";
  configured: boolean;
  missing: string[];
  apiVersion: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  sendingEnabled: boolean;
  webhookConfigured: boolean;
  lastWebhookAt: string | null;
  lastTemplateSyncAt: string | null;
  approvedTemplates: number;
  failedWebhookEvents: number;
  error?: string;
  phone?: { displayNumber: string; verifiedName: string; nameStatus: string; qualityRating: string; platformType: string; messagingLimitTier: string | null; throughput: string | null };
  waba?: { name: string; currency: string; businessVerification: string | null };
  subscribedApps?: string[];
}

export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: { type: string; format?: string; text?: string; buttons?: { type: string; text: string; url?: string }[] }[];
  rejectedReason: string | null;
  lastSyncedAt: string;
}

export interface MetaConversation {
  id: string;
  waId: string;
  phoneKey: string;
  profileName: string | null;
  leadName: string | null;
  leadStatus: string | null;
  assignedToEmail: string | null;
  assignedToName: string | null;
  status: string;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  lastPreview: string | null;
  unreadCount: number;
  windowOpen: boolean;
  windowEndsAt: string | null;
  optedOut?: boolean;
}

export interface MetaMessage {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  textBody: string | null;
  templateName: string | null;
  templateParams: { body?: string[] } | null;
  media: { kind: string; filename: string | null; caption: string | null } | null;
  status: string;
  errorMessage: string | null;
  sentByEmail: string | null;
  createdAt: string;
}
