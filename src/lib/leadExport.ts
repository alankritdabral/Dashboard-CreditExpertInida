import type { Lead } from "@/lib/leads";
import { leadKinds, LEAD_KIND_LABEL } from "@/lib/leadKinds";

// Client-safe: builds an .xlsx of the leads currently on screen and downloads it.
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export async function downloadLeadsExcel(leads: Lead[], label = "leads") {
  const XLSX = await import("xlsx");
  const rows = leads.map((l) => {
    const report = l.reports[0];
    return {
      Name: l.name,
      Phone: l.phone,
      "Lead type": leadKinds(l).map((k) => LEAD_KIND_LABEL[k]).join(", "),
      Source: l.source,
      Requirement: l.requirement,
      "Net salary": l.netSalary ?? "",
      "Ongoing EMI": l.ongoingEmi ?? "",
      City: l.city ?? "",
      Status: l.status,
      "Assigned to": l.assignedToName ?? "",
      "Assigned to phone": l.assignedToPhone ?? "",
      "Assigned at": when(l.assignedAt),
      "Customer WhatsApp": l.welcomeStatus ?? "",
      "Employee WhatsApp": l.employeeNotifyStatus ?? "",
      Enquiries: l.enquiryCount,
      "First seen": when(l.firstSeenAt),
      "Latest enquiry": when(l.createdAt),
      "Credit score": l.latestScore ?? "",
      "Bureau (latest report)": report?.bureau ?? "",
      "Report date": when(report?.createdAt ?? null),
      "Reports on file": l.reports.length,
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] || { Name: 1 }).map((k) => ({ wch: Math.min(32, Math.max(k.length + 2, 14)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  const day = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${label}-${day}.xlsx`);
}
