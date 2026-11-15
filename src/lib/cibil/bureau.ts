/** The three bureaus NodeBankend-Server can parse. */
export type BureauKind = "experian" | "crif" | "transunion";

/**
 * Maps a dashboard bureau code to the bureau it belongs to.
 * Dashboard codes: "experian", "crif", "v1" (TransUnion CIBIL), plus older variants such as
 * "crif_v1" or "experian_json". Returns null for codes the backend has no parser for (e.g. "v2" Equifax).
 */
export function bureauKind(code: string | null | undefined): BureauKind | null {
  const c = String(code || "").toLowerCase();
  if (c.startsWith("experian")) return "experian";
  if (c.startsWith("crif")) return "crif";
  if (c.startsWith("v1") || c.startsWith("transunion") || c.startsWith("cibil")) return "transunion";
  return null;
}

/**
 * Decides whether an IDSPay response is a usable report, using the same rules as
 * `CibilService.callBureau` in NodeBankend-Server. IDSPay can answer HTTP 200 with a failure body
 * (e.g. `mobile_not_match`), so the HTTP status alone is not enough.
 *
 * @returns null when the response holds a report, otherwise the reason it does not.
 */
export function bureauFailureReason(kind: BureauKind, httpOk: boolean, data: any): string | null {
  const providerMessage = (): string => {
    const m = data?.message || data?.error;
    return typeof m === "string" && m ? m : "The bureau did not return a report.";
  };

  if (!httpOk || !data || typeof data !== "object") return providerMessage();

  if (kind === "crif") {
    return data.data || data["INDV-REPORT-FILE"] || data.SCORE ? null : providerMessage();
  }

  if (data.status_code === 422 || data.message_code === "mobile_not_match") return providerMessage();

  if (kind === "experian") {
    return data.data?.result_json ? null : providerMessage();
  }

  // TransUnion CIBIL
  if (data.status?.type === "success" && !data.data?.steps && !data.data?.result_json) return providerMessage();
  return data.data?.steps || data.report_summary ? null : providerMessage();
}
