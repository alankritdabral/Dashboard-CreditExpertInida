"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Calculator, Download, X, ChevronLeft, ChevronRight, Copy, Check, MessageCircle, Loader2 } from "lucide-react";
import "./emi-share-cards.css";

/* ------------------------------------------------------------------ */
/* Formatting + finance helpers (ported from the standalone calculator) */
/* ------------------------------------------------------------------ */

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    Math.round(amount)
  );

const formatCompactLakh = (amount: number) => {
  if (!amount || isNaN(amount) || amount <= 0) return "₹0";
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  return formatCurrency(amount);
};

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

const CAPTION = `Want to know if your current loan is costing you more than it should?
1️⃣ Enter your current loan details
2️⃣ See your outstanding amount & remaining EMIs
3️⃣ Compare a lower-interest refinance offer and see your potential savings
Swipe through the 3 images to see how it works.`;

const SLIDE_NAMES = ["Your Loan Details", "Your Loan Today", "Special Refinance Offer"];

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
  const [slide, setSlide] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
  const generateBlob = async (n: number): Promise<Blob> => {
    const el = document.getElementById(`emi-card-slide-${n}`);
    if (!el) throw new Error(`Card ${n} not found`);
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(el, { scale: 1, backgroundColor: "#0B1F3A", useCORS: true, logging: false });
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image render failed"))), "image/png", 1.0)
    );
  };

  const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const downloadSingle = async (n: number) => {
    const ts = new Date().toISOString().replace(/T/, "_").replace(/:/g, "-").split(".")[0];
    const fileName = `image_${n}_${ts}.png`;
    try {
      setBusy(`single-${n}`);
      flash(`Rendering ${fileName}...`);
      saveBlob(await generateBlob(n), fileName);
      flash(`Downloaded ${fileName}!`);
    } catch (err) {
      flash("Failed to generate image: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setBusy(null);
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(CAPTION);
      setCopied(true);
      flash("WhatsApp caption copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      flash("Please manually select and copy the caption.");
    }
  };

  const openWhatsApp = () => {
    try {
      navigator.clipboard?.writeText(CAPTION);
    } catch {
      /* clipboard unavailable */
    }
    const encoded = encodeURIComponent(CAPTION);
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    window.open(
      mobile ? `https://api.whatsapp.com/send?text=${encoded}` : `https://web.whatsapp.com/send?text=${encoded}`,
      "_blank"
    );
    flash("WhatsApp opened! Select a chat, paste caption & attach 01.png, 02.png, 03.png.");
  };

  const downloadAll = async (thenOpenWhatsApp: boolean) => {
    try {
      setBusy("all");
      flash("Generating 01.png, 02.png, 03.png...");
      const blobs = await Promise.all([1, 2, 3].map(generateBlob));
      for (let i = 0; i < blobs.length; i++) {
        saveBlob(blobs[i], `0${i + 1}.png`);
        if (i < blobs.length - 1) await new Promise((r) => setTimeout(r, 350));
      }
      try {
        await navigator.clipboard.writeText(CAPTION);
      } catch {
        /* clipboard unavailable */
      }
      if (thenOpenWhatsApp) {
        flash("✅ 01.png, 02.png, 03.png downloaded! Caption copied! Opening WhatsApp...");
        setTimeout(openWhatsApp, 700);
      } else {
        flash("✅ Downloaded 01.png, 02.png, 03.png & copied caption!");
      }
    } catch (err) {
      flash("Failed to generate images: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setBusy(null);
    }
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

      {results && <Results r={results} bank={bank} offerRate={offerRate} setOfferRate={setOfferRate} offerMonths={offerMonths ?? String(results.specialMonths)} setOfferMonths={setOfferMonths} onShare={() => { setSlide(1); setShareOpen(true); }} onDownload={downloadSingle} busy={busy} />}

      {/* Offscreen 1080x1350 render stage used for PNG export */}
      {results && (
        <div className="render-stage" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <ShareCard key={n} n={n} r={results} bank={bank} id={`emi-card-slide-${n}`} />
          ))}
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

      {/* WhatsApp 3-image share modal */}
      {shareOpen && results && (
        <Modal onClose={() => setShareOpen(false)} title="WhatsApp Loan Refinance Flow" wide subtitle="3 standalone 1080×1350 px slides ready to share together on WhatsApp.">
          <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-500 mb-3 flex-wrap">
            <span>1 Download 01, 02, 03</span> ➔ <span>2 Open WhatsApp</span> ➔ <span>3 Select 3 Images</span>
          </div>
          <div className="grid grid-cols-1 min-[440px]:grid-cols-3 gap-2 mb-3">
            {SLIDE_NAMES.map((name, i) => (
              <button key={name} type="button" onClick={() => setSlide(i + 1)} className={`rounded-xl border px-2 py-2 text-[11px] sm:text-xs font-semibold cursor-pointer ${slide === i + 1 ? "border-[#3F8EFC] bg-[#3F8EFC]/10 text-[#0A2540]" : "border-slate-200 text-slate-500 bg-white"}`}>
                {i + 1}. {name}
              </button>
            ))}
          </div>
          <PreviewViewport n={slide} r={results} bank={bank} />
          <div className="flex items-center justify-center gap-4 my-3">
            <button type="button" aria-label="Previous slide" onClick={() => setSlide((s) => (s === 1 ? 3 : s - 1))} className={`${subBtn} !px-3`}><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-semibold text-slate-600">Slide {slide} of 3: 0{slide}.png</span>
            <button type="button" aria-label="Next slide" onClick={() => setSlide((s) => (s === 3 ? 1 : s + 1))} className={`${subBtn} !px-3`}><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" disabled={busy !== null} onClick={() => downloadAll(true)} className={`${primaryBtn} flex-1`}>
              {busy === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download 3 Images (01, 02, 03)
            </button>
            <button type="button" onClick={openWhatsApp} className={`${primaryBtn} !bg-[#25D366] hover:!bg-[#1fb757]`}>
              <MessageCircle className="w-4 h-4" /> Open WhatsApp
            </button>
            <button type="button" disabled={busy !== null} onClick={() => downloadSingle(slide)} className={subBtn}>
              <Download className="w-4 h-4" /> Download 0{slide}.png
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#0A2540]">💬 WhatsApp Companion Message</span>
              <button type="button" onClick={copyCaption} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3F8EFC] cursor-pointer">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied! ✓" : "Copy Caption"}
              </button>
            </div>
            <p className="text-xs text-slate-600 whitespace-pre-line">{CAPTION}</p>
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
  r, bank, offerRate, setOfferRate, offerMonths, setOfferMonths, onShare, onDownload, busy,
}: {
  r: CalcResult; bank: string; offerRate: string; setOfferRate: (v: string) => void;
  offerMonths: string; setOfferMonths: (v: string | null) => void;
  onShare: () => void; onDownload: (n: number) => void; busy: string | null;
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
          <MessageCircle className="w-4 h-4" /> Share 3 Images on WhatsApp
        </button>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" disabled={busy !== null} onClick={() => onDownload(n)} className={subBtn}>
              {busy === `single-${n}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download Image {n}
            </button>
          ))}
        </div>
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

function PreviewViewport({ n, r, bank }: { n: number; r: CalcResult; bank: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth || 320;
      const s = w / 1080;
      setScale(s);
      setHeight((cardRef.current?.scrollHeight || 1350) * s);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [n, r, bank]);

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-[#0B1F3A]" style={{ height }}>
      <div ref={cardRef} style={{ position: "absolute", top: 0, left: 0, width: 1080, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none", userSelect: "none" }}>
        <ShareCard n={n} r={r} bank={bank} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1080-wide share cards                                                */
/* ------------------------------------------------------------------ */

const noteBox: React.CSSProperties = {
  background: "rgba(15, 31, 58, 0.85)",
  border: "1.5px solid rgba(191, 219, 254, 0.2)",
  borderRadius: 12,
  padding: "16px 20px",
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginTop: "auto",
  zIndex: 2,
  position: "relative",
};

function Brand({ bank, emerald }: { bank: string; emerald?: boolean }) {
  const b = BANKS.find((x) => x.name === bank);
  return (
    <div className="card-header-bar">
      <div className="card-branding-badge">
        <span className={`brand-shield${emerald ? " emerald" : ""}`}>
          {b?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.logo} alt={b.name} style={{ height: 24, verticalAlign: "middle", marginRight: 6, objectFit: "contain" }} />
          ) : (
            "◆"
          )}
        </span>
        <span className="brand-name">{!b || b.name === "None" ? "FINANCIAL ADVISORY" : b.name}</span>
      </div>
    </div>
  );
}

function ShareCard({ n, r, bank, id }: { n: number; r: CalcResult; bank: string; id?: string }) {
  if (n === 1) return <Card1 r={r} bank={bank} id={id} />;
  if (n === 2) return <Card2 r={r} bank={bank} id={id} />;
  return <Card3 r={r} id={id} />;
}

function Card1({ r, bank, id }: { r: CalcResult; bank: string; id?: string }) {
  return (
    <div id={id} className="share-card card-1-theme">
      <div className="card-bg-glow" />
      <Brand bank={bank} />
      <div className="card-heading-section">
        <h1 className="card-main-title">Your <span style={{ color: "#60A5FA" }}>Loan Details</span></h1>
        <p className="card-subtitle">Here’s a quick summary of your current loan.</p>
      </div>
      <div className="card-form-grid">
        <div className="form-field-card highlight-field" style={{ position: "relative" }}>
          <div className="field-label-wrap"><span className="field-icon">₹</span><span className="field-label">TOTAL LOAN AMOUNT</span></div>
          <div className="field-hero-value">{formatCurrency(r.loanAmount)}</div>
          <div className="field-note">Loan amount</div>
          <div style={{ position: "absolute", right: 30, top: "50%", transform: "translateY(-50%)", opacity: 0.9 }}>
            <svg width={60} height={60} viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx={12} cy={5} rx={9} ry={3} /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          </div>
        </div>
        <div className="form-field-card">
          <div className="field-label-wrap"><span className="field-icon" style={{ color: "#F87171" }}>📅</span><span className="field-label">LOAN DATE</span></div>
          <div className="field-value" style={{ fontSize: 28 }}>{formatDate(r.issueDate)}</div>
          <div className="field-note">Your loan was disbursed</div>
        </div>
        <div className="form-field-card">
          <div className="field-label-wrap"><span className="field-icon">📅</span><span className="field-label">FIRST EMI</span></div>
          <div className="field-value" style={{ fontSize: 28 }}>{formatMonthYear(r.firstEmiDate)}</div>
          <div className="field-note">Based on 21st day rule</div>
        </div>
        <div className="form-field-card" style={{ gridColumn: "span 2" }}>
          <div className="field-label-wrap"><span className="field-icon">%</span><span className="field-label">CURRENT INTEREST RATE</span></div>
          <div className="field-value">{r.interestRate.toFixed(2)}% p.a.</div>
          <div className="field-note">Your current loan rate</div>
        </div>
        <div className="form-field-card" style={{ gridColumn: "span 2" }}>
          <div className="field-label-wrap"><span className="field-icon">⏱</span><span className="field-label">LOAN TENURE</span></div>
          <div className="field-value">{r.totalMonths} Months</div>
          <div className="field-note">{(r.totalMonths / 12).toFixed(1).replace(/\.0$/, "")} Years</div>
        </div>
      </div>
      <div style={noteBox}>
        <span style={{ background: "#3B82F6", color: "white", width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontFamily: "serif", flexShrink: 0 }}>i</span>
        <span style={{ color: "#E2E8F0", fontSize: 16, fontWeight: 500 }}>These details help us calculate your outstanding amount and potential savings.</span>
      </div>
    </div>
  );
}

function Card2({ r, bank, id }: { r: CalcResult; bank: string; id?: string }) {
  const circle: React.CSSProperties = { background: "#2563EB", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, marginLeft: "auto", marginRight: "auto", fontWeight: "bold", fontSize: 20 };
  const bar = (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={20} x2={18} y2={10} /><line x1={12} y1={20} x2={12} y2={4} /><line x1={6} y1={20} x2={6} y2={14} /></svg>
  );
  return (
    <div id={id} className="share-card card-2-theme">
      <div className="card-bg-glow" />
      <Brand bank={bank} />
      <div className="card-heading-section">
        <h1 className="card-main-title">Your <span style={{ color: "#60A5FA" }}>Loan Today</span></h1>
        <p className="card-subtitle">Here’s where you stand today.</p>
      </div>
      <div className="card-outstanding-hero" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", paddingLeft: 120, position: "relative" }}>
        <div style={{ position: "absolute", left: 30, top: "50%", transform: "translateY(-50%)" }}>
          <svg width={64} height={64} viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
          </svg>
        </div>
        <span className="hero-tag" style={{ textAlign: "left", margin: 0 }}>CURRENT OUTSTANDING AMOUNT</span>
        <div className="hero-amount" style={{ textAlign: "left", margin: "4px 0" }}>{formatCurrency(r.outstandingBalance)}</div>
        <div className="hero-supporting-group" style={{ justifyContent: "flex-start" }}><span className="hero-subtitle">Remaining loan balance</span></div>
      </div>
      <div className="card-timeline-section">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, color: "#E2E8F0", fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={10} /><polyline points="8 12 12 16 16 12" /><line x1={12} y1={8} x2={12} y2={16} /></svg>
          LOAN TIMELINE
        </div>
        <div className="timeline-dates-row" style={{ marginTop: 10 }}>
          {[
            ["Loan Started", formatMonthYear(r.issueDate), "#93C5FD"],
            ["First EMI", formatMonthYear(r.firstEmiDate), "#93C5FD"],
            ["Today", formatMonthYear(r.today), "#F1F5F9"],
          ].map(([label, val, color]) => (
            <div className="timeline-date-item" key={label}>
              <span className="td-label" style={{ textTransform: "none", fontSize: 15, color: "#F1F5F9" }}>{label}</span>
              <strong className="td-value" style={{ color, fontSize: 18 }}>{val}</strong>
            </div>
          ))}
        </div>
        <div className="card-progress-wrapper" style={{ marginTop: 25 }}>
          <div className="progress-counts-header">
            <span className="count-paid" style={{ color: "#34D399" }}>{r.elapsed} EMIs PAID</span>
            <span className="count-percent" style={{ color: "#F8FAFC" }}>{r.percentPaid}% COMPLETED</span>
            <span className="count-left" style={{ color: "#F8FAFC" }}>{r.remainingMonths} EMIs LEFT</span>
          </div>
          <div className="card-progress-track">
            <div className="card-progress-fill" style={{ width: `${r.percentPaid}%`, background: "linear-gradient(90deg, #3B82F6 0%, #34D399 100%)" }} />
          </div>
        </div>
      </div>
      <div className="card-stats-triad" style={{ gap: 12 }}>
        <div className="stat-triad-card" style={{ padding: "20px 12px" }}>
          <div style={circle}>₹</div><span className="st-label">CURRENT EMI</span>
          <strong className="st-value">{formatCurrency(r.monthlyEmi)}</strong><span className="st-sub">Monthly EMI</span>
        </div>
        <div className="stat-triad-card" style={{ padding: "20px 12px" }}>
          <div style={circle}>%</div><span className="st-label">TOTAL INTEREST</span>
          <strong className="st-value">{formatCompactLakh(r.totalOriginalInterest)}</strong><span className="st-sub">Interest over loan</span>
        </div>
        <div className="stat-triad-card" style={{ padding: "20px 12px" }}>
          <div style={circle}>{bar}</div><span className="st-label">TOTAL PAYMENT</span>
          <strong className="st-value">{formatCompactLakh(r.totalOriginalPayment)}</strong><span className="st-sub">Total paid over loan</span>
        </div>
      </div>
      <div style={noteBox}>
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ color: "#E2E8F0", fontSize: 15, fontWeight: 500 }}>You&apos;ve completed {r.percentPaid}% of your loan.</span>
          <span style={{ color: "#E2E8F0", fontSize: 15, fontWeight: 500 }}>You still have {r.remainingMonths} EMIs left.</span>
        </div>
      </div>
    </div>
  );
}

function Card3({ r, id }: { r: CalcResult; id?: string }) {
  const rate = `${r.interestRate.toFixed(2)}%`;
  const newRate = r.specialRate.toFixed(2);
  const chip: React.CSSProperties = { flex: 1, padding: "12px 6px", textAlign: "center", borderRadius: 12, background: "rgba(15, 31, 58, 0.85)", border: "1.5px solid rgba(52, 211, 153, 0.2)" };
  const bar = (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1={18} y1={20} x2={18} y2={10} /><line x1={12} y1={20} x2={12} y2={4} /><line x1={6} y1={20} x2={6} y2={14} /></svg>
  );
  const cols: { icon: React.ReactNode; label: string; cut: string; nw: string; sub: string }[] = [
    { icon: "₹", label: "MONTHLY EMI", cut: formatCurrency(r.monthlyEmi), nw: formatCurrency(r.specialEmi), sub: `New EMI @ ${newRate}%` },
    { icon: "%", label: "TOTAL INTEREST", cut: formatCompactLakh(r.totalOriginalInterest), nw: formatCompactLakh(r.specialInterest), sub: `Interest @ ${newRate}%` },
    { icon: bar, label: "TOTAL PAYMENT", cut: formatCompactLakh(r.totalOriginalPayment), nw: formatCompactLakh(r.specialTotal), sub: "Total Over Loan" },
  ];
  const svgProps = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "#94A3B8", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <div id={id} className="share-card card-3-theme">
      <div className="card-bg-glow emerald" />
      <Brand bank="None" emerald />
      <div className="card-heading-section">
        <h1 className="card-main-title">Special <span style={{ color: "#34D399" }}>Refinance Offer</span></h1>
        <p className="card-subtitle">See how much you could save.</p>
      </div>
      <div className="card-stats-triad card3-triad">
        {cols.map((c) => (
          <div className="stat-triad-card card3-stat-card" key={c.label}>
            <div className="card3-icon-bubble">{c.icon}</div>
            <span className="st-label">{c.label}</span>
            <div className="stat-cut-box"><span className="cut-rate-tag">{rate}</span><span className="cut-amount-val">{c.cut}</span></div>
            <div className="stat-cut-arrow">↓</div>
            <div className="stat-new-wrapper"><strong className="st-new-value">{c.nw}</strong></div>
            <span className="st-new-sub">{c.sub}</span>
          </div>
        ))}
      </div>
      <div className="card-savings-master" style={{ marginTop: 24 }}>
        <div className="savings-headline"><span className="sparkle-icon">✨</span><span style={{ textTransform: "none", fontSize: 22 }}>Your Potential Savings</span></div>
        <div className="savings-dual-grid">
          <div className="saving-hero-box">
            <span className="shb-label">Monthly Savings</span>
            <div className="shb-amount">{r.monthlyDiff > 0 ? `${formatCurrency(r.monthlyDiff)} / month` : "₹0 / month"}</div>
            <span className="shb-friendly-note">Less EMI every month</span>
          </div>
          <div className="saving-hero-box">
            <span className="shb-label">Yearly Savings</span>
            <div className="shb-amount">{r.yearlyDiff > 0 ? `${formatCurrency(r.yearlyDiff)} / year` : "₹0 / year"}</div>
            <span className="shb-friendly-note">More money saved every year</span>
          </div>
        </div>
        <div className="saving-total-banner">
          <div className="stb-text-wrap" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span className="stb-label">Total Potential Savings</span>
              <div className="stb-amount">{r.totalDiff > 0 ? `${formatCurrency(r.totalDiff)}+` : "₹0"}</div>
            </div>
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
          </div>
        </div>
      </div>
      <div className="card-refinance-terms" style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <div className="term-chip" style={chip}>
          <div style={{ marginBottom: 6 }}><svg {...svgProps}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div>
          <span className="tc-label" style={{ fontSize: 11, textTransform: "none" }}>Balance to Refinance</span>
          <strong className="tc-value" style={{ fontSize: 15 }}>{formatCurrency(r.refinancePrincipal)}</strong>
        </div>
        <div className="term-chip" style={chip}>
          <div style={{ marginBottom: 6 }}><svg {...svgProps}><line x1={19} y1={5} x2={5} y2={19} /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg></div>
          <span className="tc-label" style={{ fontSize: 11, textTransform: "none" }}>New Rate</span>
          <strong className="tc-value" style={{ fontSize: 15 }}>{newRate}% p.a.</strong>
        </div>
        <div className="term-chip" style={chip}>
          <div style={{ marginBottom: 6 }}><svg {...svgProps}><circle cx={12} cy={12} r={10} /><polyline points="12 6 12 12 16 14" /></svg></div>
          <span className="tc-label" style={{ fontSize: 11, textTransform: "none" }}>New Tenure</span>
          <strong className="tc-value" style={{ fontSize: 15 }}>{r.specialMonths} Months</strong>
        </div>
      </div>
      <div style={{ ...noteBox, border: "1.5px solid rgba(52, 211, 153, 0.2)" }}>
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg>
        <span style={{ color: "#E2E8F0", fontSize: 15, fontWeight: 500 }}>By refinancing, you could reduce your interest cost and become debt-free faster.</span>
      </div>
    </div>
  );
}
