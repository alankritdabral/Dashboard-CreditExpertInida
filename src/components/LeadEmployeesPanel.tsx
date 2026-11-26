"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { LeadEmployee } from "@/lib/leads";

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-[44px] sm:min-h-0";
const empty = { name: "", email: "", phone: "", hrmsId: "", branch: "Delhi" };

// Admin: who receives new website leads automatically. Switch someone off while they are away.
export function LeadEmployeesPanel() {
  const [rows, setRows] = useState<LeadEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(empty);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/lead-employees", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not load employees");
      setRows(data.employees);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (body: object, key: string) => {
    setBusy(key);
    setError("");
    try {
      const res = await fetch("/api/lead-employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not save");
      await load();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await save(form, "new")) setForm(empty);
  };

  const activeCount = rows.filter((r) => r.active).length;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#2E2E2E]">Lead team</h2>
        <p className="text-sm text-slate-600">
          New website leads go automatically to the active person with the fewest open customers, and the customer gets a WhatsApp with that
          person&apos;s name and number. {activeCount} active.
        </p>
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email (sign-in)</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">HRMS ID</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Takes new leads</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline text-[#FF5A00]" /></td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No employees yet. Add one below, or run the seed script.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3">{r.email}</td>
                <td className="px-4 py-3">{r.phone}</td>
                <td className="px-4 py-3">{r.hrmsId || "—"}</td>
                <td className="px-4 py-3">{r.branch}</td>
                <td className="px-4 py-3">
                  <button
                    role="switch"
                    aria-checked={r.active}
                    aria-label={`${r.name} takes new leads`}
                    disabled={busy === r.id}
                    onClick={() => save({ name: r.name, email: r.email, phone: r.phone, hrmsId: r.hrmsId || undefined, branch: r.branch, active: !r.active }, r.id)}
                    className={`min-h-[44px] sm:min-h-0 px-3 py-1 rounded-full text-xs font-bold cursor-pointer disabled:opacity-60 ${r.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                  >
                    {r.active ? "Active" : "Off"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={add} className="bg-white rounded-xl border border-slate-200 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
        <label className="text-xs font-semibold text-slate-600">Name<input className={input} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="text-xs font-semibold text-slate-600">Email<input className={input} required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="text-xs font-semibold text-slate-600">Phone (10 digits)<input className={input} required inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label className="text-xs font-semibold text-slate-600">HRMS ID<input className={input} value={form.hrmsId} onChange={(e) => setForm({ ...form, hrmsId: e.target.value })} /></label>
        <label className="text-xs font-semibold text-slate-600">Branch
          <select className={input} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
            <option>Delhi</option><option>Dehradun</option><option>Rudrapur</option>
          </select>
        </label>
        <button disabled={busy === "new"} className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2E2E2E] text-white text-sm font-bold px-4 cursor-pointer disabled:opacity-60">
          {busy === "new" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add / update
        </button>
      </form>
    </section>
  );
}
