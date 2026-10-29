import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export interface EmployerResult {
  name: string;
  tier: string;
}

interface IndexedEmployer {
  name: string;
  normalized: string;
  tier: string;
}

const GOVERNMENT_KEYWORDS = [
  /\bschool\b/i,
  /\bpolice\b/i,
  /\bmunicipal\b/i,
  /\bgovernment\b/i,
  /\bgovt\b/i,
  /\buniversity\b/i,
];

let employerIndexCache: IndexedEmployer[] | null = null;

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

async function loadEmployerIndex(): Promise<IndexedEmployer[]> {
  try {
    const indexPath = path.join(process.cwd(), "data", "employerData", "employerIndex.json");
    const listPath = path.join(process.cwd(), "data", "employerData", "searchList.json");

    const [indexRaw, listRaw] = await Promise.all([
      fs.readFile(indexPath, "utf-8"),
      fs.readFile(listPath, "utf-8"),
    ]);

    const indexData: Record<string, string> = JSON.parse(indexRaw);
    const listData: string[] = JSON.parse(listRaw);

    const index: IndexedEmployer[] = [];

    for (const name of listData) {
      const normalized = normalizeEmployerName(name);
      let tier = indexData[normalized] || getHeuristicTier(name);
      index.push({
        name,
        normalized: normalized.toLowerCase(),
        tier,
      });
    }

    return index;
  } catch (error) {
    console.warn("Failed to load employer index:", error);
    return [];
  }
}

async function getEmployerIndex(): Promise<IndexedEmployer[]> {
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

    for (const emp of index) {
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
    }));

    return NextResponse.json({ results: topResults });
  } catch (error) {
    console.error("Employer search API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
