"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileText, Flame, Loader2, Phone, RefreshCw, Search, Trash2, Users, X } from "lucide-react";
import type { Lead, LeadStatus } from "@/lib/leads";
import { leadKinds, LEAD_KIND_LABEL, UNASSIGNED_REASON_LABEL, type LeadKind } from "@/lib/leadKinds";
import { downloadLeadsExcel } from "@/lib/leadExport";
import { isStale, leadScore } from "@/lib/leadScore";
import { CreditReportDashboard } from "@/components/CreditReportDashboard";

const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  FOLLOW_UP: "Follow up",
  CONVERTED: "Converted",
  NOT_INTERESTED: "Not interested",
};
const POLL_MS = 8000;
const STATUSES = Object.keys(STATUS_LABEL) as LeadStatus[];

// Only the active auto-assign team can be given leads: they have the phone number the WhatsApp needs.
interface Employee {
  name: string;
  email: string;
  phone?: string;
  active?: boolean;
}

const KIND_STYLE: Record<LeadKind, string> = {
  eligibility: "bg-violet-50 text-violet-700 border-violet-200",
  details: "bg-sky-50 text-sky-700 border-sky-200",
  other: "bg-slate-100 text-slate-600 border-slate-200",
};
type KindTab = "all" | LeadKind;

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const rupees = (n: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`);

// Admin: all leads + assign each to one employee. Branch manager: their branch's leads, assigned to their
// branch's employees. Employee: own leads only. Deleting and exporting stay admin-only.
export function LeadsPanel({ isAdmin, manager = false }: { isAdmin: boolean; manager?: boolean }) {
  const canAssign = isAdmin || manager;
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
  const [kindTab, setKindTab] = useState<KindTab>("all");
  const [reportOnly, setReportOnly] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [range, setRange] = useState<"all" | "today" | "7d" | "30d">("all");
  const [now, setNow] = useState(() => Date.now());
  const [viewingReport, setViewingReport] = useState<any | null>(null);
  const [openingReport, setOpeningReport] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<Record<string, string>>({}); // lead id -> MessageBot delivery text

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState(false); // employee picker open
  const [pickedEmps, setPickedEmps] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [fresh, setFresh] = useState<Set<string>>(new Set()); // arrived since the page opened
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const knownIds = useRef<Set<string> | null>(null);

  const openReport = async (leadId: string, reportId: string) => {
    setOpeningReport(reportId);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/report?reportId=${encodeURIComponent(reportId)}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || "Could not load the report");
      setViewingReport(data.report);
    } catch (e: any) {
      setError(e.message || "Could not load the report");
    } finally {
      setOpeningReport(null);
    }
  };

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
    if (!canAssign) return;
    fetch("/api/lead-employees", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.success && setEmployees(d.employees.filter((u: Employee) => u.active)))
      .catch(() => {});
  }, [canAssign]);

  const [retrying, setRetrying] = useState(false);
  const retryAssign = async () => {
    setRetrying(true);
    setError("");
    try {
      const res = await fetch("/api/leads/retry", { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not retry assignment");
      const r = data.result as { tried: number; assigned: number; stillUnassigned: number };
      setNotice(
        r.tried === 0
          ? "Nothing was waiting."
          : `${r.assigned} lead${r.assigned === 1 ? "" : "s"} assigned${r.stillUnassigned ? `, ${r.stillUnassigned} still waiting for someone with room` : ""}.`
      );
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not retry assignment");
    } finally {
      setRetrying(false);
    }
  };

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

  const assignOne = async (l: Lead, email: string) => {
    if (!email) return patch(l.id, { assignTo: null });
    const emp = employees.find((e) => e.email.toLowerCase() === email);
    if (!window.confirm(`Assign ${l.name} to ${emp?.name || email}?\n\nThe customer and ${emp?.name || "the employee"} will each get a WhatsApp message, same as a website lead.`)) return;
    await patch(l.id, { assignTo: email });
    setNotice(`${l.name} assigned to ${emp?.name || email}. WhatsApp messages sent.`);
  };

  // Exports what is on screen (after the tab and filters), or only the ticked leads if any are ticked.
  const exportExcel = async () => {
    const list = selected.size ? visible.filter((l) => selected.has(l.id)) : visible;
    if (!list.length) return setError("No leads to export");
    setExporting(true);
    try {
      await downloadLeadsExcel(list, kindTab === "all" ? "leads" : `leads-${kindTab}`);
    } catch (e: any) {
      setError(e.message || "Could not create the Excel file");
    } finally {
      setExporting(false);
    }
  };

  const askDelete = (ids: string[], label: string) => setConfirmDelete({ ids, label });

  useEffect(() => {
    if (!confirmDelete) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setConfirmDelete(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [confirmDelete]);

  const runDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: confirmDelete.ids }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || "Delete failed");
      const gone = new Set(confirmDelete.ids);
      setLeads((prev) => prev.filter((l) => !gone.has(l.id)));
      knownIds.current = new Set([...(knownIds.current || [])].filter((id) => !gone.has(id)));
      setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));
      setNotice(`Deleted ${confirmDelete.ids.length} lead${confirmDelete.ids.length > 1 ? "s" : ""}. Credit reports were kept.`);
      setConfirmDelete(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const checkDelivery = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(id)}/delivery`, { cache: "no-store" });
      const data = await res.json();
      setDelivery((d) => ({ ...d, [id]: data.success ? data.delivery : data.error || "Could not check" }));
    } catch {
      setDelivery((d) => ({ ...d, [id]: "Could not check" }));
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
      let msg = `Assigned — ${parts.join(", ")}. WhatsApp sent for ${r.notified ?? 0} customer(s).`;
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

  const kinds = useMemo(() => new Map(leads.map((l) => [l.id, leadKinds(l)])), [leads]);
  const kindCount = useMemo(() => {
    const c = { all: leads.length, eligibility: 0, details: 0, other: 0 };
    for (const l of leads) for (const k of kinds.get(l.id) || []) c[k]++;
    return c;
  }, [leads, kinds]);

  const scored = useMemo(() => new Map(leads.map((l) => [l.id, leadScore(l, now)])), [leads, now]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const startOfToday = new Date(now).setHours(0, 0, 0, 0);
    const since = range === "today" ? startOfToday : range === "7d" ? now - 7 * 86400000 : range === "30d" ? now - 30 * 86400000 : 0;
    const list = leads.filter((l) => {
      if (filter === "unassigned" && l.assignedToEmail) return false;
      if (filter !== "all" && filter !== "unassigned" && l.assignedToEmail !== filter) return false;
      if (statusF !== "all" && l.status !== statusF) return false;
      if (kindTab !== "all" && !kinds.get(l.id)?.includes(kindTab)) return false;
      if (reportOnly && !l.reports.length) return false;
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
  }, [leads, filter, query, sort, statusF, tierF, range, scored, now, kindTab, reportOnly, kinds]);

  const stats = useMemo(() => {
    const today = new Date(now).setHours(0, 0, 0, 0);
    return {
      total: leads.length,
      today: leads.filter((l) => l.createdAt && new Date(l.createdAt).getTime() >= today).length,
      hot: leads.filter((l) => scored.get(l.id)?.tier === "hot").length,
      withReport: leads.filter((l) => l.reports.length > 0).length,
      stale: leads.filter((l) => isStale(l, now)).length,
    };
  }, [leads, scored, now]);

  const unassigned = leads.filter((l) => !l.assignedToEmail).length;
  const perEmployee = pickedEmps.size ? Math.ceil(selected.size / pickedEmps.size) : 0;
  const field =
    "min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 text-base sm:text-xs font-medium text-slate-900 focus:outline-none focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20";

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total leads", value: stats.total, onClick: () => { setTierF("all"); setRange("all"); setFilter("all"); setReportOnly(false); setKindTab("all"); } },
          { label: "Today", value: stats.today, onClick: () => { setRange("today"); setTierF("all"); } },
          ...(canAssign ? [{ label: "Unassigned", value: unassigned, warn: unassigned > 0, onClick: () => setFilter("unassigned") }] : []),
          { label: "With CIBIL report", value: stats.withReport, onClick: () => setReportOnly(true) },
          { label: "Hot", value: stats.hot, hot: true, onClick: () => { setTierF("hot"); setSort("hot"); } },
          { label: "Untouched 24h+", value: stats.stale, onClick: () => { setStatusF("NEW"); setSort("oldest"); setRange("all"); } },
        ].map((c: { label: string; value: number; hot?: boolean; warn?: boolean; onClick: () => void }) => (
          <button
            key={c.label}
            onClick={c.onClick}
            className="min-h-[44px] text-left bg-white border border-slate-200/90 rounded-2xl px-4 py-3 shadow-sm cursor-pointer hover:border-[#3F8EFC]/50"
          >
            <span className="block text-[11px] font-semibold text-slate-500">{c.label}</span>
            <span className={`block text-2xl font-bold ${c.hot ? "text-orange-600" : c.warn ? "text-red-600" : "text-[#0A2540]"}`}>{c.value}</span>
          </button>
        ))}
      </div>

      <div role="tablist" aria-label="Lead type" className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            ["all", "All leads"],
            ["eligibility", "Eligibility check"],
            ["details", "Leave details form"],
            ...(kindCount.other > 0 ? ([["other", "Calculator / other"]] as const) : []),
          ] as [KindTab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={kindTab === k}
            onClick={() => setKindTab(k)}
            className={`shrink-0 whitespace-nowrap min-h-[44px] px-4 inline-flex items-center gap-2 rounded-full text-xs font-bold cursor-pointer border transition-colors ${
              kindTab === k ? "bg-[#0A2540] text-white border-[#0A2540]" : "bg-white text-slate-700 border-slate-200 hover:border-[#3F8EFC]/50"
            }`}
          >
            {label}
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${kindTab === k ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>{kindCount[k]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3 bg-white border border-slate-200/90 p-3 sm:p-4 rounded-3xl shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, mobile, requirement…"
            className={`${field} w-full pl-10`}
          />
        </div>
        {canAssign && (
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${field} w-full md:w-auto`} aria-label="Filter leads">
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
          className="min-h-[44px] px-4 inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer w-full md:w-auto"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
        {canAssign && unassigned > 0 && (
          <button
            onClick={retryAssign}
            disabled={retrying}
            title="Try to give the waiting leads to someone who now has room"
            className="min-h-[44px] px-4 inline-flex items-center justify-center gap-1.5 bg-amber-100 hover:bg-amber-200 disabled:opacity-60 text-amber-900 text-xs font-bold rounded-xl cursor-pointer w-full md:w-auto"
          >
            {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
            Retry assignment ({unassigned})
          </button>
        )}
        {isAdmin && (
          <button
            onClick={exportExcel}
            disabled={exporting || visible.length === 0}
            title={selected.size ? "Download the ticked leads" : "Download the leads shown"}
            className="min-h-[44px] px-4 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer w-full md:w-auto"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Excel ({selected.size || visible.length})
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={`${field} flex-1 min-w-[9.5rem] sm:flex-none`} aria-label="Sort leads">
          <option value="hot">Sort: Hottest first</option>
          <option value="newest">Sort: Newest first</option>
          <option value="oldest">Sort: Oldest first</option>
          <option value="salary">Sort: Salary high → low</option>
        </select>
        <select value={range} onChange={(e) => setRange(e.target.value as typeof range)} className={`${field} flex-1 min-w-[9.5rem] sm:flex-none`} aria-label="Date range">
          <option value="all">Any date</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)} className={`${field} flex-1 min-w-[9.5rem] sm:flex-none`} aria-label="Status">
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
        <button
          onClick={() => setReportOnly((v) => !v)}
          aria-pressed={reportOnly}
          className={`min-h-[44px] px-4 inline-flex items-center gap-1.5 rounded-xl text-xs font-bold cursor-pointer border ${
            reportOnly ? "bg-[#3F8EFC] text-white border-[#3F8EFC]" : "bg-white text-slate-700 border-slate-200"
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Has CIBIL report
        </button>
        {(statusF !== "all" || tierF !== "all" || range !== "all" || query || reportOnly || kindTab !== "all" || filter !== "all") && (
          <button
            onClick={() => { setStatusF("all"); setTierF("all"); setRange("all"); setQuery(""); setReportOnly(false); setKindTab("all"); setFilter("all"); }}
            className="min-h-[44px] px-3 text-xs font-bold text-[#3F8EFC] cursor-pointer"
          >
            Reset filters
          </button>
        )}
        <span className="w-full sm:w-auto sm:ml-auto text-[11px] text-slate-500">
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
        {canAssign && visible.length > 0 && (
          <button
            onClick={() =>
              setSelected((prev) => {
                const ids = visible.map((l) => l.id);
                const all = ids.every((id) => prev.has(id));
                const n = new Set(prev);
                ids.forEach((id) => (all ? n.delete(id) : n.add(id)));
                return n;
              })
            }
            className="min-h-[44px] px-2 text-xs font-bold text-[#3F8EFC] cursor-pointer"
          >
            {visible.every((l) => selected.has(l.id)) ? "Clear selection" : `Select all shown (${visible.length})`}
          </button>
        )}
      </div>

      {loading && leads.length === 0 && (
        <ul className="space-y-3" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="bg-white border border-slate-200/90 rounded-3xl p-5 space-y-3 animate-pulse">
              <div className="h-4 w-1/3 bg-slate-100 rounded" />
              <div className="h-3 w-2/3 bg-slate-100 rounded" />
              <div className="h-3 w-1/2 bg-slate-100 rounded" />
            </li>
          ))}
        </ul>
      )}

      {!loading && visible.length === 0 && (
        <p className="text-center text-sm text-slate-500 bg-white border border-slate-200/90 rounded-3xl py-12">
          {canAssign ? "No leads match." : "No leads have been assigned to you yet."}
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
              <div className="flex items-start gap-2 sm:gap-3">
                {canAssign && (
                  <label className="min-h-[44px] min-w-[32px] -mt-3 -ml-1 inline-flex items-center justify-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={selected.has(l.id)}
                      onChange={() => toggle(l.id)}
                      aria-label={`Select ${l.name}`}
                      className="w-4 h-4 accent-[#3F8EFC]"
                    />
                  </label>
                )}
                <div className="min-w-0 flex-1 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-bold text-[#0A2540] break-words">
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
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {(kinds.get(l.id) || []).map((k) => (
                      <span key={k} className={`text-[10px] font-bold uppercase tracking-wide border rounded-full px-2 py-0.5 ${KIND_STYLE[k]}`}>
                        {LEAD_KIND_LABEL[k]}
                      </span>
                    ))}
                    <span className="text-[11px] text-slate-500">
                      {fmtDate(l.createdAt)}
                      {l.assignedToName ? ` · Assigned to ${l.assignedToName}${l.assignedToPhone ? ` (${l.assignedToPhone})` : ""}` : ""}
                    </span>
                    {!l.assignedToName && <span className="text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-600 rounded-full px-2 py-0.5">Unassigned</span>}
                    {!l.assignedToName && l.unassignedReason && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">
                        {UNASSIGNED_REASON_LABEL[l.unassignedReason] ?? l.unassignedReason}
                      </span>
                    )}
                    {canAssign && l.branch && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{l.branch}</span>
                    )}
                  </div>
                  {l.assignedToEmail && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span
                        title={l.welcomeError || undefined}
                        className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                          l.welcomeStatus === "SENT"
                            ? "bg-emerald-50 text-emerald-700"
                            : l.welcomeStatus === "FAILED"
                              ? "bg-red-50 text-red-600"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {l.welcomeStatus === "SENT"
                          ? "WhatsApp sent to customer"
                          : l.welcomeStatus === "FAILED"
                            ? "WhatsApp failed"
                            : l.welcomeStatus === "SKIPPED"
                              ? "WhatsApp not sent"
                              : "WhatsApp pending"}
                      </span>
                      {l.welcomeStatus !== "SENT" && l.welcomeError && (
                        <span className="text-[11px] text-slate-500">{l.welcomeError}</span>
                      )}
                      <span
                        title={l.employeeNotifyError || undefined}
                        className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                          l.employeeNotifyStatus === "SENT"
                            ? "bg-emerald-50 text-emerald-700"
                            : l.employeeNotifyStatus === "FAILED"
                              ? "bg-red-50 text-red-600"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {l.employeeNotifyStatus === "SENT"
                          ? "Employee notified"
                          : l.employeeNotifyStatus === "FAILED"
                            ? "Employee message failed"
                            : l.employeeNotifyStatus === "SKIPPED"
                              ? "Employee not messaged"
                              : "Employee pending"}
                      </span>
                      {l.employeeNotifyStatus !== "SENT" && l.employeeNotifyError && (
                        <span className="text-[11px] text-slate-500">{l.employeeNotifyError}</span>
                      )}
                      {l.welcomeStatus === "SENT" && l.welcomeCampaignId && (
                        <button
                          onClick={() => checkDelivery(l.id)}
                          disabled={busyId === l.id}
                          className="min-h-[44px] sm:min-h-0 text-xs font-bold text-[#3F8EFC] hover:underline cursor-pointer disabled:opacity-60"
                        >
                          {delivery[l.id] ? `Delivery: ${delivery[l.id]}` : "Check delivery"}
                        </button>
                      )}
                      <button
                        onClick={() => patch(l.id, { resendWelcome: true })}
                        disabled={busyId === l.id}
                        className="min-h-[44px] sm:min-h-0 text-xs font-bold text-[#3F8EFC] hover:underline cursor-pointer disabled:opacity-60"
                      >
                        {l.welcomeStatus === "SENT" && l.employeeNotifyStatus === "SENT" ? "Send both again" : "Send now"}
                      </button>
                    </div>
                  )}
                  {(l.reports.length > 0 || l.enquiryCount > 1) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {l.enquiryCount > 1 && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-700 rounded-full px-2 py-0.5">
                          {l.enquiryCount} enquiries · 1 customer
                        </span>
                      )}
                      {l.reports.slice(0, 3).map((r) => (
                        <button
                          key={r.id}
                          onClick={() => openReport(l.id, r.id)}
                          disabled={openingReport === r.id}
                          className="min-h-[44px] sm:min-h-0 inline-flex items-center gap-1.5 text-xs font-bold text-[#0A2540] bg-[#3F8EFC]/10 hover:bg-[#3F8EFC]/20 rounded-full px-3 py-1.5 cursor-pointer disabled:opacity-60"
                        >
                          {openingReport === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                          {r.bureau ? r.bureau.toUpperCase() : "Report"} {r.creditScore ?? "—"} · {fmtDate(r.createdAt)} · View
                        </button>
                      ))}
                      {l.reports.length > 3 && <span className="text-[11px] text-slate-500">+{l.reports.length - 3} more</span>}
                    </div>
                  )}
                  {l.activity.length > 1 && (
                    <details className="pt-1 text-[11px] text-slate-600">
                      <summary className="cursor-pointer font-semibold text-slate-500">Activity ({l.activity.length})</summary>
                      <ul className="mt-1 space-y-0.5 pl-1">
                        {l.activity.map((a, i) => (
                          <li key={i}>
                            {fmtDate(a.at)} · {a.type === "credit_report" ? "📄" : "✉️"} {a.label} <span className="text-slate-400">({a.source})</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {digits && (
                    <a
                      href={`tel:+91${digits}`}
                      className="inline-flex items-center gap-1.5 mt-1 min-h-[44px] sm:min-h-0 text-xs font-bold text-[#3F8EFC]"
                    >
                      <Phone className="w-3.5 h-3.5" /> {l.phone}
                    </a>
                  )}
                </div>

                <div className="flex gap-2 xl:shrink-0 xl:self-start">
                  {canAssign && (
                    <select
                      value={l.assignedToEmail || ""}
                      disabled={busyId === l.id}
                      onChange={(e) => assignOne(l, e.target.value)}
                      className={`${field} flex-1 min-w-0 xl:flex-none xl:w-44`}
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
                    className={`${field} flex-1 min-w-0 xl:flex-none xl:w-44`}
                    aria-label={`Status for ${l.name}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  {isAdmin && (
                    <button
                      onClick={() => askDelete([l.id], l.name)}
                      aria-label={`Delete ${l.name}`}
                      title="Delete lead"
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
                </div>
              </li>
          );
        })}
      </ul>
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => !deleting && setConfirmDelete(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm delete"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 space-y-4"
          >
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 shrink-0 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-[#0A2540] break-words">Delete {confirmDelete.label}?</h3>
                <p className="text-xs text-slate-600 mt-1">Removes the enquiries and assignment. This cannot be undone. Credit reports are kept.</p>
              </div>
            </div>
            {error && <p className="text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting} className="min-h-[44px] px-3 text-xs font-bold text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer">
                Cancel
              </button>
              <button onClick={runDelete} disabled={deleting} autoFocus className="min-h-[44px] px-4 inline-flex items-center gap-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-xl cursor-pointer">
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {viewingReport && (
        <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white text-slate-900 w-full max-w-6xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] rounded-none sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
            <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-100 bg-slate-50">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 break-words">Bureau report: {viewingReport.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bureau: <strong className="uppercase text-[#3F8EFC]">{viewingReport.bureau}</strong> · {viewingReport.created_at?.seconds ? fmtDate(new Date(viewingReport.created_at.seconds * 1000).toISOString()) : "—"}
                </p>
              </div>
              <button
                onClick={() => setViewingReport(null)}
                aria-label="Close report"
                className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-slate-50">
              {!viewingReport.raw_api_data ? (
                <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-2xl p-6 text-center">
                  This report has no stored bureau data, so the full details cannot be shown.
                  {viewingReport.credit_score != null ? ` Score on record: ${viewingReport.credit_score}.` : ""}
                </p>
              ) : (
              <CreditReportDashboard
                bureau={viewingReport.bureau}
                cibilData={viewingReport.raw_api_data}
                formData={{
                  firstName: viewingReport.name?.split(" ")[0] || "",
                  lastName: viewingReport.name?.split(" ").slice(1).join(" ") || "",
                  mobile: viewingReport.mobile,
                  pan: viewingReport.pan,
                  bureau: viewingReport.bureau,
                }}
              />
              )}
            </div>
          </div>
        </div>
      )}
      {canAssign && selected.size > 0 && (
        <div className="sticky bottom-3 z-20 bg-[#0A2540] text-white rounded-2xl shadow-xl p-3 sm:p-4 space-y-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold">{selected.size} selected</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelected(new Set())} className="min-h-[44px] px-3 text-xs font-bold text-white/80 cursor-pointer">
                Clear
              </button>
              {isAdmin && (
                <button
                  onClick={() => askDelete([...selected], `${selected.size} selected lead${selected.size > 1 ? "s" : ""}`)}
                  className="min-h-[44px] px-4 inline-flex items-center gap-1.5 bg-red-500/90 hover:bg-red-500 text-xs font-bold rounded-xl cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
              <button
                onClick={() => {
                  setPicking((v) => !v);
                  if (!pickedEmps.size) setPickedEmps(new Set(employees.map((e) => e.email.toLowerCase())));
                }}
                className="min-h-[44px] px-4 inline-flex items-center gap-1.5 bg-[#3F8EFC] text-xs font-bold rounded-xl cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" /> Assign…
              </button>
            </div>
          </div>
          {picking && (
            <div className="space-y-3 border-t border-white/15 pt-3">
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {employees.length === 0 && <span className="text-xs text-white/70">No active employees on the lead team. Add them in Lead team.</span>}
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs text-white/70">
                  {pickedEmps.size
                    ? `${selected.size} leads → ${pickedEmps.size} employee${pickedEmps.size > 1 ? "s" : ""}, about ${Math.floor(selected.size / pickedEmps.size)}–${perEmployee} each`
                    : "Pick at least one employee"}
                </span>
                <button
                  onClick={assignEvenly}
                  disabled={bulkBusy || !pickedEmps.size}
                  className="min-h-[44px] px-4 inline-flex items-center justify-center gap-1.5 bg-emerald-500 disabled:opacity-50 text-xs font-bold rounded-xl cursor-pointer"
                >
                  {bulkBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Assign &amp; send WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
