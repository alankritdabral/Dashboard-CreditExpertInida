import { getAllBranchUsers } from "@/lib/user-service";
import { pullCountsByEmployee } from "@/lib/cibil/reportStore";
import { getTransporter } from "@/lib/email-service";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const DEFAULT_REPORT_RECIPIENT = "akash.tyagi@creditexpertindia.com";

type Row = { name: string; email: string; today: number };
type BranchGroup = { branch: string; rows: Row[]; today: number };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Start of the current India calendar day, as a UTC instant. */
function istDayStart(now: Date) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS);
}

/** Employees grouped by branch with today's (IST) and all-time CIBIL pull counts, keyed on email. */
export async function buildBranchReport(now = new Date()) {
  const start = istDayStart(now);
  const [users, todayCounts] = await Promise.all([
    getAllBranchUsers(),
    pullCountsByEmployee({ startDate: start.toISOString(), endDate: now.toISOString() }),
  ]);

  const seen = new Set<string>();
  const groups = new Map<string, BranchGroup>();
  for (const u of users as any[]) {
    const email = String(u.email || "").toLowerCase().trim();
    if (!email || u.role === "admin" || seen.has(email)) continue;
    seen.add(email);
    const branch = String(u.branch || "Online").trim();
    const key = branch.toLowerCase();
    if (!groups.has(key)) groups.set(key, { branch, rows: [], today: 0 });
    groups.get(key)!.rows.push({
      name: String(u.name || email).trim(),
      email,
      today: todayCounts.counts[email]?.count ?? 0,
    });
  }

  const branches = Array.from(groups.values())
    .map((g) => {
      const rows = g.rows.sort((a, b) => b.today - a.today || a.name.localeCompare(b.name));
      return { ...g, rows, today: rows.reduce((n, r) => n + r.today, 0) };
    })
    .sort((a, b) => b.today - a.today || a.branch.localeCompare(b.branch));

  return {
    date: new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "Asia/Kolkata" }).format(now),
    branches,
    today: branches.reduce((n, b) => n + b.today, 0),
    unattributedToday: todayCounts.unattributed,
  };
}

export function renderBranchReportHtml(r: Awaited<ReturnType<typeof buildBranchReport>>, demo = false) {
  const th = "padding:8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#64748b;text-align:";
  const blocks = r.branches
    .map(
      (b) => `
    <div style="border:1px solid #e2e8f0;border-radius:10px;margin:0 0 16px;overflow:hidden">
      <div style="background:#f1f5f9;padding:10px 12px;font-size:15px;font-weight:700;color:#0f172a">
        ${esc(b.branch)}
        <span style="float:right;font-size:12px;font-weight:600;color:#475569">${b.today} ${b.today === 1 ? "pull" : "pulls"} today</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="background:#f8fafc"><th style="${th}left">Employee</th><th style="${th}right">CIBIL pulls today</th></tr>
        ${b.rows
          .map(
            (e) => `<tr style="border-top:1px solid #e2e8f0">
          <td style="padding:8px 10px;color:#0f172a"><strong>${esc(e.name)}</strong><br><span style="color:#94a3b8;font-size:11px">${esc(e.email)}</span></td>
          <td style="padding:8px 10px;text-align:right;font-weight:700;color:${e.today ? "#2563eb" : "#94a3b8"}">${e.today}</td></tr>`
          )
          .join("")}
      </table>
    </div>`
    )
    .join("");

  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;background:#fff">
    ${demo ? `<p style="background:#fef3c7;color:#92400e;padding:8px 12px;border-radius:8px;font-size:12px;margin:0 0 14px">Demo copy &mdash; the real report is sent daily at 7:00 PM IST.</p>` : ""}
    <h2 style="margin:0;color:#2563eb">Daily CIBIL Pull Report</h2>
    <p style="margin:4px 0 16px;color:#64748b;font-size:13px">${esc(r.date)} &middot; branch-wise, by employee</p>
    <p style="font-size:14px;color:#0f172a;margin:0 0 18px"><strong>${r.today}</strong> CIBIL pulls today${
      r.unattributedToday ? ` &middot; ${r.unattributedToday} today with no employee recorded` : ""
    }</p>
    ${blocks}
    <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:20px">Credit Expert India &middot; counts attributed by employee email</p>
  </div>`;
}

export async function sendBranchReport(to: string, demo = false) {
  const transporter = getTransporter();
  if (!transporter) throw new Error("SMTP is not configured (SMTP_USER/SMTP_PASS or EMAIL_USER/EMAIL_PASS)");
  const report = await buildBranchReport();
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || `"Credit Expert India" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
    to,
    subject: `${demo ? "[Demo] " : ""}Daily CIBIL pull report by branch - ${report.date}`,
    html: renderBranchReportHtml(report, demo),
  });
  return { messageId: info.messageId, today: report.today, branches: report.branches.length };
}
