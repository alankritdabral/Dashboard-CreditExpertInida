import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export interface EmployerBankCategory {
  key: string;      // lender id used by lenderEngine (e.g. "kotak"), or a bank not in the engine (e.g. "idfc")
  label: string;    // display name, e.g. "Kotak Mahindra Bank"
  category: string; // category exactly as listed in that bank's employer sheet
}

export interface EmployerResult {
  name: string;
  tier: string;
  bankCategories: EmployerBankCategory[];
}

interface IndexedEmployer {
  name: string;
  normalized: string;
  tier: string;
  codes: string; // "bankIdx:catIdx;bankIdx:catIdx" from employerBankCategories.json
}

interface BankCategoryFile {
  banks: { key: string; label: string; sheet: string }[];
  cats: string[][];
  employers: [string, string][];
}

interface EmployerIndex {
  banks: BankCategoryFile["banks"];
  cats: string[][];
  employers: IndexedEmployer[];
}

const GOVERNMENT_KEYWORDS = [
  /\bschool\b/i,
  /\bpolice\b/i,
  /\bmunicipal\b/i,
  /\bgovernment\b/i,
  /\bgovt\b/i,
  /\buniversity\b/i,
];

let employerIndexCache: EmployerIndex | null = null;

function normalizeEmployerName(name: string): string {
  if (!name) return "";
  let n = name.trim().toUpperCase();
  n = n.replace(/\s*(PRIVATE|PVT|LTD|LIMITED|INC|CORP|CORPORATION|COMPANY|CO)\s*\.?\s*/g, " ");
  return n.replace(/\s+/g, " ").trim();
}

function getHeuristicTier(name: string): string {
  for (const regex of GOVERNMENT_KEYWORDS) {
    if (regex.test(name)) return "GOVT";
  }
  return "Unknown";
}

/**
 * Loads the unified tier index (employerIndex.json) plus the per-bank category
 * listing (employerBankCategories.json, built by
 * scripts/build-employer-bank-categories.py from the "ALL BANK LISTING" workbook).
 */
async function loadEmployerIndex(): Promise<EmployerIndex> {
  try {
    const indexPath = path.join(process.cwd(), "data", "employerData", "employerIndex.json");
    const bankPath = path.join(process.cwd(), "data", "employerData", "employerBankCategories.json");

    const [indexRaw, bankRaw] = await Promise.all([
      fs.readFile(indexPath, "utf-8"),
      fs.readFile(bankPath, "utf-8"),
    ]);

    const indexData: Record<string, string> = JSON.parse(indexRaw);
    const bankData: BankCategoryFile = JSON.parse(bankRaw);

    const employers: IndexedEmployer[] = [];

    for (const [name, codes] of bankData.employers) {
      const normalized = normalizeEmployerName(name);
      const tier = indexData[normalized] || getHeuristicTier(name);
      employers.push({
        name,
        normalized: normalized.toLowerCase(),
        tier,
        codes,
      });
    }

    return { banks: bankData.banks, cats: bankData.cats, employers };
  } catch (error) {
    console.warn("Failed to load employer index:", error);
    return { banks: [], cats: [], employers: [] };
  }
}

function decodeBankCategories(index: EmployerIndex, codes: string): EmployerBankCategory[] {
  if (!codes) return [];
  const out: EmployerBankCategory[] = [];
  for (const pair of codes.split(";")) {
    const [bankIdx, catIdx] = pair.split(":").map(Number);
    const bank = index.banks[bankIdx];
    const category = index.cats[bankIdx]?.[catIdx];
    if (bank && category) {
      out.push({ key: bank.key, label: bank.label, category });
    }
  }
  return out;
}

async function getEmployerIndex(): Promise<EmployerIndex> {
  if (!employerIndexCache) {
    employerIndexCache = await loadEmployerIndex();
  }
  return employerIndexCache;
}

function getMatchRank(name: string, normalized: string, query: string, normalizedQuery: string): number {
  if (normalized === normalizedQuery) return 0;
  if (normalized.startsWith(normalizedQuery)) return 1;

  const words = normalized.split(/\s+/);
  if (words.some((word) => word.startsWith(normalizedQuery))) {
    return 2;
  }

  if (normalized.includes(normalizedQuery)) return 3;
  return 4;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";

    if (query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    if (query.length > 100) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    const index = await getEmployerIndex();
    const normalizedQuery = normalizeEmployerName(query).toLowerCase();

    const rankedResults: { employer: IndexedEmployer; rank: number }[] = [];

    for (const emp of index.employers) {
      const rank = getMatchRank(emp.name, emp.normalized, query, normalizedQuery);
      if (rank < 4) {
        rankedResults.push({ employer: emp, rank });
      }
    }

    rankedResults.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.employer.name.localeCompare(b.employer.name);
    });

    const topResults: EmployerResult[] = rankedResults.slice(0, 50).map((r) => ({
      name: r.employer.name,
      tier: r.employer.tier,
      bankCategories: decodeBankCategories(index, r.employer.codes),
    }));

    return NextResponse.json({ results: topResults });
  } catch (error) {
    console.error("Employer search API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
