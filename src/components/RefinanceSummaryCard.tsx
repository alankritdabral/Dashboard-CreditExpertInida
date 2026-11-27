"use client";

import React, { createContext, useContext, useId } from "react";
import { DEFAULT_SUMMARY_THEME, type SummaryTheme } from "./summaryThemes";

/**
 * Single 1200px-wide "Loan Refinance Summary" card, rendered to PNG by html2canvas.
 * Uses only plain colours/gradients and inline SVG (no backdrop-filter, CSS filters or box-shadow — html2canvas draws shadows as grey frames)
 * so the export matches the preview.
 */

export interface SummaryData {
  loanAmount: number;
  totalMonths: number;
  issueDate: Date;
  firstEmiDate: Date;
  interestRate: number;
  monthlyEmi: number;
  totalOriginalInterest: number;
  totalOriginalPayment: number;
  elapsed: number;
  remainingMonths: number;
  percentPaid: number;
  outstandingBalance: number;
  specialRate: number;
  specialMonths: number;
  specialEmi: number;
  specialInterest: number;
  specialTotal: number;
  monthlyDiff: number;
  totalDiff: number;
}

export const CARD_WIDTH = 1200;
/** Page colour behind the card; used for the preview frame and the PNG export. */
export const CARD_BG = DEFAULT_SUMMARY_THEME.pageBg;

const ThemeCtx = createContext<SummaryTheme>(DEFAULT_SUMMARY_THEME);
const useT = () => useContext(ThemeCtx);

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Math.round(n));
const monthYear = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });

const FONT = `"Inter", "Segoe UI", "Noto Sans", Roboto, Arial, sans-serif`;
const GREEN = "#16A34A";
const GREEN_DARK = "#0B7A3E";

const panelStyle = (t: SummaryTheme): React.CSSProperties => ({
  background: t.panelBg,
  border: `1.5px solid ${t.line}`,
  borderRadius: 26,
  padding: "28px 30px",
});

/* ---------- illustrations (inline SVG so html2canvas can rasterise them) ---------- */

/** Amortas loop mark + wordmark, same artwork as the website logo. */
function AmortasLogo({ name }: { name: string }) {
  const t = useT();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width="68" height="43" viewBox="56 36 734 458" fill="none">
        <path
          d="M262 378 C215 455 116 462 98 376 C90 304 155 260 228 262 C335 280 450 425 644 437 C752 442 756 345 711 267 C676 199 627 66 543 77 C488 86 452 145 386 238"
          stroke={t.logo.mark}
          strokeWidth="58"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1.6, lineHeight: 1, color: t.logo.word }}>{name}</span>
        <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: 0.4, lineHeight: 1, color: t.hero.sub }}>www.amortas.com</span>
      </div>
    </div>
  );
}

