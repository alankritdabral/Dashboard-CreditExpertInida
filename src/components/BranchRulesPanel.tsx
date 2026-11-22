"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

const BRANCHES = ["Delhi", "Dehradun", "Rudrapur"];
const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-[44px] sm:min-h-0";

interface Rule {
  city: string;
  branch: string;
}

// Admin: which branch a lead's city goes to. A city with no rule is not tied to a branch: it goes to
// whoever has the fewest open leads across all branches.
export function BranchRulesPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [city, setCity] = useState("");
  const [branch, setBranch] = useState(BRANCHES[0]);

  const [reload, setReload] = useState(0); // bump to fetch the list again

  useEffect(() => {
    let alive = true;
    fetch("/api/branch-rules", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (!data.success) throw new Error(data.error || "Could not load city rules");
        setRules(data.rules);
        setError("");
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Could not load city rules"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reload]);

  const send = async (method: "POST" | "DELETE", body: object, key: string) => {
    setBusy(key);
    setError("");
    try {
      const res = await fetch("/api/branch-rules", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not save");
      setReload((n) => n + 1);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await send("POST", { city, branch }, "new")) setCity("");
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#0A2540]">City rules</h2>
        <p className="text-sm text-slate-600">
          A lead from a listed city goes to that branch&apos;s team first. Spelling, capitals and punctuation do not matter. A city that is not
          listed goes to whoever has the fewest open leads across all branches. If the branch has nobody free, the lead waits as unassigned
          and the branch managers are told.
        </p>
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3 w-16"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline text-[#3F8EFC]" /></td></tr>
            )}
            {!loading && rules.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">No rules yet, so leads are shared across all branches.</td></tr>
            )}
            {rules.map((r) => (
              <tr key={r.city} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-semibold capitalize">{r.city}</td>
                <td className="px-4 py-3">
                  <select
                    value={r.branch}
                    disabled={busy === r.city}
                    onChange={(e) => send("POST", { city: r.city, branch: e.target.value }, r.city)}
                    aria-label={`Branch for ${r.city}`}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold min-h-[44px] sm:min-h-0"
                  >
                    {BRANCHES.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => send("DELETE", { city: r.city }, r.city)}
                    disabled={busy === r.city}
                    aria-label={`Remove rule for ${r.city}`}
                    className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-red-600 cursor-pointer disabled:opacity-60"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={add} className="bg-white rounded-xl border border-slate-200 p-4 grid gap-3 sm:grid-cols-3 items-end">
        <label className="text-xs font-semibold text-slate-600">City
          <input className={input} required maxLength={100} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Haridwar" />
        </label>
        <label className="text-xs font-semibold text-slate-600">Branch
          <select className={input} value={branch} onChange={(e) => setBranch(e.target.value)}>
            {BRANCHES.map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <button disabled={busy === "new"} className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0A2540] text-white text-sm font-bold px-4 cursor-pointer disabled:opacity-60">
          {busy === "new" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add / update
        </button>
      </form>
    </section>
  );
}
