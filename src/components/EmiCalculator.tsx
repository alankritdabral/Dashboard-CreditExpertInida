"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Calculator, Download, X, MessageCircle, Loader2 } from "lucide-react";
import { RefinanceSummaryCard, CARD_WIDTH } from "./RefinanceSummaryCard";

/* ------------------------------------------------------------------ */
/* Formatting + finance helpers (ported from the standalone calculator) */
/* ------------------------------------------------------------------ */

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    Math.round(amount)
  );

const formatDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const formatMonthYear = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });

// Standard EMI due day is the 5th. Issued on/before the 21st -> 1st EMI next
// month, otherwise the month after next.
function getFirstEmiDate(issue: Date) {
  const d = new Date(issue.getFullYear(), issue.getMonth(), 5);
  d.setMonth(d.getMonth() + (issue.getDate() <= 21 ? 1 : 2));
  return d;
}

function calculateElapsedEmis(first: Date, totalMonths: number) {
  const today = new Date();
  if (today < first) return 0;
  let elapsed =
    (today.getFullYear() - first.getFullYear()) * 12 + (today.getMonth() - first.getMonth());
  if (today.getDate() >= 5) elapsed += 1;
  return Math.max(0, Math.min(totalMonths, elapsed));
}

function calculateEmi(principal: number, annualRate: number, months: number) {
  if (!principal || principal <= 0 || !months || months <= 0) return 0;
  if (annualRate === 0) return principal / months;
  const r = annualRate / 1200;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

function calculateAmortization(principal: number, annualRate: number, totalMonths: number, elapsed: number) {
  const monthlyEmi = calculateEmi(principal, annualRate, totalMonths);
  const r = annualRate / 1200;
  let balance = principal;
  for (let i = 1; i <= elapsed; i++) {
    const interest = balance * r;
    balance -= Math.min(balance, monthlyEmi - interest);
  }
  return {
    monthlyEmi,
    outstandingBalance: Math.max(0, balance),
    remainingMonths: Math.max(0, totalMonths - elapsed),
  };
}

const defaultIssueDate = () => {
  const t = new Date();
  const d = new Date(t.getFullYear() - 1, t.getMonth(), 15);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const BANKS: { name: string; logo?: string }[] = [
  { name: "Poonawalla Fincorp Limited", logo: "/images/poonawalla_fincorp.webp" },
  { name: "Aditya Birla Capital Limited", logo: "/images/Aditya_Birla_Capital.webp" },
  { name: "Bajaj Finance Limited", logo: "/images/bajaj_finance.webp" },
  { name: "None" },
];

type CalcResult = NonNullable<ReturnType<typeof useCalc>>;

interface CalcInput {
  amount: string;
  issueDate: string;
  rate: string;
  tenure: string;
  unit: "months" | "years";
  offerRate: string;
  offerMonths: string | null; // null => default to months remaining
}

function useCalc(i: CalcInput) {
  return useMemo(() => {
    const loanAmount = parseFloat(i.amount);
    const interestRate = parseFloat(i.rate);
    const tenureValue = parseFloat(i.tenure);
    if (isNaN(loanAmount) || isNaN(interestRate) || isNaN(tenureValue) || !i.issueDate || loanAmount <= 0 || tenureValue <= 0) {
      return null;
    }
    const [y, m, d] = i.issueDate.split("-").map(Number);
    const issueDate = new Date(y, m - 1, d);
    const firstEmiDate = getFirstEmiDate(issueDate);
    const totalMonths = Math.max(1, i.unit === "years" ? Math.round(tenureValue * 12) : Math.round(tenureValue));
    const elapsed = calculateElapsedEmis(firstEmiDate, totalMonths);
    const amort = calculateAmortization(loanAmount, interestRate, totalMonths, elapsed);

    const parsedOfferMonths = i.offerMonths === null ? NaN : parseInt(i.offerMonths, 10);
    const specialMonths = Math.max(
      1,
      !isNaN(parsedOfferMonths) && parsedOfferMonths > 0
        ? parsedOfferMonths
        : amort.remainingMonths > 0
        ? amort.remainingMonths
        : totalMonths
    );
    const parsedRate = parseFloat(i.offerRate);
    const specialRate = !isNaN(parsedRate) && parsedRate >= 0 ? parsedRate : 9.99;

    const refinancePrincipal = amort.outstandingBalance > 0 ? amort.outstandingBalance : loanAmount;
    const specialEmi = calculateEmi(refinancePrincipal, specialRate, specialMonths);
    const specialTotal = specialEmi * specialMonths;
    const currentRemainingTotal = amort.monthlyEmi * amort.remainingMonths;
    const totalOriginalPayment = amort.monthlyEmi * totalMonths;

    return {
      loanAmount,
      interestRate,
      issueDate,
      firstEmiDate,
      totalMonths,
      elapsed,
      ...amort,
      percentPaid: Math.round((elapsed / totalMonths) * 100),
      totalOriginalPayment,
      totalOriginalInterest: Math.max(0, totalOriginalPayment - loanAmount),
      specialMonths,
      specialRate,
      refinancePrincipal,
      specialEmi,
      specialTotal,
      specialInterest: Math.max(0, specialTotal - refinancePrincipal),
      monthlyDiff: amort.monthlyEmi - specialEmi,
      yearlyDiff: amort.monthlyEmi * 12 - specialEmi * 12,
      totalDiff: currentRemainingTotal - specialTotal,
      today: new Date(),
    };
  }, [i.amount, i.issueDate, i.rate, i.tenure, i.unit, i.offerRate, i.offerMonths]);
}

/* ------------------------------------------------------------------ */
/* Shared styling                                                       */
/* ------------------------------------------------------------------ */

const inputCls =
  "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[44px] text-base sm:text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1.5";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#3F8EFC] hover:bg-[#2f7ae6] text-white text-sm font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
const subBtn =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export function EmiCalculator() {
  const [amount, setAmount] = useState("500000");
  const [issueDate, setIssueDate] = useState(defaultIssueDate);
  const [rate, setRate] = useState("14.5");
  const [tenure, setTenure] = useState("36");
  const [unit, setUnit] = useState<"months" | "years">("months");
  const [offerRate, setOfferRate] = useState("9.99");
  const [offerMonths, setOfferMonths] = useState<string | null>(null);

  const [bank, setBank] = useState("None");
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custMessage, setCustMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const calc = useCalc({ amount, issueDate, rate, tenure, unit, offerRate, offerMonths });

  // Changing any base loan input re-syncs refinance tenure with months remaining.
  const base =
    <T extends string>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setOfferMonths(null);
    };

  const switchUnit = (next: "months" | "years") => {
    if (next === unit) return;
    const v = parseFloat(tenure);
    if (!isNaN(v) && v > 0) {
      setTenure(next === "years" ? (v / 12).toFixed(1).replace(/\.0$/, "") : String(Math.round(v * 12)));
    }
    setUnit(next);
    setOfferMonths(null);
  };

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  };

  const firstEmiHint = useMemo(() => {
    if (!issueDate) return null;
    const [y, m, d] = issueDate.split("-").map(Number);
    const issue = new Date(y, m - 1, d);
    return { d, issue, first: getFirstEmiDate(issue) };
  }, [issueDate]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!calc) {
      setError("Enter a valid loan amount, issue date, interest rate and tenure.");
      return;
    }
    setError(null);
    setBankModalOpen(true);
  };

  const pickBank = (name: string) => {
    setBank(name);
    setBankModalOpen(false);
    setOfferMonths(null);
    setShowResults(true);
  };

  /* ---- image generation ---- */
  const generateBlob = async (): Promise<Blob> => {
    const el = document.getElementById("emi-summary-card");
    if (!el) throw new Error("Summary card not found");
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(el, { scale: 1, backgroundColor: "#0A1B38", useCORS: true, logging: false });
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image render failed"))), "image/png", 1.0)
    );
  };

  const downloadImage = async () => {
    try {
      setBusy("download");
      const blob = await generateBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `loan-refinance-summary_${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      flash("Failed to generate image: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setBusy(null);
    }
  };

  const defaultMessage = (name: string) =>
    `Hi${name.trim() ? " " + name.trim() : ""}, as discussed, here is your loan refinance summary from Credit Expert India. You can lower your EMI and save on interest by refinancing. Please check the details above and let us know if you'd like to proceed.`;

  // Pre-render the PNG when the modal opens so the click handler can use it instantly
  // (browsers only allow clipboard/share while the click's user activation is still fresh).
  const pngRef = useRef<Blob | null>(null);
  const [pngReady, setPngReady] = useState(false);
  useEffect(() => {
    pngRef.current = null;
    if (!shareOpen || !calc) return;
    let live = true;
    const t = window.setTimeout(() => {
      generateBlob()
        .then((b) => { if (live) { pngRef.current = b; setPngReady(true); } })
        .catch(() => {});
    }, 400);
    return () => { live = false; window.clearTimeout(t); setPngReady(false); };
  }, [shareOpen, calc, bank]);

  const saveFallback = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "loan-refinance-summary.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const openChat = async () => {
    const name = custName.trim();
    const digits = custPhone.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
    if (!/^[6-9]\d{9}$/.test(digits)) return flash("Enter a valid 10-digit mobile number.");
    const blob = pngRef.current;
    if (!blob) return flash("Image is still rendering — try again in a moment.");
    const text = custMessage.trim() || defaultMessage(name);
    const file = new File([blob], "loan-refinance-summary.png", { type: "image/png" });
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Phones: native share sheet attaches the image automatically; pick WhatsApp -> customer.
    if (mobile && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }

    // Desktop: copy the image FIRST (while the click is fresh), then open the chat.
    let copied = false;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      copied = true;
    } catch {
      saveFallback(blob);
    }
    window.open(`https://wa.me/91${digits}?text=${encodeURIComponent(text)}`, "_blank");
    flash(copied ? "Image copied. In the chat, click the message box and press Ctrl+V, then Send." : "Image downloaded. Use the + / paperclip in the chat to attach it, then Send.");
  };

  // Close share modal on Escape
  useEffect(() => {
    if (!shareOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShareOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shareOpen]);

  const results = showResults ? calc : null;

  return (
    <div className="space-y-6 animate-fadeIn max-w-3xl mx-auto">
      <header className="text-center">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-[#3F8EFC]/10 text-[#3F8EFC] mb-3">
          <Calculator className="w-5 h-5" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A2540]">EMI &amp; Refinance Calculator</h1>
        <p className="text-sm text-slate-500 mt-1.5">
          Calculate your outstanding loan balance &amp; compare with special offer rates
        </p>
      </header>

      <form onSubmit={onSubmit} className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="emi-amount">Total Loan Amount (₹)</label>
          <input id="emi-amount" type="number" required min={1} step="any" className={inputCls} value={amount} onChange={(e) => base(setAmount)(e.target.value)} placeholder="e.g. 500000" />
        </div>
        <div>
          <label className={labelCls} htmlFor="emi-issue">Date of Loan Issued</label>
          <input id="emi-issue" type="date" required className={inputCls} value={issueDate} onChange={(e) => base(setIssueDate)(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="emi-rate">Current Interest Rate (% p.a.)</label>
          <input id="emi-rate" type="number" required min={0.1} max={100} step="any" className={inputCls} value={rate} onChange={(e) => base(setRate)(e.target.value)} placeholder="e.g. 14.5" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls} htmlFor="emi-tenure">Original Tenure</label>
            <div className="flex mb-1.5 rounded-full border border-slate-200 overflow-hidden text-[11px] font-semibold">
              {(["months", "years"] as const).map((u) => (
                <button key={u} type="button" onClick={() => switchUnit(u)} className={`px-2.5 py-0.5 cursor-pointer ${unit === u ? "bg-[#3F8EFC] text-white" : "text-slate-500 bg-white"}`}>
                  {u === "months" ? "Mo" : "Yr"}
                </button>
              ))}
            </div>
          </div>
          <input id="emi-tenure" type="number" required min={1} step="any" className={inputCls} value={tenure} onChange={(e) => base(setTenure)(e.target.value)} placeholder={unit === "months" ? "36" : "3"} />
        </div>
        <p className="sm:col-span-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
          {firstEmiHint ? (
            <>
              Disbursed on <strong>{firstEmiHint.d} {firstEmiHint.issue.toLocaleDateString("en-IN", { month: "short" })}</strong>
              {firstEmiHint.d <= 21 ? " (≤ 21st) ➔ 1st EMI starts next month in " : " (> 21st) ➔ 1st EMI starts month after next in "}
              <strong>{formatMonthYear(firstEmiHint.first)}</strong>
            </>
          ) : (
            "Issued on or before 21st → 1st EMI starts next month | Issued after 21st → 1st EMI starts month after next"
          )}
        </p>
        {error && <p className="sm:col-span-2 text-xs font-semibold text-red-600">{error}</p>}
        <button type="submit" className={`${primaryBtn} sm:col-span-2`}>
          <Calculator className="w-4 h-4" /> Calculate Outstanding &amp; Savings
        </button>
      </form>

      {results && <Results r={results} bank={bank} offerRate={offerRate} setOfferRate={setOfferRate} offerMonths={offerMonths ?? String(results.specialMonths)} setOfferMonths={setOfferMonths} onShare={() => { setShareOpen(true); }} />}

      {/* Offscreen render stage used for PNG export */}
      {results && (
        <div aria-hidden="true" style={{ position: "fixed", top: 0, left: -9999, width: CARD_WIDTH, pointerEvents: "none", zIndex: -1 }}>
          <RefinanceSummaryCard r={results} id="emi-summary-card" />
        </div>
      )}

      {/* Bank selection modal */}
      {bankModalOpen && (
        <Modal onClose={() => setBankModalOpen(false)} title="Select Bank">
          <div className="flex flex-col gap-2.5">
            {BANKS.map((b) => (
              <button key={b.name} type="button" onClick={() => pickBank(b.name)} className={b.name === "None" ? subBtn : primaryBtn}>
                {b.name === "None" ? "None (Default)" : b.name}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Send-to-customer modal */}
      {shareOpen && results && (
        <Modal onClose={() => setShareOpen(false)} title="Send Summary to Customer" wide subtitle="Opens the customer's WhatsApp chat with your message. The image is copied — paste it and press Send.">
          <PreviewViewport r={results} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div>
              <label className={labelCls} htmlFor="cust-name">Customer Name</label>
              <input id="cust-name" className={inputCls} value={custName} maxLength={60} onChange={(e) => setCustName(e.target.value)} placeholder="e.g. Rahul Sharma" autoComplete="off" />
            </div>
            <div>
              <label className={labelCls} htmlFor="cust-phone">WhatsApp Number</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">+91</span>
                <input id="cust-phone" type="tel" inputMode="numeric" className={`${inputCls} !rounded-l-none`} value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="10-digit mobile" autoComplete="off" />
              </div>
            </div>
          </div>
          <div className="mt-3">
            <label className={labelCls} htmlFor="cust-msg">Message</label>
            <textarea id="cust-msg" rows={4} className={inputCls} value={custMessage || defaultMessage(custName)} onChange={(e) => setCustMessage(e.target.value)} />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <button type="button" disabled={busy !== null || !pngReady} onClick={openChat} className={`${primaryBtn} flex-1 !bg-[#25D366] hover:!bg-[#1fb757]`}>
              {!pngReady ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              {!pngReady ? "Preparing image…" : "Copy Image & Open WhatsApp Chat"}
            </button>
            <button type="button" disabled={busy !== null} onClick={downloadImage} className={subBtn}>
              {busy === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download PNG
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000] max-w-[92vw] bg-[#0A2540] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Results panels                                                       */
/* ------------------------------------------------------------------ */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="text-sm sm:text-base font-bold text-[#0A2540] mt-0.5 break-words">{value}</div>
    </div>
  );
}

function Diff({ value, pos, neg }: { value: number; pos: string; neg: string }) {
  const none = Math.round(value) === 0;
  const good = value > 0;
  const cls = none ? "bg-slate-50 border-slate-200 text-slate-700" : good ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700";
  return (
    <div className={`rounded-xl p-3 border text-center ${cls}`}>
      <div className="text-lg font-bold">{none ? "₹0" : `${good ? "+" : "-"}${formatCurrency(Math.abs(value))}`}</div>
      <div className="text-[11px] font-semibold text-slate-600">{none ? "No Difference" : good ? pos : neg}</div>
    </div>
  );
}

function Results({
  r, bank, offerRate, setOfferRate, offerMonths, setOfferMonths, onShare,
}: {
  r: CalcResult; bank: string; offerRate: string; setOfferRate: (v: string) => void;
  offerMonths: string; setOfferMonths: (v: string | null) => void;
  onShare: () => void;
}) {
  const years = (r.specialMonths / 12).toFixed(1).replace(/\.0$/, "");
  return (
    <div className="space-y-6 animate-fadeIn">
      <section className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-[#0A2540]">Loan Status</h2>
          <span className="text-[11px] font-semibold bg-[#3F8EFC]/10 text-[#3F8EFC] rounded-full px-2.5 py-1 max-w-full break-words">
            As of {r.today.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}{bank !== "None" ? ` · ${bank}` : ""}
          </span>
        </div>
        <div className="grid grid-cols-1 min-[440px]:grid-cols-3 gap-2.5 sm:gap-3">
          <Stat label="Issue Date" value={formatDate(r.issueDate)} />
          <Stat label="1st EMI Date" value={formatMonthYear(r.firstEmiDate)} />
          <Stat label="EMIs Paid / Total" value={`${r.elapsed} / ${r.totalMonths}`} />
        </div>
        <div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#3F8EFC] to-emerald-400" style={{ width: `${r.percentPaid}%` }} />
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-500 mt-1.5">
            <span>{r.percentPaid}% Completed ({r.elapsed} Paid)</span>
            <span>{r.remainingMonths} EMIs Remaining</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs font-semibold text-slate-500">Outstanding Loan Balance</div>
          <div className="text-3xl font-bold text-[#0A2540] mt-1">{formatCurrency(r.outstandingBalance)}</div>
        </div>
        <div className="grid grid-cols-1 min-[440px]:grid-cols-3 gap-2.5 sm:gap-3">
          <Stat label="Monthly EMI" value={formatCurrency(r.monthlyEmi)} />
          <Stat label="Total Interest" value={formatCurrency(r.totalOriginalInterest)} />
          <Stat label="Total Payment" value={formatCurrency(r.totalOriginalPayment)} />
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-[#0A2540]">
          {r.specialRate}% Special Offer Rate
          <span className="font-medium text-slate-500"> · Tenure: {r.specialMonths} Mo ({years} Yrs)</span>
        </h2>
        <p className="text-xs text-slate-500">Calculated on <strong>{formatCurrency(r.refinancePrincipal)}</strong> balance to refinance</p>
        <div className="grid grid-cols-1 min-[440px]:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="emi-offer-rate">Offer Interest Rate (%)</label>
            <input id="emi-offer-rate" type="number" min={0} max={100} step="0.01" className={inputCls} value={offerRate} onChange={(e) => setOfferRate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="emi-offer-months">Refinance Tenure (Months)</label>
            <input id="emi-offer-months" type="number" min={1} max={360} step={1} className={inputCls} value={offerMonths} onChange={(e) => setOfferMonths(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 min-[440px]:grid-cols-3 gap-2.5 sm:gap-3">
          <Stat label={`New EMI @ ${r.specialRate}%`} value={formatCurrency(r.specialEmi)} />
          <Stat label="Total Interest" value={formatCurrency(r.specialInterest)} />
          <Stat label="Total Payment" value={formatCurrency(r.specialTotal)} />
        </div>
        <div className="grid grid-cols-1 min-[440px]:grid-cols-2 gap-2.5 sm:gap-3">
          <Diff value={r.monthlyDiff} pos="Monthly Savings" neg="Extra Cost / Mo" />
          <Diff value={r.yearlyDiff} pos="Per Year Savings" neg="Extra Cost / Year" />
        </div>
        <div className={`rounded-xl p-3 border text-center font-bold ${r.totalDiff > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700" : r.totalDiff < 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-700"}`}>
          {r.totalDiff > 0 ? `${formatCurrency(r.totalDiff)} (Total Saved)` : r.totalDiff < 0 ? `${formatCurrency(Math.abs(r.totalDiff))} (Extra Total Cost)` : "₹0"}
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-[#0A2540]">Share with Customer</h2>
        <button type="button" onClick={onShare} className={`${primaryBtn} w-full !bg-[#25D366] hover:!bg-[#1fb757]`}>
          <MessageCircle className="w-4 h-4" /> Send Summary to Customer
        </button>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal + scaled preview                                               */
/* ------------------------------------------------------------------ */

function Modal({ title, subtitle, onClose, wide, children }: { title: string; subtitle?: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-start sm:items-center justify-center p-3 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-xl" : "max-w-sm"} p-4 sm:p-6 my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-[#0A2540]">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PreviewViewport({ r }: { r: CalcResult }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth || 320;
      const sc = w / CARD_WIDTH;
      setScale(sc);
      setHeight((cardRef.current?.scrollHeight || 1300) * sc);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [r]);

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-[#0A1B38]" style={{ height }}>
      <div ref={cardRef} style={{ position: "absolute", top: 0, left: 0, width: CARD_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none", userSelect: "none" }}>
        <RefinanceSummaryCard r={r} />
      </div>
    </div>
  );
}