function BankShield() {
  const t = useT();
  const k = useId().replace(/:/g, "");
  const p = t.bank;
  return (
    <svg width="400" height="330" viewBox="0 0 400 330">
      <defs>
        <linearGradient id={`rsc-bank-light-${k}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor={p.l1} />
        </linearGradient>
        <linearGradient id={`rsc-bank-mid-${k}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.m0} />
          <stop offset="1" stopColor={p.m1} />
        </linearGradient>
        <linearGradient id={`rsc-bank-base-${k}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.b0} />
          <stop offset="1" stopColor={p.b1} />
        </linearGradient>
        <linearGradient id={`rsc-shield-${k}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4ADE80" />
          <stop offset="1" stopColor="#0E9F4F" />
        </linearGradient>
        <radialGradient id={`rsc-glow-${k}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={p.glow} stopOpacity={p.glowOp} />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="190" cy="165" rx="190" ry="160" fill={`url(#rsc-glow-${k})`} />
      {/* platform */}
      <ellipse cx="185" cy="290" rx="165" ry="26" fill={p.plat} opacity="0.55" />
      <rect x="40" y="262" width="290" height="24" rx="6" fill={`url(#rsc-bank-base-${k})`} />
      <rect x="58" y="242" width="254" height="22" rx="5" fill={`url(#rsc-bank-mid-${k})`} />
      {/* columns */}
      {[78, 136, 194, 252].map((x) => (
        <g key={x}>
          <rect x={x} y="132" width="38" height="112" rx="4" fill={`url(#rsc-bank-light-${k})`} />
          <rect x={x + 26} y="132" width="12" height="112" rx="4" fill={p.side} opacity="0.6" />
          <rect x={x - 5} y="124" width="48" height="12" rx="3" fill={p.cap} />
          <rect x={x - 5} y="236" width="48" height="10" rx="3" fill={p.capBase} />
        </g>
      ))}
      {/* entablature + pediment */}
      <rect x="56" y="102" width="258" height="24" rx="5" fill={`url(#rsc-bank-mid-${k})`} />
      <path d="M185 22 L330 102 H40 Z" fill={`url(#rsc-bank-light-${k})`} />
      <path d="M185 46 L282 96 H88 Z" fill={p.ped} opacity="0.75" />
      <circle cx="185" cy="78" r="13" fill="#FFFFFF" />
      {/* shield */}
      <path d="M296 150 L360 172 V222 C360 262 334 290 296 306 C258 290 232 262 232 222 V172 Z" fill="#083B2A" opacity="0.35" transform="translate(6 8)" />
      <path d="M296 150 L360 172 V222 C360 262 334 290 296 306 C258 290 232 262 232 222 V172 Z" fill={`url(#rsc-shield-${k})`} stroke="#BBF7D0" strokeWidth="5" strokeLinejoin="round" />
      <path d="M266 228 L288 250 L328 204" fill="none" stroke="#FFFFFF" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoneyBag() {
  const k = useId().replace(/:/g, "");
  return (
    <svg width="170" height="150" viewBox="0 0 170 150">
      <defs>
        <linearGradient id={`rsc-bag-${k}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE27A" />
          <stop offset="1" stopColor="#E0940A" />
        </linearGradient>
        <linearGradient id={`rsc-coin-${k}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE78F" />
          <stop offset="1" stopColor="#E8A317" />
        </linearGradient>
      </defs>
      {/* coin stacks */}
      {[0, 1, 2].map((i) => (
        <g key={`l${i}`}>
          <ellipse cx="34" cy={132 - i * 13} rx="28" ry="9" fill="#B9770A" />
          <ellipse cx="34" cy={127 - i * 13} rx="28" ry="9" fill={`url(#rsc-coin-${k})`} />
        </g>
      ))}
      {[0, 1].map((i) => (
        <g key={`r${i}`}>
          <ellipse cx="140" cy={134 - i * 13} rx="26" ry="8.5" fill="#B9770A" />
          <ellipse cx="140" cy={129 - i * 13} rx="26" ry="8.5" fill={`url(#rsc-coin-${k})`} />
        </g>
      ))}
      {/* bag */}
      <path d="M66 30 C58 18 62 8 70 6 C78 12 82 4 88 4 C94 4 98 12 106 6 C114 8 118 18 110 30 Z" fill="#F2B21B" />
      <path d="M62 40 C30 62 22 96 30 118 C36 136 54 142 88 142 C122 142 140 136 146 118 C154 96 146 62 114 40 Z" fill={`url(#rsc-bag-${k})`} />
      <rect x="60" y="28" width="56" height="14" rx="7" fill="#B9770A" />
      <path d="M72 72 H104 M72 84 H104 M76 72 C96 72 96 96 76 96 L98 118" fill="none" stroke="#7A4A05" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBadge({ children, color, bg }: { children: React.ReactNode; color?: string; bg?: string }) {
  const t = useT();
  color = color ?? t.accent;
  bg = bg ?? t.accentSoft;
  return (
    <span style={{ width: 52, height: 52, borderRadius: 14, background: bg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

function PanelTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  const t = useT();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 800, color: t.ink, marginBottom: 14 }}>
      {icon}
      {children}
    </div>
  );
}

function Row({ label, value, last, accent }: { label: string; value: string; last?: boolean; accent?: boolean }) {
  const t = useT();
  return (
    <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "17px 0", borderBottom: last ? "none" : `1.5px solid ${t.line}` }}>
      <span style={{ fontSize: 22, color: t.slate, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 800, color: accent ? t.accent : t.ink }}>{value}</span>
    </div>
  );
}

function Check({ size = 26, color = GREEN }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="11" fill={color} />
      <path d="M7 12.5 L10.5 16 L17 9" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OfferColumn({ tone, pill, rate, emi }: { tone: "current" | "offer"; pill: React.ReactNode; rate: string; emi: string }) {
  const t = useT();
  const offer = tone === "offer";
  const main = offer ? GREEN_DARK : t.ink;
  const divider = offer ? "#BFE8CD" : t.cur.divider;
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        position: "relative",
        background: offer ? "linear-gradient(180deg, #EAFBF0 0%, #DDF6E6 100%)" : `linear-gradient(180deg, ${t.cur.bg0} 0%, ${t.cur.bg1} 100%)`,
        border: offer ? `2.5px solid ${GREEN}` : `1.5px solid ${t.cur.border}`,
        borderRadius: 22,
        padding: "40px 18px 34px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {offer && (
        <div style={{ position: "absolute", top: -22, right: 18, background: GREEN_DARK, color: "#fff", borderRadius: 999, padding: "8px 18px", fontSize: 19, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M12 2 L14.9 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.1 8.6 Z" fill="#FDE047" />
          </svg>
          Best Offer
        </div>
      )}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: offer ? "#C9F0D6" : t.cur.pillBg, color: offer ? GREEN_DARK : t.cur.pillText, borderRadius: 999, padding: "9px 18px", fontSize: 20, fontWeight: 800, whiteSpace: "nowrap" }}>
        {pill}
      </div>
      <div style={{ fontSize: 66, fontWeight: 800, color: main, lineHeight: 1, marginTop: 40, letterSpacing: -2 }}>{rate}%</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: main, marginTop: 10 }}>p.a.</div>
      <div style={{ width: "86%", height: 0, borderTop: `1.5px solid ${divider}`, margin: "28px 0 0" }} />
      <div style={{ fontSize: 50, fontWeight: 800, color: main, lineHeight: 1.1, marginTop: 28 }}>{emi}</div>
      <div style={{ fontSize: 25, color: t.slate, marginTop: 6, fontWeight: 500 }}>Monthly EMI</div>
    </div>
  );
}

export function RefinanceSummaryCard({ r, id, company = "Amortas", theme = DEFAULT_SUMMARY_THEME }: { r: SummaryData; id?: string; company?: string; theme?: SummaryTheme }) {
  const t = theme;
  const panel = panelStyle(t);
  const saving = r.totalDiff > 0;
  const rate = r.interestRate.toFixed(2);
  const newRate = r.specialRate.toFixed(2);

  return (
    <ThemeCtx.Provider value={t}>
    <div id={id} style={{ width: CARD_WIDTH, boxSizing: "border-box", background: t.pageBg, color: t.ink, fontFamily: FONT }}>
      {/* Hero */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          padding: "40px 48px 150px",
          background: t.hero.bg,
          color: t.hero.text,
          borderRadius: "0 0 44px 44px",
          border: t.hero.border ? `1.5px solid ${t.hero.border}` : "none",
          borderTop: "none",
        }}
      >
        <div style={{ position: "absolute", right: 30, top: 108 }}>
          <BankShield />
        </div>
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <AmortasLogo name={company} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px solid ${t.hero.pillBorder}`, background: t.hero.pillBg, borderRadius: 999, padding: "11px 24px", fontSize: 21, fontWeight: 600, color: t.hero.pillText }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.hero.pillIcon} strokeWidth="2.4" strokeLinecap="round">
              <path d="M5 20 V12 M12 20 V5 M19 20 V9" />
            </svg>
            Loan Refinance Analysis
          </div>
        </div>
        <h1 style={{ position: "relative", fontSize: 82, fontWeight: 800, margin: "52px 0 18px", lineHeight: 1.08, letterSpacing: -2, maxWidth: 720 }}>
          A Smarter Way to
          <br />
          Reduce Your Debt
        </h1>
        <p style={{ position: "relative", fontSize: 27, color: t.hero.sub, margin: 0, maxWidth: 680, lineHeight: 1.35 }}>
          See how much you can save with loan refinance at <strong style={{ color: t.hero.hi }}>{newRate}% p.a.</strong>
        </p>
      </div>

      {/* Body */}
      <div style={{ position: "relative", marginTop: -104, padding: "0 40px 40px", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", gap: 26, alignItems: "stretch" }}>
          <div style={{ ...panel, width: 450, flexShrink: 0, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
            <PanelTitle
              icon={
                <IconBadge>
                  <path d="M7 3 H14 L19 8 V21 H7 Z" />
                  <path d="M14 3 V8 H19 M10 13 H16 M10 17 H16" />
                </IconBadge>
              }
            >
              Your Loan Details
            </PanelTitle>
            <Row label="Loan Amount (Original)" value={inr(r.loanAmount)} />
            <Row label="Loan Tenure" value={`${r.totalMonths} Months`} />
            <Row label="Loan Started" value={monthYear(r.issueDate)} />
            <Row label="First EMI" value={monthYear(r.firstEmiDate)} />
            <Row label="Current Interest Rate" value={`${rate}% p.a.`} accent />
            <Row label="Current EMI" value={inr(r.monthlyEmi)} accent last />
          </div>

          <div style={{ ...panel, flex: 1, minWidth: 0, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
            <PanelTitle
              icon={
                <IconBadge>
                  <path d="M4 8 H20 M16 4 L20 8 L16 12" />
                  <path d="M20 16 H4 M8 12 L4 16 L8 20" />
                </IconBadge>
              }
            >
              Refinance Comparison
            </PanelTitle>
            <div style={{ display: "flex", gap: 20, flex: 1, marginTop: 14 }}>
              <OfferColumn tone="current" pill="Current Loan" rate={rate} emi={inr(r.monthlyEmi)} />
              <OfferColumn
                tone="offer"
                pill={
                  <>
                    <Check size={24} /> Refinance Offer
                  </>
                }
                rate={newRate}
                emi={inr(r.specialEmi)}
              />
            </div>
          </div>
        </div>

        {/* Savings banner */}
        <div
          style={{
            background: t.savings.bg,
            border: `2px solid ${t.savings.border}`,
            borderRadius: 28,
            padding: "26px 36px",
            display: "flex",
            alignItems: "center",
            gap: 30,
            color: "#fff",
          }}
        >
          <MoneyBag />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: t.savings.title }}>{saving ? "Your Potential Savings" : "Let's find a better deal"}</div>
            <div style={{ fontSize: saving ? 80 : 46, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5, margin: "2px 0" }}>
              {saving ? inr(r.totalDiff) : "Talk to us about your options"}
            </div>
            <div style={{ fontSize: 25, color: t.savings.sub, fontWeight: 500 }}>
              {saving ? `over ${r.specialMonths} months` : "Our experts will match you with the right lender"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ background: t.savings.btnBg, color: t.savings.btnText, fontSize: 27, fontWeight: 800, padding: "20px 32px", borderRadius: 18, whiteSpace: "nowrap" }}>
              Check Eligibility →
            </div>
            <div style={{ fontSize: 20, color: t.savings.sub, marginTop: 12, fontWeight: 500 }}>Discover your options</div>
          </div>
        </div>

        {/* Progress + savings breakdown */}
        <div style={{ display: "flex", gap: 26, alignItems: "stretch" }}>
          <div style={{ ...panel, width: 450, flexShrink: 0, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
            <PanelTitle
              icon={
                <IconBadge>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7 V12 L15.5 14" />
                </IconBadge>
              }
            >
              Your Loan Progress
            </PanelTitle>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 800 }}>{r.elapsed} EMIs Paid</span>
              <span style={{ fontSize: 21, color: t.slate, fontWeight: 500 }}>{r.percentPaid}% Completed</span>
            </div>
            <div style={{ height: 16, borderRadius: 8, background: t.track, margin: "14px 0 8px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.max(r.percentPaid, 2)}%`, background: `linear-gradient(90deg, ${t.progress[0]}, ${t.progress[1]})`, borderRadius: 8 }} />
            </div>
            <Row label="EMIs Remaining" value={`${r.remainingMonths} Months`} />
            <Row label="Current Outstanding" value={inr(r.outstandingBalance)} last />
          </div>

          <div style={{ ...panel, flex: 1, minWidth: 0, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
            <PanelTitle
              icon={
                <IconBadge color={GREEN_DARK} bg="#DCF5E5">
                  <path d="M4 17 L10 11 L14 15 L20 8" />
                  <path d="M15 8 H20 V13" />
                </IconBadge>
              }
            >
              Your Savings with Refinance
            </PanelTitle>
            <div style={{ display: "flex", gap: 16, flex: 1, marginTop: 6 }}>
              {[
                [r.monthlyDiff > 0 ? inr(r.monthlyDiff) : "₹0", "Less EMI every month"],
                [r.monthlyDiff > 0 ? inr(r.monthlyDiff * 12) : "₹0", "Saved every year"],
                [inr(r.specialEmi), `New EMI for ${r.specialMonths} months`],
              ].map(([v, l], i) => (
                <div
                  key={l}
                  style={{
                    flex: 1,
                    background: i < 2 ? "#EAFBF0" : t.cur.bg0,
                    border: `1.5px solid ${i < 2 ? "#BFE8CD" : t.cur.border}`,
                    borderRadius: 18,
                    padding: "20px 10px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ fontSize: 34, fontWeight: 800, color: i < 2 ? GREEN_DARK : t.ink }}>{v}</div>
                  <div style={{ fontSize: 19, color: t.slate, marginTop: 6, fontWeight: 500, lineHeight: 1.25 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 18, color: t.footnote, fontWeight: 500 }}>
          Indicative figures based on the details shared. Final rate and EMI are subject to lender approval. · {company}
          <div style={{ fontSize: 30, fontWeight: 800, color: t.ink, letterSpacing: 0.5, marginTop: 14 }}>www.amortas.com</div>
        </div>
      </div>
    </div>
    </ThemeCtx.Provider>
  );
}
