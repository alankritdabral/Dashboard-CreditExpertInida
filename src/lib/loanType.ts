/**
 * Maps a bureau account type (e.g. "02 - Housing Loan", "Auto Loan (Personal)")
 * to the loan type names used by the eligibility engine / loan type dropdown.
 * Order matters: more specific names are checked before generic ones, and
 * "car" is matched as a whole word so "Credit Card" is never read as a car loan.
 */
export function classifyLoanType(accountType: string | undefined | null): string {
  const name = String(accountType || "")
    .replace(/^\s*\d+\s*-\s*/, "") // strip bureau code prefix like "10 - "
    .toLowerCase();
  if (!name) return "Unknown";

  if (/\bapp loan\b/.test(name)) return "App Loan";
  if (/credit card|fleet card|\bcard\b/.test(name)) return "Credit Card";
  if (/overdraft/.test(name)) return "Overdraft";
  if (/gold/.test(name)) return "Gold Loan";
  if (/education/.test(name)) return "Education Loan";
  if (/housing|\bhome\b|pmay|clss/.test(name)) return "Home Loan";
  if (/property|\blap\b/.test(name)) return "LAP";
  if (/\bauto\b|\bcar\b|vehicle|two[- ]?wheeler|tractor|construction equipment/.test(name)) return "Car Loan";
  if (/consumer/.test(name)) return "Consumer Loan";
  if (/personal/.test(name)) return "Personal Loan";
  return "Unknown";
}
