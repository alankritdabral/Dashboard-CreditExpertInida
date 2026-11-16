"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flame, Loader2, Phone, RefreshCw, Search, Users, X } from "lucide-react";
import type { Lead, LeadStatus } from "@/lib/leads";
import { isStale, leadScore } from "@/lib/leadScore";

const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  FOLLOW_UP: "Follow up",
  CONVERTED: "Converted",
  NOT_INTERESTED: "Not interested",
};
const POLL_MS = 8000;
const STATUSES = Object.keys(STATUS_LABEL) as LeadStatus[];

interface Employee {
  name: string;
  email: string;
  status?: string;
  role?: string;
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const rupees = (n: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`);

// Admin: all leads + assign each to one employee. Employee: own leads only.
export function LeadsPanel({ isAdmin }: { isAdmin: boolean }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unassigned" | string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"hot" | "newest" | "oldest" | "salary">("hot");
  const [statusF, setStatusF] = useState<"all" | LeadStatus>("all");
  const [tierF, setTierF] = useState<"all" | "hot">("all");
  const [range, setRange] = useState<"all" | "today" | "7d" | "30d">("all");
  const [now, setNow] = useState(() => Date.now());

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState(false); // employee picker open
  const [pickedEmps, setPickedEmps] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [fresh, setFresh] = useState<Set<string>>(new Set()); // arrived since the page opened
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const knownIds = useRef<Set<string> | null>(null);

  // silent=true is the background poll: no spinner, no error flash, and anything not
  // seen before is flagged as new.
  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const res = await fetch("/api/leads", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not load leads");
      const list: Lead[] = data.leads;
      const known = knownIds.current;
      if (known) {
        const added = list.filter((l) => !known.has(l.id)).map((l) => l.id);
        if (added.length) setFresh((prev) => new Set([...prev, ...added]));
      }
      knownIds.current = new Set(list.map((l) => l.id));
      setLeads(list);
      setUpdatedAt(new Date());
      setNow(Date.now());
    } catch (e: any) {
      if (!silent) setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const tick = () => document.visibilityState === "visible" && load(true);
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/branch/users")
      .then((r) => r.json())
      .then((d) => d.success && setEmployees(d.users.filter((u: Employee) => u.role !== "admin" && u.status !== "Suspended")))
      .catch(() => {});
  }, [isAdmin]);

  const patch = async (id: string, body: object) => {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Update failed");
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead : l)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const assignEvenly = async () => {
    setBulkBusy(true);
    setError("");
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [...selected], employeeEmails: [...pickedEmps] }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Assignment failed");
      const r = data.result;
      const names = new Map(employees.map((e) => [e.email.toLowerCase(), e.name]));
      const parts = Object.entries(r.assigned).map(([em, n]) => `${names.get(em) || em}: ${n}`);
      let msg = `Assigned — ${parts.join(", ")}.`;
      if (r.keptWithOwner.length) msg += ` ${r.keptWithOwner.length} repeat customer(s) stayed with their current employee.`;
      setNotice(msg);
      setSelected(new Set());
      setPicking(false);
      await load(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBulkBusy(false);
    }
  };

  const scored = useMemo(() => new Map(leads.map((l) => [l.id, leadScore(l, now)])), [leads, now]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const startOfToday = new Date(now).setHours(0, 0, 0, 0);
    const since = range === "today" ? startOfToday : range === "7d" ? now - 7 * 86400000 : range === "30d" ? now - 30 * 86400000 : 0;
    const list = leads.filter((l) => {
      if (filter === "unassigned" && l.assignedToEmail) return false;
      if (filter !== "all" && filter !== "unassigned" && l.assignedToEmail !== filter) return false;
      if (statusF !== "all" && l.status !== statusF) return false;
      if (tierF === "hot" && scored.get(l.id)?.tier !== "hot") return false;
      if (since && (!l.createdAt || new Date(l.createdAt).getTime() < since)) return false;
      return !q || `${l.name} ${l.phone} ${l.requirement} ${l.assignedToName || ""}`.toLowerCase().includes(q);
    });
    const t = (l: Lead) => (l.createdAt ? new Date(l.createdAt).getTime() : 0);
    return list.sort((a, b) => {
      if (sort === "oldest") return t(a) - t(b);
      if (sort === "salary") return (b.netSalary ?? 0) - (a.netSalary ?? 0) || t(b) - t(a);
      if (sort === "hot") return (scored.get(b.id)?.score ?? 0) - (scored.get(a.id)?.score ?? 0) || t(b) - t(a);
      return t(b) - t(a);
    });
  }, [leads, filter, query, sort, statusF, tierF, range, scored, now]);

  const stats = useMemo(() => {
    const today = new Date(now).setHours(0, 0, 0, 0);
    return {
      total: leads.length,
      today: leads.filter((l) => l.createdAt && new Date(l.createdAt).getTime() >= today).length,
      hot: leads.filter((l) => scored.get(l.id)?.tier === "hot").length,
      stale: leads.filter((l) => isStale(l, now)).length,
    };
  }, [leads, scored, now]);

  const unassigned = leads.filter((l) => !l.assignedToEmail).length;
  const visibleUnassigned = visible.filter((l) => !l.assignedToEmail);
  const perEmployee = pickedEmps.size ? Math.ceil(selected.size / pickedEmps.size) : 0;
  const field =
    "min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 text-base sm:text-xs font-medium text-slate-900 focus:outline-none focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20";

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total leads", value: stats.total, onClick: () => { setTierF("all"); setRange("all"); } },
          { label: "Today", value: stats.today, onClick: () => { setRange("today"); setTierF("all"); } },
          { label: "Hot", value: stats.hot, hot: true, onClick: () => { setTierF("hot"); setSort("hot"); } },
          { label: "Untouched 24h+", value: stats.stale, onClick: () => { setStatusF("NEW"); setSort("oldest"); setRange("all"); } },
        ].map((c) => (
          <button
            key={c.label}
            onClick={c.onClick}
            className="min-h-[44px] text-left bg-white border border-slate-200/90 rounded-2xl px-4 py-3 shadow-sm cursor-pointer hover:border-[#3F8EFC]/50"
          >
            <span className="block text-[11px] font-semibold text-slate-500">{c.label}</span>
            <span className={`block text-2xl font-bold ${c.hot ? "text-orange-600" : "text-[#0A2540]"}`}>{c.value}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3 bg-white border border-slate-200/90 p-4 rounded-3xl shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, mobile, requirement…"
            className={`${field} w-full pl-10`}
          />
        </div>
        {isAdmin && (
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={field} aria-label="Filter leads">
            <option value="all">All leads ({leads.length})</option>
            <option value="unassigned">Unassigned ({unassigned})</option>
            {employees.map((e) => (
              <option key={e.email} value={e.email.toLowerCase()}>
                {e.name}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => load()}
          disabled={loading}
          className="min-h-[44px] px-4 inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={field} aria-label="Sort leads">
          <option value="hot">Sort: Hottest first</option>
          <option value="newest">Sort: Newest first</option>
          <option value="oldest">Sort: Oldest first</option>
          <option value="salary">Sort: Salary high → low</option>
        </select>
        <select value={range} onChange={(e) => setRange(e.target.value as typeof range)} className={field} aria-label="Date range">
          <option value="all">Any date</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)} className={field} aria-label="Status">
          <option value="all">Any status</option>
          {STATUSES.map((st) => (
            <option key={st} value={st}>
              {STATUS_LABEL[st]}
            </option>
          ))}
        </select>
        <button
          onClick={() => setTierF((t) => (t === "hot" ? "all" : "hot"))}
          aria-pressed={tierF === "hot"}
          className={`min-h-[44px] px-4 inline-flex items-center gap-1.5 rounded-xl text-xs font-bold cursor-pointer border ${
            tierF === "hot" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-slate-700 border-slate-200"
          }`}
        >
          <Flame className="w-3.5 h-3.5" /> Hot only
        </button>
        {(statusF !== "all" || tierF !== "all" || range !== "all" || query) && (
          <button
            onClick={() => { setStatusF("all"); setTierF("all"); setRange("all"); setQuery(""); }}
            className="min-h-[44px] px-3 text-xs font-bold text-[#3F8EFC] cursor-pointer"
          >
            Reset filters
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-500">
          Showing {visible.length} of {leads.length}
        </span>
      </div>

      {error && <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}

      {notice && (
        <p className="flex items-start justify-between gap-3 text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss" className="min-h-[44px] min-w-[44px] -my-3 -mr-3 inline-flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </p>
      )}

      {fresh.size > 0 && (
        <p className="flex items-center justify-between gap-3 text-sm font-semibold text-[#0A2540] bg-[#3F8EFC]/10 border border-[#3F8EFC]/30 rounded-xl px-4 py-3" role="status">
          <span>
            {fresh.size} new lead{fresh.size > 1 ? "s" : ""} just arrived
          </span>
          <button onClick={() => setFresh(new Set())} className="min-h-[44px] px-2 text-xs font-bold text-[#3F8EFC] cursor-pointer">
            Mark as seen
          </button>
        </p>
      )}

      <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500 px-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live
          {updatedAt ? ` · updated ${updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
        </span>
        {isAdmin && visibleUnassigned.length > 0 && (
          <button
            onClick={() =>
              setSelected((prev) => {
                const ids = visibleUnassigned.map((l) => l.id);
                const all = ids.every((id) => prev.has(id));
                const n = new Set(prev);
                ids.forEach((id) => (all ? n.delete(id) : n.add(id)));
                return n;
              })
            }
            className="min-h-[44px] px-2 text-xs font-bold text-[#3F8EFC] cursor-pointer"
          >
            {visibleUnassigned.every((l) => selected.has(l.id)) ? "Clear unassigned" : `Select all unassigned (${visibleUnassigned.length})`}
          </button>
        )}
      </div>

      {!loading && visible.length === 0 && (
        <p className="text-center text-sm text-slate-500 bg-white border border-slate-200/90 rounded-3xl py-12">
          {isAdmin ? "No leads match." : "No leads have been assigned to you yet."}
        </p>
      )}

      <ul className="space-y-3">
        {visible.map((l) => {
          const digits = l.phone.replace(/\D/g, "").slice(-10);
          return (
            <li
              key={l.id}
              className={`bg-white border rounded-3xl p-4 sm:p-5 shadow-sm ${
                fresh.has(l.id) ? "border-[#3F8EFC] ring-2 ring-[#3F8EFC]/20" : selected.has(l.id) ? "border-[#3F8EFC]/60" : "border-slate-200/90"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                {isAdmin && (
                  <label className="min-h-[44px] min-w-[44px] -m-3 inline-flex items-center justify-center cursor-pointer shrink-0 self-start">
                    <input
                      type="checkbox"
                      checked={selected.has(l.id)}
                      onChange={() => toggle(l.id)}
                      aria-label={`Select ${l.name}`}
                      className="w-4 h-4 accent-[#3F8EFC]"
                    />
                  </label>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-bold text-[#0A2540] truncate">
                    {l.name}
                    {scored.get(l.id)?.tier === "hot" && (
                      <span className="ml-2 align-middle inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">
                        <Flame className="w-3 h-3" /> Hot
                      </span>
                    )}
                    {scored.get(l.id)?.tier === "warm" && (
                      <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">Warm</span>
                    )}
                    {isStale(l, now) && (
                      <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-600 rounded-full px-2 py-0.5">Untouched 24h+</span>
                    )}
                    {fresh.has(l.id) && (
                      <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wide bg-[#3F8EFC] text-white rounded-full px-2 py-0.5">New</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-600">
                    {l.requirement} · Salary {rupees(l.netSalary)} · EMI {rupees(l.ongoingEmi)}
                    {l.city ? ` · ${l.city}` : ""}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {fmtDate(l.createdAt)} · {l.source}
                    {l.assignedToName ? ` · Assigned to ${l.assignedToName}` : " · Unassigned"}
                  </p>
                  {digits && (
                    <a
                      href={`tel:+91${digits}`}
                      className="inline-flex items-center gap-1.5 mt-1 min-h-[44px] sm:min-h-0 text-xs font-bold text-[#3F8EFC]"
                    >
                      <Phone className="w-3.5 h-3.5" /> {l.phone}
                    </a>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  {isAdmin && (
                    <select
                      value={l.assignedToEmail || ""}
                      disabled={busyId === l.id}
                      onChange={(e) => patch(l.id, { assignTo: e.target.value || null })}
                      className={field}
                      aria-label={`Assign ${l.name}`}
                    >
                      <option value="">Unassigned</option>
                      {employees.map((e) => (
                        <option key={e.email} value={e.email.toLowerCase()}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    value={l.status}
                    disabled={busyId === l.id}
                    onChange={(e) => patch(l.id, { status: e.target.value })}
                    className={field}
                    aria-label={`Status for ${l.name}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {isAdmin && selected.size > 0 && (
        <div className="sticky bottom-3 z-20 bg-[#0A2540] text-white rounded-2xl shadow-xl p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold">{selected.size} selected</span>
            <div className="flex gap-2">
              <button onClick={() => setSelected(new Set())} className="min-h-[44px] px-3 text-xs font-bold text-white/80 cursor-pointer">
                Clear
              </button>
              <button
                onClick={() => {
                  setPicking((v) => !v);
                  if (!pickedEmps.size) setPickedEmps(new Set(employees.map((e) => e.email.toLowerCase())));
                }}
                className="min-h-[44px] px-4 inline-flex items-center gap-1.5 bg-[#3F8EFC] text-xs font-bold rounded-xl cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" /> Assign evenly…
              </button>
            </div>
          </div>
          {picking && (
            <div className="space-y-3 border-t border-white/15 pt-3">
              <div className="flex flex-wrap gap-2">
                {employees.map((e) => {
                  const key = e.email.toLowerCase();
                  const on = pickedEmps.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() =>
                        setPickedEmps((prev) => {
                          const n = new Set(prev);
                          if (n.has(key)) n.delete(key);
                          else n.add(key);
                          return n;
                        })
                      }
                      aria-pressed={on}
                      className={`min-h-[44px] px-3.5 rounded-full text-xs font-semibold cursor-pointer border ${
                        on ? "bg-white text-[#0A2540] border-white" : "bg-transparent text-white/80 border-white/30"
                      }`}
                    >
                      {e.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-white/70">
                  {pickedEmps.size
                    ? `${selected.size} leads → ${pickedEmps.size} employee${pickedEmps.size > 1 ? "s" : ""}, about ${Math.floor(selected.size / pickedEmps.size)}–${perEmployee} each`
                    : "Pick at least one employee"}
                </span>
                <button
                  onClick={assignEvenly}
                  disabled={bulkBusy || !pickedEmps.size}
                  className="min-h-[44px] px-4 inline-flex items-center gap-1.5 bg-emerald-500 disabled:opacity-50 text-xs font-bold rounded-xl cursor-pointer"
                >
                  {bulkBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirm
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
