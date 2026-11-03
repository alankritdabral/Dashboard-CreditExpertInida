import React from "react";

/**
 * Single 1200px-wide "Loan Refinance Summary" card, rendered to PNG by html2canvas.
 * Uses only plain colours/gradients (no backdrop-filter) so the export matches the preview.
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

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Math.round(n));
const monthYear = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });

const FONT = `"Inter", "Segoe UI", "Noto Sans", Roboto, Arial, sans-serif`;
const MINT = "#34D399";
const MUTED = "#9FB3CC";

const panel: React.CSSProperties = {
  background: "#0F2547",
  border: "1.5px solid #1F3A66",
  borderRadius: 22,
  padding: "26px 30px",
};

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: last ? "none" : "1px solid #1F3A66" }}>
      <span style={{ fontSize: 21, color: "#C9D6E8" }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{value}</span>
    </div>
  );
}

function Metric({ value, label, last }: { value: string; label: string; last?: boolean }) {
  return (
    <div style={{ padding: "14px 0", borderBottom: last ? "none" : "1px solid rgba(159,179,204,0.25)" }}>
      <div style={{ fontSize: 34, fontWeight: 800, color: "#fff" }}>{value}</div>
      <div style={{ fontSize: 19, color: MUTED, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function RefinanceSummaryCard({ r, id, company = "Credit Expert India" }: { r: SummaryData; id?: string; company?: string }) {
  const saving = r.totalDiff > 0;
  const rate = r.interestRate.toFixed(2);
  const newRate = r.specialRate.toFixed(2);

  return (
    <div
      id={id}
      style={{
        width: CARD_WIDTH,
        boxSizing: "border-box",
        padding: "44px 46px 46px",
        background: "linear-gradient(160deg, #0A1B38 0%, #0B2A52 55%, #08203F 100%)",
        color: "#fff",
        fontFamily: FONT,
        display: "flex",
        flexDirection: "column",
        gap: 26,
      }}
    >
      {/* Header */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 32, fontWeight: 800 }}>
            <span style={{ width: 30, height: 30, background: MINT, transform: "rotate(45deg)", borderRadius: 6, display: "inline-block" }} />
            {company}
          </div>
          <div style={{ border: "1.5px solid #2B4A7A", borderRadius: 999, padding: "12px 28px", fontSize: 22, color: "#DCE7F5" }}>Loan Refinance Analysis</div>
        </div>
        <h1 style={{ fontSize: 58, fontWeight: 800, margin: "30px 0 10px", letterSpacing: -1 }}>Your Loan Refinance Summary</h1>
        <p style={{ fontSize: 26, color: MUTED, margin: 0, lineHeight: 1.35 }}>
          Complete view of your current loan, outstanding amount and how much you can save at <strong style={{ color: MINT }}>{newRate}%</strong>.
        </p>
      </div>

      {/* Middle: current details + comparison */}
      <div style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
        <div style={{ width: 440, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={panel}>
            <div style={{ fontSize: 27, fontWeight: 800, marginBottom: 8 }}>Your Current Loan Details</div>
            <Row label="Loan Amount (Original)" value={inr(r.loanAmount)} />
            <Row label="Loan Tenure" value={`${r.totalMonths} Months`} />
            <Row label="Loan Started" value={monthYear(r.issueDate)} />
            <Row label="First EMI" value={monthYear(r.firstEmiDate)} />
            <Row label="Current Interest Rate" value={`${rate}% p.a.`} />
            <Row label="Current EMI" value={inr(r.monthlyEmi)} last />
          </div>
          <div style={panel}>
            <div style={{ fontSize: 27, fontWeight: 800, marginBottom: 14 }}>Your Loan Progress</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 28, fontWeight: 800 }}>{r.elapsed} EMIs Paid</span>
              <span style={{ fontSize: 21, color: "#C9D6E8" }}>{r.percentPaid}% Completed</span>
            </div>
            <div style={{ height: 14, borderRadius: 7, background: "#1F3A66", margin: "14px 0 10px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.max(r.percentPaid, 2)}%`, background: `linear-gradient(90deg, ${MINT}, #6EE7B7)`, borderRadius: 7 }} />
            </div>
            <Row label="EMIs Remaining" value={`${r.remainingMonths} Months`} />
            <Row label="Current Outstanding" value={inr(r.outstandingBalance)} last />
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ ...panel, flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 27, fontWeight: 800, marginBottom: 18 }}>
              Loan Comparison: Current vs Refinance <span style={{ color: MINT }}>({newRate}%)</span>
            </div>
            <div style={{ display: "flex", gap: 20, flex: 1 }}>
              <div style={{ flex: 1, background: "#0B1E3D", border: "1.5px solid #24426F", borderRadius: 18, padding: "22px 24px" }}>
                <span style={{ background: "#1B3560", borderRadius: 999, padding: "8px 20px", fontSize: 21, fontWeight: 700 }}>Current Loan</span>
                <div style={{ fontSize: 54, fontWeight: 800, margin: "22px 0 2px" }}>{rate}%<span style={{ fontSize: 26 }}> p.a.</span></div>
                <div style={{ fontSize: 19, color: MUTED, paddingBottom: 12, borderBottom: "1px solid rgba(159,179,204,0.25)" }}>Current Interest Rate</div>
                <Metric value={inr(r.monthlyEmi)} label="Monthly EMI" />
                <Metric value={inr(r.totalOriginalInterest)} label="Interest Payable" />
                <Metric value={inr(r.totalOriginalPayment)} label="Total Repayment" last />
              </div>
              <div style={{ flex: 1, background: "#0B3B3B", border: `2px solid ${MINT}`, borderRadius: 18, padding: "22px 24px" }}>
                <span style={{ background: "#0F5A52", borderRadius: 999, padding: "8px 20px", fontSize: 21, fontWeight: 700 }}>✓ Refinance Offer</span>
                <div style={{ fontSize: 54, fontWeight: 800, margin: "22px 0 2px" }}>{newRate}%<span style={{ fontSize: 26 }}> p.a.</span></div>
                <div style={{ fontSize: 19, color: "#A7D8C8", paddingBottom: 12, borderBottom: "1px solid rgba(167,216,200,0.3)" }}>New Interest Rate</div>
                <Metric value={inr(r.specialEmi)} label="Monthly EMI" />
                <Metric value={inr(r.specialInterest)} label="Interest Payable" />
                <Metric value={inr(r.specialTotal)} label="Total Repayment" last />
              </div>
            </div>
          </div>

          <div style={{ background: "#0B3B3B", border: `2px solid ${MINT}`, borderRadius: 22, padding: "24px 30px" }}>
            <div style={{ fontSize: 27, fontWeight: 800, color: MINT, marginBottom: 14 }}>Your Savings with Refinance</div>
            <div style={{ display: "flex", textAlign: "center" }}>
              {[
                [r.monthlyDiff > 0 ? inr(r.monthlyDiff) : "₹0", "Less EMI (every month)"],
                [saving ? inr(r.totalDiff) : "₹0", `Total Saved over ${r.specialMonths} months`],
                [r.monthlyDiff > 0 ? inr(r.monthlyDiff * 12) : "₹0", "Saved every year"],
              ].map(([v, l], i) => (
                <div key={l} style={{ flex: 1, padding: "0 10px", borderLeft: i ? "1px solid rgba(167,216,200,0.35)" : "none" }}>
                  <div style={{ fontSize: 36, fontWeight: 800 }}>{v}</div>
                  <div style={{ fontSize: 19, color: "#C5E6DA", marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Flow strip */}
      <div style={{ ...panel, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "26px 36px" }}>
        {[
          [inr(r.loanAmount), "Loan Taken (Original Amount)"],
          [inr(r.outstandingBalance), `Current Outstanding (After ${r.elapsed} EMIs)`],
          [`${newRate}% p.a.`, "Refinance Interest Rate (New)"],
          [inr(r.specialEmi), `Your New EMI (for ${r.specialMonths} Months)`],
        ].map(([v, l], i, arr) => (
          <React.Fragment key={l}>
            <div style={{ textAlign: "center", width: 220 }}>
              <div style={{ fontSize: 33, fontWeight: 800 }}>{v}</div>
              <div style={{ fontSize: 18, color: "#C9D6E8", marginTop: 4, lineHeight: 1.25 }}>{l}</div>
            </div>
            {i < arr.length - 1 && <span style={{ fontSize: 34, color: MUTED }}>→</span>}
          </React.Fragment>
        ))}
      </div>

      {/* CTA */}
      <div style={{ background: "linear-gradient(90deg, #0F6B4F, #0E8A62)", border: `2px solid ${MINT}`, borderRadius: 20, padding: "24px 34px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 40, fontWeight: 800 }}>
          {saving ? <>Refinance Now &amp; Save {inr(r.totalDiff)}</> : <>Talk to us about your refinance options</>}
        </div>
        <div style={{ background: "#F4F8FF", color: "#0A2540", fontSize: 25, fontWeight: 800, padding: "16px 30px", borderRadius: 14 }}>Check Eligibility →</div>
      </div>
    </div>
  );
}
