import type { Lead } from "@/lib/leads";

// "Hot" = worth calling first. Derived from fields we already store; no extra data needed.
//   salary (40) + EMI burden (30) + freshness (30). Closed leads get no tier.
export type LeadTier = "hot" | "warm" | "cold" | "closed";

const OPEN = new Set(["NEW", "FOLLOW_UP"]);

export function leadScore(l: Lead, now = Date.now()): { score: number; tier: LeadTier } {
  if (!OPEN.has(l.status)) return { score: 0, tier: "closed" };

  const sal = l.netSalary ?? 0;
  const salary = sal >= 100000 ? 40 : sal >= 75000 ? 32 : sal >= 60000 ? 24 : sal > 0 ? 14 : 0;

  // Share of salary already going to EMIs. Unknown (calculator leads) scores neutral.
  const foir = sal > 0 && l.ongoingEmi != null ? l.ongoingEmi / sal : null;
  const burden = foir == null ? 15 : foir <= 0.2 ? 30 : foir <= 0.4 ? 22 : foir <= 0.6 ? 12 : 4;

  const ageH = l.createdAt ? (now - new Date(l.createdAt).getTime()) / 3600000 : 999;
  const fresh = ageH < 1 ? 30 : ageH < 6 ? 24 : ageH < 24 ? 16 : ageH < 72 ? 8 : 0;

  const score = salary + burden + fresh;
  return { score, tier: score >= 70 ? "hot" : score >= 50 ? "warm" : "cold" };
}

// A brand-new lead nobody has touched for a day: the one most likely to go cold.
export const isStale = (l: Lead, now = Date.now()) =>
  l.status === "NEW" && !!l.createdAt && now - new Date(l.createdAt).getTime() > 24 * 3600000;
