/**
 * Employer Lookup Module
 * 
 * Provides employer search and classification by calling the backend API.
 */

export interface EmployerResult {
  name: string;
  tier: string;
}

/**
 * Normalizes an employer name on the client-side for consistency if needed.
 */
export function normalizeEmployerName(name: string): string {
  if (!name) return "";
  let n = name.trim().toUpperCase();
  n = n.replace(/\s*(PRIVATE|PVT|LTD|LIMITED|INC|CORP|CORPORATION|COMPANY|CO)\s*\.?\s*/g, " ");
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

/**
 * Searches for employers by calling the backend API.
 * 
 * @param query The search string (min 2 chars)
 * @returns An array of EmployerResult objects {name, tier}
 */
export async function searchEmployers(query: string): Promise<EmployerResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    const response = await fetch(`/api/employers?q=${encodeURIComponent(query.trim())}`);
    
    if (!response.ok) {
      console.warn("Failed to search employers via API:", response.status);
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.warn("Error searching employers:", error);
    return [];
  }
}
