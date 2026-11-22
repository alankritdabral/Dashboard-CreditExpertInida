"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { LeadEmployee } from "@/lib/leads";

const input = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm min-h-[44px] sm:min-h-0";
const empty = { name: "", email: "", phone: "", hrmsId: "", branch: "Delhi", role: "EMPLOYEE", maxOpenLeads: "" };

// Admin: who receives new website leads automatically. Switch someone off while they are away, cap how
// many open leads each person can hold, and mark branch managers (they are never given leads automatically
// and get the alert when a lead cannot be assigned).
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
    // A blank limit leaves the saved one alone; to remove a limit, clear it in the table.
    const { maxOpenLeads, ...rest } = form;
    if (await save({ ...rest, ...(maxOpenLeads !== "" && { maxOpenLeads: Number(maxOpenLeads) }) }, "new")) setForm(empty);
  };

  // The saved person, in the shape the save route needs (name, email and phone are required every time).
  const who = (r: LeadEmployee) => ({ name: r.name, email: r.email, phone: r.phone, hrmsId: r.hrmsId || undefined, branch: r.branch });

  // Inline limit editor: saves when you leave the box. Empty removes the limit.
  const saveLimit = (r: LeadEmployee, raw: string) => {
    const next = raw.trim() === "" ? null : Number(raw);
    if (next === r.maxOpenLeads) return;
    if (next !== null && (!Number.isInteger(next) || next < 0 || next > 1000)) {
      setError("The lead limit must be a whole number from 0 to 1000");
      return;
    }
    save({ ...who(r), maxOpenLeads: next }, r.id);
  };

  const activeCount = rows.filter((r) => r.active).length;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#0A2540]">Lead team</h2>
        <p className="text-sm text-slate-600">
          New website leads go automatically to the active person with the fewest open customers in the lead&apos;s branch (see city rules
          below), skipping anyone at their limit, and the customer gets a WhatsApp with that person&apos;s name and number. {activeCount} active.
        </p>
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email (sign-in)</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">HRMS ID</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Open leads / limit</th>
              <th className="px-4 py-3">Takes new leads</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline text-[#3F8EFC]" /></td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">No employees yet. Add one below, or run the seed script.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3">{r.email}</td>
                <td className="px-4 py-3">{r.phone}</td>
                <td className="px-4 py-3">{r.hrmsId || "—"}</td>
                <td className="px-4 py-3">{r.branch}</td>
                <td className="px-4 py-3">
                  <select
                    value={r.role}
                    disabled={busy === r.id}
                    onChange={(e) => save({ ...who(r), role: e.target.value }, r.id)}
                    aria-label={`${r.name} role`}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold min-h-[44px] sm:min-h-0"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  {r.role === "MANAGER" ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={r.maxOpenLeads != null && r.openCount >= r.maxOpenLeads ? "font-bold text-red-600" : "font-semibold"}>{r.openCount}</span>
                      <span className="text-slate-400">/</span>
                      <input
                        key={`${r.id}:${r.maxOpenLeads ?? ""}`}
                        defaultValue={r.maxOpenLeads ?? ""}
                        inputMode="numeric"
                        placeholder="no limit"
                        aria-label={`${r.name} open-lead limit`}
                        onBlur={(e) => saveLimit(r, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs min-h-[44px] sm:min-h-0"
                      />
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    role="switch"
                    aria-checked={r.active}
                    aria-label={`${r.name} takes new leads`}
                    disabled={busy === r.id}
                    onClick={() => save({ ...who(r), active: !r.active }, r.id)}
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

      <form onSubmit={add} className="bg-white rounded-xl border border-slate-200 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
        <label className="text-xs font-semibold text-slate-600">Name<input className={input} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="text-xs font-semibold text-slate-600">Email<input className={input} required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="text-xs font-semibold text-slate-600">Phone (10 digits)<input className={input} required inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label className="text-xs font-semibold text-slate-600">HRMS ID<input className={input} value={form.hrmsId} onChange={(e) => setForm({ ...form, hrmsId: e.target.value })} /></label>
        <label className="text-xs font-semibold text-slate-600">Branch
          <select className={input} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
            <option>Delhi</option><option>Dehradun</option><option>Rudrapur</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Role
          <select className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Open-lead limit
          <input className={input} inputMode="numeric" placeholder="blank = keep / no limit" value={form.maxOpenLeads} onChange={(e) => setForm({ ...form, maxOpenLeads: e.target.value })} />
        </label>
        <button disabled={busy === "new"} className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0A2540] text-white text-sm font-bold px-4 cursor-pointer disabled:opacity-60">
          {busy === "new" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add / update
        </button>
      </form>
    </section>
  );
}
