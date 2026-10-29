export interface SystemLogPayload {
  level: "info" | "warning" | "error" | "critical";
  event: 
    | "BUREAU_REQUEST_STARTED" 
    | "BUREAU_REQUEST_SUCCESS"
    | "BUREAU_FALLBACK_TRIGGERED"
    | "BUREAU_FALLBACK_SUCCESS"
    | "BUREAU_REQUEST_FAILED"
    | "ALL_BUREAUS_FAILED"
    | "BUREAU_NETWORK_ERROR"
    | string;
  module: string;
  request_id?: string;
  application_id?: string;
  provider?: {
    requested?: string;
    fallback?: string;
    http_status?: number;
    error_code?: string;
  };
  message: string;
  identifiers?: {
    pan?: string;
    mobile?: string;
  };
  duration_ms?: number;
  metadata?: any;
}

export const logSystemEvent = async (payload: SystemLogPayload) => {
  try {
    await fetch("/api/system-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Failed to log system event", error);
  }
};
