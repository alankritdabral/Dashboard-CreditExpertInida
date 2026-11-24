/**
 * Client for NodeBankend-Server's internal dashboard API (`/internal/dashboard-reports`).
 *
 * The database (RDS) is private to the backend's network, so the dashboard never connects to it.
 * It hands every bureau pull to the backend, which parses it, saves it to RDS, archives it to S3,
 * and serves the report lists back.
 *
 * Environment:
 *   BACKEND_API_URL  Backend base URL including its prefix, e.g. https://api.example.com/api/v1
 *   BACKEND_API_KEY  Shared secret; must equal DASHBOARD_API_KEY in the backend's .env
 */

export class BackendNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Backend API is not configured. Missing environment variable(s): ${missing.join(", ")}`);
    this.name = "BackendNotConfiguredError";
  }
}

export class BackendApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

/** HTTP status a dashboard route should answer with when a backend call fails. */
export function backendErrorStatus(err: unknown): number {
  if (err instanceof BackendNotConfiguredError) return 503;
  if (err instanceof BackendApiError) return 502;
  return 500;
}

type QueryValue = string | number | boolean | null | undefined;

export async function backendRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  options: { query?: Record<string, QueryValue>; body?: unknown; basePath?: string } = {},
): Promise<T> {
  const baseUrl = (process.env.BACKEND_API_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.BACKEND_API_KEY || "";
  const missing = [!baseUrl && "BACKEND_API_URL", !apiKey && "BACKEND_API_KEY"].filter(Boolean) as string[];
  if (missing.length > 0) throw new BackendNotConfiguredError(missing);

  const url = new URL(`${baseUrl}${options.basePath ?? "/internal/dashboard-reports"}${path}`);
  Object.entries(options.query || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "x-internal-api-key": apiKey,
        ...(options.body !== undefined && { "Content-Type": "application/json" }),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    throw new BackendApiError(0, `Could not reach the backend API: ${(err as Error).message}`);
  }

  // The backend wraps every answer as { success, data, error: { message } }.
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) {
    throw new BackendApiError(res.status, payload?.error?.message || `Backend API answered HTTP ${res.status}`);
  }
  return payload.data as T;
}
