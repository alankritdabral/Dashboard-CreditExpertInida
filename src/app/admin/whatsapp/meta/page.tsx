"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Inbox, Loader2, Plug, RefreshCw, Search, Send, ShieldOff, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { DashboardHeader } from "@/components/DashboardHeader";
import type { MetaConversation, MetaMessage, MetaStatus, MetaTemplate } from "@/lib/whatsappMeta";

type Tab = "connection" | "templates" | "inbox";

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const field = "w-full min-h-[44px] bg-white border border-slate-200 rounded-xl px-3 text-base sm:text-sm text-slate-900 focus:outline-none focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20";
const btn = "min-h-[44px] px-4 inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed";
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const newKey = () => `ui-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export default function MetaWhatsappPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("connection");

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role !== "admin") router.replace("/branch");
  }, [user, loading, router]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#FFF8F3]">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF5A00]" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#FFF8F3] text-[#2E2E2E] flex flex-col">
      <DashboardHeader tabs={[]} activeTab="" onTabChange={() => {}} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">WhatsApp (Meta Cloud API)</h1>
            <p className="text-sm text-slate-600">Direct connection to Meta. The MessageBot hub keeps working alongside until the switch-over.</p>
          </div>
          <Link href="/admin/whatsapp" className="min-h-[44px] inline-flex items-center text-sm font-semibold text-[#FF5A00] hover:underline">
            MessageBot hub →
          </Link>
        </div>

        <div role="tablist" aria-label="WhatsApp sections" className="flex gap-2 overflow-x-auto">
          {(
            [
              ["connection", "Connection", Plug],
              ["templates", "Templates", FileText],
              ["inbox", "Inbox", Inbox],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`${btn} shrink-0 rounded-full border ${tab === id ? "bg-[#2E2E2E] text-white border-[#2E2E2E]" : "bg-white text-slate-700 border-slate-200"}`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "connection" && <ConnectionPanel />}
        {tab === "templates" && <TemplatesPanel />}
        {tab === "inbox" && <InboxPanel />}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Row({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold text-right break-all ${warn ? "text-red-600" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}

function ConnectionPanel() {
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setBusy("load");
    setError("");
    try {
      setStatus((await api<{ status: MetaStatus }>("/api/whatsapp/meta/status")).status);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }, []);
  useEffect(() => {
    // Fetch on mount / when the selection changes; state is set from the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const subscribe = async () => {
    setBusy("subscribe");
    setError("");
    try {
      await api("/api/whatsapp/meta/subscribe", { method: "POST" });
      setNotice("App subscribed to this WhatsApp account's webhooks.");
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const badge =
    status?.connection === "CONNECTED"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status?.connection === "NEEDS_ATTENTION"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-bold">Account</h2>
          <div className="flex items-center gap-2">
            {status && <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${badge}`}>{status.connection.replace("_", " ")}</span>}
            <button onClick={load} disabled={busy !== null} className={`${btn} bg-slate-100 text-slate-800`} aria-label="Refresh status">
              {busy === "load" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-600 mb-3">{error}</p>}
        {notice && <p className="text-sm text-emerald-700 mb-3">{notice}</p>}
        {!status ? (
          <p className="text-sm text-slate-500">{busy ? "Checking…" : "No status yet."}</p>
        ) : (
          <div>
            {status.missing.length > 0 && <Row label="Missing on the backend" value={status.missing.join(", ")} warn />}
            {status.error && <Row label="Meta says" value={status.error} warn />}
            <Row label="Phone number" value={status.phone?.displayNumber ?? "—"} />
            <Row label="Display name" value={status.phone ? `${status.phone.verifiedName} (${status.phone.nameStatus})` : "—"} />
            <Row label="Quality rating" value={status.phone?.qualityRating ?? "—"} warn={status.phone?.qualityRating === "RED"} />
            <Row label="Messaging limit" value={status.phone?.messagingLimitTier ?? "—"} />
            <Row label="WhatsApp account" value={status.waba ? `${status.waba.name} · ${status.wabaId}` : status.wabaId ?? "—"} />
            <Row label="Business verification" value={status.waba?.businessVerification ?? "—"} />
            <Row label="Phone number ID" value={status.phoneNumberId ?? "—"} />
            <Row label="Graph API version" value={status.apiVersion ?? "—"} />
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <h2 className="font-bold">Sending & webhooks</h2>
        {status && (
          <div>
            <Row label="Outbound sending" value={status.sendingEnabled ? "ON" : "OFF (WHATSAPP_META_SENDING_ENABLED)"} warn={!status.sendingEnabled} />
            <Row label="Webhook secrets set" value={status.webhookConfigured ? "Yes" : "No"} warn={!status.webhookConfigured} />
            <Row label="Apps subscribed to webhooks" value={status.subscribedApps?.length ? status.subscribedApps.join(", ") : "None"} warn={!status.subscribedApps?.length} />
            <Row label="Last webhook received" value={fmt(status.lastWebhookAt)} />
            <Row label="Webhook events that failed" value={String(status.failedWebhookEvents)} warn={status.failedWebhookEvents > 0} />
            <Row label="Approved templates (synced)" value={`${status.approvedTemplates} · synced ${fmt(status.lastTemplateSyncAt)}`} />
          </div>
        )}
        <button onClick={subscribe} disabled={busy !== null || status?.connection !== "CONNECTED"} className={`${btn} bg-[#FF5A00] text-white w-full`}>
          {busy === "subscribe" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />} Subscribe app to webhooks
        </button>
        <p className="text-xs text-slate-500">
          Webhook callback URL for the Meta app: <code className="font-mono">{"<backend>/api/v1/webhooks/whatsapp/meta"}</code>, verify token = the
          backend&apos;s WHATSAPP_META_VERIFY_TOKEN. Subscribe the <code>messages</code> field.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const bodyText = (t: MetaTemplate) => t.components.find((c) => c.type === "BODY")?.text ?? "";
const headerOf = (t: MetaTemplate) => t.components.find((c) => c.type === "HEADER");
const varCount = (text: string) => new Set(text.match(/\{\{\d+\}\}/g) ?? []).size;

function TemplatesPanel() {
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [busy, setBusy] = useState<string | null>("load");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [to, setTo] = useState("");
  const [params, setParams] = useState<string[]>([]);
  const [mediaLink, setMediaLink] = useState("");

  const load = useCallback(async () => {
    try {
      setTemplates((await api<{ templates: MetaTemplate[] }>("/api/whatsapp/meta/templates")).templates);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }, []);
  useEffect(() => {
    // Fetch on mount / when the selection changes; state is set from the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const sync = async () => {
    setBusy("sync");
    setError("");
    try {
      const r = await api<{ synced: number; removed: number }>("/api/whatsapp/meta/templates", { method: "POST" });
      setNotice(`Synced ${r.synced} template(s) from Meta${r.removed ? `, ${r.removed} no longer in Meta` : ""}.`);
      await load();
    } catch (e) {
      setError(errMsg(e));
      setBusy(null);
    }
  };

  const tpl = templates.find((t) => t.id === selected) || null;
  const needed = tpl ? varCount(bodyText(tpl)) : 0;
  const header = tpl ? headerOf(tpl) : undefined;
  const mediaHeader = header && ["IMAGE", "DOCUMENT", "VIDEO"].includes(String(header.format));

  const pick = (id: string) => {
    setSelected(id);
    const t = templates.find((x) => x.id === id);
    setParams(Array(t ? varCount(bodyText(t)) : 0).fill(""));
    setMediaLink("");
  };

  const preview = tpl ? bodyText(tpl).replace(/\{\{(\d+)\}\}/g, (m, n) => params[Number(n) - 1] || m) : "";

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpl) return;
    if (!window.confirm(`Send "${tpl.name}" to ${to}? This is a real WhatsApp message.`)) return;
    setBusy("send");
    setError("");
    setNotice("");
    try {
      await api("/api/whatsapp/meta/send", {
        method: "POST",
        body: JSON.stringify({ to, templateName: tpl.name, language: tpl.language, bodyParams: params, headerMediaLink: mediaLink || undefined, idempotencyKey: newKey() }),
      });
      setNotice("Accepted by Meta. Delivery and read status arrive by webhook — see the Inbox.");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const statusCls = (s: string) =>
    s === "APPROVED" ? "bg-emerald-50 text-emerald-700" : s === "REJECTED" || s === "DISABLED" || s === "DELETED" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-800";

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold">Templates in Meta</h2>
          <button onClick={sync} disabled={busy !== null} className={`${btn} bg-slate-100 text-slate-800`}>
            {busy === "sync" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sync from Meta
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-700">{notice}</p>}
        {busy === "load" ? (
          <Loader2 className="w-5 h-5 animate-spin text-[#FF5A00]" />
        ) : templates.length === 0 ? (
          <p className="text-sm text-slate-500">No templates yet. Click “Sync from Meta”.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {templates.map((t) => (
              <li key={t.id}>
                <button onClick={() => pick(t.id)} className={`w-full text-left py-3 px-2 rounded-lg cursor-pointer ${selected === t.id ? "bg-[#FF5A00]/10" : "hover:bg-slate-50"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{t.name}</span>
                    <span className="text-xs text-slate-500">{t.language}</span>
                    <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{t.category}</span>
                    <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${statusCls(t.status)}`}>{t.status}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{bodyText(t)}</p>
                  {t.rejectedReason && <p className="text-xs text-red-600 mt-1">Rejected: {t.rejectedReason}</p>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={send} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 self-start">
        <h2 className="font-bold">Test send</h2>
        {!tpl ? (
          <p className="text-sm text-slate-500">Pick a template on the left.</p>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-mono font-semibold">{tpl.name}</span> · {tpl.category}
            </p>
            {tpl.status !== "APPROVED" && <p className="text-sm text-red-600">Only APPROVED templates can be sent.</p>}
            <label className="block text-xs font-semibold text-slate-600">
              Send to (mobile)
              <input className={field} required inputMode="tel" value={to} onChange={(e) => setTo(e.target.value)} placeholder="98XXXXXXXX" />
            </label>
            {mediaHeader && (
              <label className="block text-xs font-semibold text-slate-600">
                {String(header?.format).toLowerCase()} header link (https)
                <input className={field} required type="url" value={mediaLink} onChange={(e) => setMediaLink(e.target.value)} placeholder="https://…" />
              </label>
            )}
            {Array.from({ length: needed }).map((_, i) => (
              <label key={i} className="block text-xs font-semibold text-slate-600">
                {`{{${i + 1}}}`}
                <input
                  className={field}
                  required
                  value={params[i] ?? ""}
                  onChange={(e) => setParams((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
                />
              </label>
            ))}
            <div className="text-sm bg-[#E7F8EE] border border-emerald-100 rounded-xl p-3 whitespace-pre-wrap">{preview}</div>
            <button type="submit" disabled={busy !== null || tpl.status !== "APPROVED"} className={`${btn} w-full bg-[#25D366] text-white`}>
              {busy === "send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send template
            </button>
          </>
        )}
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const STATUS_ICON: Record<string, string> = { QUEUED: "…", ACCEPTED: "✓", SENT: "✓", DELIVERED: "✓✓", READ: "✓✓", FAILED: "!" };

function InboxPanel() {
  const [list, setList] = useState<MetaConversation[]>([]);
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<{ conversation: MetaConversation; messages: MetaMessage[] } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    try {
      const r = await api<{ conversations: MetaConversation[] }>(`/api/whatsapp/meta/conversations${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setList(r.conversations);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [q]);

  const loadActive = useCallback(async (id: string) => {
    try {
      setActive(await api<{ conversation: MetaConversation; messages: MetaMessage[] }>(`/api/whatsapp/meta/conversations/${id}`));
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  // Poll while the tab is visible: new messages and delivery ticks arrive by webhook on the backend.
  useEffect(() => {
    const t0 = setTimeout(loadList, q ? 300 : 0);
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      loadList();
      if (activeId) loadActive(activeId);
    };
    const timer = setInterval(tick, 8000);
    return () => {
      clearTimeout(t0);
      clearInterval(timer);
    };
  }, [loadList, loadActive, activeId, q]);

  useEffect(() => {
    // Fetch on mount / when the selection changes; state is set from the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeId) loadActive(activeId);
  }, [activeId, loadActive]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [active?.messages.length]);

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || !text.trim()) return;
    setBusy("reply");
    setError("");
    try {
      await api(`/api/whatsapp/meta/conversations/${activeId}/messages`, { method: "POST", body: JSON.stringify({ text, idempotencyKey: newKey() }) });
      setText("");
      await loadActive(activeId);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const optOut = async () => {
    if (!active) return;
    if (!window.confirm("Mark this customer as opted out? No WhatsApp messages will be sent to them.")) return;
    try {
      await api("/api/whatsapp/meta/consent", { method: "POST", body: JSON.stringify({ phone: active.conversation.waId, status: "OPTED_OUT", source: "STAFF" }) });
      await loadActive(active.conversation.id);
    } catch (e) {
      setError(errMsg(e));
    }
  };

  const c = active?.conversation;
  const title = (x: MetaConversation) => x.leadName || x.profileName || `+${x.waId}`;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid md:grid-cols-[320px_minmax(0,1fr)] min-h-[70dvh]">
      <aside className={`border-r border-slate-100 flex flex-col ${activeId ? "hidden md:flex" : "flex"}`}>
        <div className="p-3 border-b border-slate-100 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-6 top-1/2 -translate-y-1/2" />
          <input className={`${field} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, number, text" aria-label="Search conversations" />
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {list.length === 0 && <li className="p-4 text-sm text-slate-500">No conversations yet. They appear when a customer writes or you send a template.</li>}
          {list.map((x) => (
            <li key={x.id}>
              <button onClick={() => setActiveId(x.id)} className={`w-full text-left px-4 py-3 cursor-pointer ${activeId === x.id ? "bg-[#FF5A00]/10" : "hover:bg-slate-50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm truncate">{title(x)}</span>
                  <span className="text-[11px] text-slate-500 shrink-0">{fmt(x.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-slate-600 truncate">{x.lastPreview || "—"}</span>
                  {x.unreadCount > 0 && <span className="text-[11px] font-bold bg-[#25D366] text-white rounded-full px-2">{x.unreadCount}</span>}
                </div>
                <span className="text-[11px] text-slate-400">{x.assignedToName ? `Owner: ${x.assignedToName}` : "No lead owner"}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className={`flex flex-col min-w-0 ${activeId ? "flex" : "hidden md:flex"}`}>
        {!c ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500 p-6">Select a conversation.</div>
        ) : (
          <>
            <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <button onClick={() => setActiveId(null)} className="md:hidden text-xs font-semibold text-[#FF5A00] min-h-[44px]">← All conversations</button>
                <p className="font-bold truncate">{title(c)}</p>
                <p className="text-xs text-slate-500">
                  +{c.waId} · {c.assignedToName ? `Owner ${c.assignedToName}` : "No lead owner"}
                  {c.leadStatus ? ` · Lead ${c.leadStatus}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {c.optedOut ? (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600 inline-flex items-center gap-1"><ShieldOff className="w-3.5 h-3.5" /> Opted out</span>
                ) : (
                  <button onClick={optOut} className="text-xs font-semibold text-slate-600 hover:text-red-600 min-h-[44px] px-2 cursor-pointer">Mark opted out</button>
                )}
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${c.windowOpen ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  <Clock className="w-3.5 h-3.5" /> {c.windowOpen ? `Reply window until ${fmt(c.windowEndsAt)}` : "Window closed"}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#F5F0EB]/60">
              {active!.messages.map((m) => (
                <div key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-xs ${m.direction === "OUTBOUND" ? "ml-auto bg-[#DCF8C6]" : "bg-white"}`}>
                  {m.type === "template" ? (
                    <p className="whitespace-pre-wrap">
                      <span className="text-[11px] font-bold uppercase text-slate-500">Template {m.templateName}</span>
                      {m.templateParams?.body?.length ? <span className="block text-slate-700">{m.templateParams.body.join(" · ")}</span> : null}
                    </p>
                  ) : m.media ? (
                    <p className="whitespace-pre-wrap">[{m.media.kind}{m.media.filename ? `: ${m.media.filename}` : ""}] {m.media.caption ?? ""}</p>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.textBody ?? `[${m.type}]`}</p>
                  )}
                  <p className="text-[10px] text-slate-500 text-right mt-0.5">
                    {fmt(m.createdAt)}
                    {m.direction === "OUTBOUND" && (
                      <span className={`ml-1 font-bold ${m.status === "READ" ? "text-sky-600" : m.status === "FAILED" ? "text-red-600" : ""}`} title={m.errorMessage || m.status}>
                        {STATUS_ICON[m.status] ?? m.status}
                      </span>
                    )}
                  </p>
                  {m.status === "FAILED" && m.errorMessage && <p className="text-[11px] text-red-600">{m.errorMessage}</p>}
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {error && <p role="alert" className="px-4 py-2 text-sm text-red-600 inline-flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {error}</p>}
            <form onSubmit={reply} className="p-3 border-t border-slate-100 flex gap-2">
              <textarea
                className={`${field} py-2.5 min-h-[44px] max-h-40 resize-y`}
                rows={1}
                maxLength={4096}
                value={text}
                disabled={!c.windowOpen || c.optedOut}
                onChange={(e) => setText(e.target.value)}
                placeholder={c.optedOut ? "Customer opted out" : c.windowOpen ? "Type a reply" : "Window closed — send an approved template from the Templates tab"}
                aria-label="Reply"
              />
              <button type="submit" disabled={busy !== null || !c.windowOpen || c.optedOut || !text.trim()} className={`${btn} bg-[#25D366] text-white shrink-0`} aria-label="Send reply">
                {busy === "reply" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Send
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
