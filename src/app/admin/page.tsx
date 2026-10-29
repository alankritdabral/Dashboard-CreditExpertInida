"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { CibilFetchForm } from "@/components/CibilFetchForm";
import { CreditReportDashboard } from "@/components/CreditReportDashboard";
import * as XLSX from "xlsx";
import {
  ShieldCheck,
  Database,
  Building2,
  Users,
  Activity,
  FileWarning,
  MessageSquare,
  LogOut,
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  X,
  CreditCard,
  User,
  Phone,
  FileSpreadsheet,
  Send,
  Upload,
} from "lucide-react";
import { CreditReportRecord, DashboardUser } from "@/lib/types";

export default function AdminDashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    "reports" | "fetch" | "users" | "activity" | "logs" | "whatsapp"
  >("reports");

  // Authentication check
  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // ==========================================
  // TAB 1: ALL REPORTS STATE
  // ==========================================
  const [reports, setReports] = useState<CreditReportRecord[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState("all");
  const [selectedSourceFilter, setSelectedSourceFilter] = useState("all");
  const [selectedBureauFilter, setSelectedBureauFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [viewingReport, setViewingReport] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const fetchAllReports = async () => {
    setReportsLoading(true);
    try {
      let url = `/api/reports?limit=1000&_t=${Date.now()}`;
      if (selectedBranchFilter !== "all") url += `&branch=${encodeURIComponent(selectedBranchFilter)}`;
      if (selectedSourceFilter !== "all") url += `&source=${encodeURIComponent(selectedSourceFilter)}`;
      if (reportStartDate && reportEndDate) {
        url += `&startDate=${encodeURIComponent(reportStartDate)}&endDate=${encodeURIComponent(reportEndDate)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setReports(data.reports || []);
      }
    } catch (e) {
      console.error("Failed to load reports:", e);
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      fetchAllReports();
    }
  }, [user, selectedBranchFilter, selectedSourceFilter, reportStartDate, reportEndDate]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (selectedBureauFilter !== "all" && r.bureau !== selectedBureauFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        r.name?.toLowerCase().includes(q) ||
        r.pan?.toLowerCase().includes(q) ||
        r.mobile?.includes(q) ||
        r.branch?.toLowerCase().includes(q) ||
        r.fetched_by_name?.toLowerCase().includes(q)
      );
    });
  }, [reports, searchQuery, selectedBureauFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize));
  const paginatedReports = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredReports.slice(start, start + pageSize);
  }, [filteredReports, page]);

  const handleOpenReportModal = async (reportId: string) => {
    try {
      const res = await fetch(`/api/reports/${reportId}`);
      const data = await res.json();
      if (data.success && data.report) {
        setViewingReport(data.report);
      }
    } catch (e) {
      console.error("View report error:", e);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to permanently delete this credit report?")) return;
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
      } else {
        alert(data.error || "Failed to delete report");
      }
    } catch (e) {
      alert("Error deleting report");
    }
  };

  const exportToExcel = () => {
    const exportData = filteredReports.map((r) => ({
      Applicant_Name: r.name,
      PAN: r.pan,
      Mobile: r.mobile,
      Bureau: r.bureau,
      Credit_Score: r.credit_score || "N/A",
      Branch: r.branch,
      Source: r.source,
      Fetched_By_Type: r.fetched_by_type,
      Fetched_By_Name: r.fetched_by_name,
      Fetched_By_Email: r.fetched_by_email,
      Date_Fetched: r.created_at?.seconds
        ? new Date(r.created_at.seconds * 1000).toLocaleString()
        : "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Credit_Reports");
    XLSX.writeFile(wb, `Credit_Expert_Reports_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // ==========================================
  // TAB 3: BRANCH USERS STATE
  // ==========================================
  const [branchUsers, setBranchUsers] = useState<DashboardUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("Password@123");
  const [newUserBranch, setNewUserBranch] = useState("Rudrapur");
  const [userActionLoading, setUserActionLoading] = useState(false);

  const fetchBranchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/branch/users");
      const data = await res.json();
      if (data.success) {
        setBranchUsers(data.users || []);
      }
    } catch (e) {
      console.error("Failed to load branch users:", e);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users") {
      fetchBranchUsers();
    }
  }, [activeTab]);

  const handleCreateBranchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserActionLoading(true);
    try {
      const res = await fetch("/api/branch/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          branch: newUserBranch,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddUserModal(false);
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPassword("Password@123");
        fetchBranchUsers();
      } else {
        alert(data.error || "Failed to create user");
      }
    } catch (e) {
      alert("Error creating branch user");
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleToggleUserStatus = async (userObj: DashboardUser) => {
    const nextStatus = userObj.status === "Active" ? "Suspended" : "Active";
    try {
      const res = await fetch("/api/branch/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userObj.id,
          updates: { status: nextStatus },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBranchUsers((prev) =>
          prev.map((u) => (u.id === userObj.id ? { ...u, status: nextStatus } : u))
        );
      }
    } catch (e) {
      alert("Failed to update status");
    }
  };

  const handleDeleteBranchUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/branch/users?id=${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setBranchUsers((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch (e) {
      alert("Failed to delete user");
    }
  };

  // ==========================================
  // TAB 4: ACTIVITY & ANALYTICS
  // ==========================================
  const branchBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach((r) => {
      const b = r.branch || "Unknown";
      counts[b] = (counts[b] || 0) + 1;
    });
    return counts;
  }, [reports]);

  const sourceBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    reports.forEach((r) => {
      const s = r.source || "Unknown";
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [reports]);

  // ==========================================
  // TAB 5: SYSTEM LOGS
  // ==========================================
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilterQuery, setLogFilterQuery] = useState("");
  const [viewingLog, setViewingLog] = useState<any | null>(null);

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/admin/logs?limit=200&_t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error("Failed to load logs:", e);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "logs") {
      fetchLogs();
    }
  }, [activeTab]);

  const filteredLogs = useMemo(() => {
    if (!logFilterQuery.trim()) return logs;
    const q = logFilterQuery.toLowerCase();
    return logs.filter(
      (l) =>
        l.event?.toLowerCase().includes(q) ||
        l.message?.toLowerCase().includes(q) ||
        l.request_id?.toLowerCase().includes(q)
    );
  }, [logs, logFilterQuery]);

  // ==========================================
  // TAB 6: WHATSAPP HUB STATE
  // ==========================================
  const [waMobile, setWaMobile] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [waTemplate, setWaTemplate] = useState("report_download");
  const [waSending, setWaSending] = useState(false);
  const [waStatus, setWaStatus] = useState<string | null>(null);

  const handleSendSingleWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waMobile) return;
    setWaSending(true);
    setWaStatus(null);
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: waMobile,
          message: waMessage,
          templateId: waTemplate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setWaStatus("Message queued and dispatched successfully.");
        setWaMobile("");
        setWaMessage("");
      } else {
        setWaStatus(`Error: ${data.error || "Failed to dispatch message"}`);
      }
    } catch (e: any) {
      setWaStatus(`Error: ${e.message}`);
    } finally {
      setWaSending(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 font-black text-white text-base">
            CE
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-sm tracking-tight">
                Credit Expert India
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Control Center
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Cross-Branch Operations & Administration</p>
          </div>
        </div>

        {/* User profile & actions */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-white block">{user.name}</span>
            <span className="text-[10px] text-slate-400 font-mono">{user.email}</span>
          </div>

          <button
            onClick={() => logout()}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/15 border border-slate-700/60 hover:border-rose-500/30 text-slate-400 hover:text-rose-300 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 overflow-x-auto">
          {[
            { id: "reports", label: `All Reports (${reports.length})`, icon: Database },
            { id: "fetch", label: "Fetch CIBIL", icon: CreditCard },
            { id: "users", label: `Branch Users (${branchUsers.length})`, icon: Users },
            { id: "activity", label: "Activity & Analytics", icon: Activity },
            { id: "logs", label: `System Logs (${logs.length})`, icon: FileWarning },
            { id: "whatsapp", label: "WhatsApp Hub", icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ============================================================== */}
        {/* TAB 1: ALL REPORTS */}
        {/* ============================================================== */}
        {activeTab === "reports" && (
          <div className="space-y-4 animate-fadeIn">
            {/* Filter Controls Bar */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Applicant Name, PAN, Mobile, or Branch..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Branch filter */}
                  <select
                    value={selectedBranchFilter}
                    onChange={(e) => setSelectedBranchFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">All Branches</option>
                    <option value="Rudrapur">Rudrapur</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Dehradun">Dehradun</option>
                    <option value="Admin">Admin Portal</option>
                    <option value="Website Direct">Website Direct</option>
                    <option value="Mobile App">Mobile App</option>
                  </select>

                  {/* Source filter */}
                  <select
                    value={selectedSourceFilter}
                    onChange={(e) => setSelectedSourceFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">All Sources</option>
                    <option value="dashboard_branch">Branch Workplace</option>
                    <option value="dashboard_admin">Admin Portal</option>
                    <option value="website">Customer Website</option>
                    <option value="mobile_app">Mobile App</option>
                  </select>

                  {/* Bureau filter */}
                  <select
                    value={selectedBureauFilter}
                    onChange={(e) => setSelectedBureauFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="all">All Bureaus</option>
                    <option value="v1">CIBIL (TransUnion)</option>
                    <option value="crif">CRIF</option>
                    <option value="experian">Experian</option>
                  </select>

                  {/* Actions */}
                  <button
                    onClick={fetchAllReports}
                    disabled={reportsLoading}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
                    title="Refresh Reports"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${reportsLoading ? "animate-spin" : ""}`} />
                  </button>

                  <button
                    onClick={exportToExcel}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Export Excel
                  </button>
                </div>
              </div>

              {/* Date Filter Row */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-800/60 text-xs text-slate-400 flex-wrap">
                <span className="font-semibold text-slate-300 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" /> Date Range:
                </span>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                />
                <span>to</span>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                />
                {(reportStartDate || reportEndDate) && (
                  <button
                    onClick={() => {
                      setReportStartDate("");
                      setReportEndDate("");
                    }}
                    className="text-xs text-rose-400 hover:underline cursor-pointer"
                  >
                    Clear dates
                  </button>
                )}
                <span className="ml-auto text-slate-500">
                  Showing {paginatedReports.length} of {filteredReports.length} reports
                </span>
              </div>
            </div>

            {/* Reports Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-4">Applicant</th>
                      <th className="p-4">PAN</th>
                      <th className="p-4">Bureau & Score</th>
                      <th className="p-4">Branch</th>
                      <th className="p-4">Fetched By (Attribution)</th>
                      <th className="p-4">Date</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {paginatedReports.map((report) => {
                      const score = report.credit_score;
                      const scoreColor =
                        !score || score < 650
                          ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                          : score < 750
                          ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                          : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

                      // Attribution Badge Styling
                      const isBranch = report.fetched_by_type === "branch";
                      const isAdmin = report.fetched_by_type === "admin";
                      const isCustomer = report.fetched_by_type === "customer";
                      const isApp = report.fetched_by_type === "app";

                      return (
                        <tr key={report.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 font-bold text-white">
                            <div>{report.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {report.mobile}
                            </div>
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-300">
                            {report.pan}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <span className="uppercase text-[10px] font-bold text-slate-400">
                                {report.bureau}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md font-black border ${scoreColor}`}>
                                {score || "N/A"}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold text-[11px] border border-slate-700/60">
                              {report.branch}
                            </span>
                          </td>
                          <td className="p-4">
                            {isBranch && (
                              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold">
                                <Building2 className="w-3 h-3 text-blue-400" />
                                {report.fetched_by_name} ({report.branch})
                              </div>
                            )}
                            {isAdmin && (
                              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-semibold">
                                <ShieldCheck className="w-3 h-3 text-indigo-400" />
                                {report.fetched_by_name} (Admin)
                              </div>
                            )}
                            {isCustomer && (
                              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                                🌐 Website Customer
                              </div>
                            )}
                            {isApp && (
                              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px] font-semibold">
                                📱 Mobile App
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-slate-400 font-mono text-[11px]">
                            {report.created_at?.seconds
                              ? new Date(report.created_at.seconds * 1000).toLocaleDateString()
                              : "Recent"}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenReportModal(report.id)}
                                className="px-2.5 py-1.5 bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" /> View
                              </button>
                              <button
                                onClick={() => handleDeleteReport(report.id)}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
                                title="Delete Report"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {paginatedReports.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          {reportsLoading ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                              Loading database reports...
                            </div>
                          ) : (
                            "No reports found matching your criteria."
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Page <strong className="text-white">{page}</strong> of{" "}
                    <strong className="text-white">{totalPages}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 disabled:opacity-40 cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 disabled:opacity-40 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: FETCH CIBIL */}
        {/* ============================================================== */}
        {activeTab === "fetch" && (
          <div className="animate-fadeIn">
            <CibilFetchForm onSuccess={fetchAllReports} defaultBranch="Admin" />
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: BRANCH USERS MANAGEMENT */}
        {/* ============================================================== */}
        {activeTab === "users" && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">Branch User Accounts</h3>
                <p className="text-xs text-slate-400">
                  Manage individual logins for branch staff (Rudrapur, Delhi, Dehradun, etc.).
                </p>
              </div>

              <button
                onClick={() => setShowAddUserModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Branch User
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-4">Employee Name</th>
                      <th className="p-4">Work Email</th>
                      <th className="p-4">Assigned Branch</th>
                      <th className="p-4">Employee ID</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {branchUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-bold text-white flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-500 shrink-0" />
                          {u.name}
                        </td>
                        <td className="p-4 font-mono text-slate-300">{u.email}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                            {u.branch}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-400">{u.employeeId || "N/A"}</td>
                        <td className="p-4">
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border transition-all cursor-pointer ${
                              u.status === "Active"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                            }`}
                          >
                            {u.status}
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteBranchUser(u.id)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {branchUsers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          {usersLoading ? "Loading accounts..." : "No branch user accounts found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: ACTIVITY & ANALYTICS */}
        {/* ============================================================== */}
        {activeTab === "activity" && (
          <div className="space-y-6 animate-fadeIn">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Total Bureau Pulls
                </span>
                <span className="text-3xl font-black text-white">{reports.length}</span>
                <p className="text-[11px] text-slate-500 mt-1">Cross-branch & online aggregate</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Active Branches
                </span>
                <span className="text-3xl font-black text-blue-400">
                  {Object.keys(branchBreakdown).length}
                </span>
                <p className="text-[11px] text-slate-500 mt-1">Operational branch centers</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Avg Bureau Latency
                </span>
                <span className="text-3xl font-black text-emerald-400">1.8s</span>
                <p className="text-[11px] text-slate-500 mt-1">Direct IDSPay API response</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Total Staff Logins
                </span>
                <span className="text-3xl font-black text-indigo-400">{branchUsers.length}</span>
                <p className="text-[11px] text-slate-500 mt-1">Verified workplace members</p>
              </div>
            </div>

            {/* Branch Breakdown Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                Reports Fetched by Branch
              </h3>
              <div className="space-y-3">
                {Object.entries(branchBreakdown).map(([branch, count]) => {
                  const pct = reports.length > 0 ? Math.round((count / reports.length) * 100) : 0;
                  return (
                    <div key={branch} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-300">{branch}</span>
                        <span className="font-mono text-slate-400">
                          {count} reports ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: SYSTEM LOGS */}
        {/* ============================================================== */}
        {activeTab === "logs" && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={logFilterQuery}
                  onChange={(e) => setLogFilterQuery(e.target.value)}
                  placeholder="Filter logs by event or request ID..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={fetchLogs}
                disabled={logsLoading}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? "animate-spin" : ""}`} />
                Refresh Logs
              </button>
            </div>

            {/* Logs Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-4">Time</th>
                      <th className="p-4">Event</th>
                      <th className="p-4">Level</th>
                      <th className="p-4">HTTP Status</th>
                      <th className="p-4">Duration</th>
                      <th className="p-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 text-slate-500 text-[11px]">
                          {log.timestamp?.seconds
                            ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString()
                            : "Recent"}
                        </td>
                        <td className="p-4 font-bold text-white">{log.event || "LOG_EVENT"}</td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.level === "error"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {log.level || "info"}
                          </span>
                        </td>
                        <td className="p-4 font-bold">
                          {log.provider?.http_status || 200}
                        </td>
                        <td className="p-4">{log.duration_ms ? `${log.duration_ms}ms` : "-"}</td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setViewingLog(log)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-bold transition-all cursor-pointer"
                          >
                            Inspect JSON
                          </button>
                        </td>
                      </tr>
                    ))}

                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          {logsLoading ? "Loading logs..." : "No logs available."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 6: WHATSAPP HUB */}
        {/* ============================================================== */}
        {activeTab === "whatsapp" && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                  Dispatch WhatsApp Communication
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Send official WhatsApp notifications, EMI payment reminders, and CIBIL report links to applicants.
                </p>
              </div>

              {waStatus && (
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>{waStatus}</span>
                </div>
              )}

              <form onSubmit={handleSendSingleWhatsapp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Recipient Mobile Number (10 digits)
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={waMobile}
                    onChange={(e) => setWaMobile(e.target.value.replace(/\D/g, ""))}
                    placeholder="9876543210"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Message Template
                  </label>
                  <select
                    value={waTemplate}
                    onChange={(e) => setWaTemplate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="report_download">CIBIL Report Download Link Notification</option>
                    <option value="emi_reminder">Loan EMI Payment Alert</option>
                    <option value="custom">Custom Message Text</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Message Body
                  </label>
                  <textarea
                    rows={4}
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    placeholder="Hello! Your Credit Expert India credit analysis report has been generated. Access it here..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={waSending}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                >
                  {waSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Dispatching WhatsApp...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send WhatsApp Message
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Add New Branch User
              </h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBranchUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Staff Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Amit Patel"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Work Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="amit.rudrapur@creditexpertindia.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Assigned Branch
                </label>
                <select
                  value={newUserBranch}
                  onChange={(e) => setNewUserBranch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Rudrapur">Rudrapur</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Dehradun">Dehradun</option>
                  <option value="Head Office">Head Office</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Initial Password
                </label>
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={userActionLoading}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {userActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Branch Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white text-slate-900 w-full max-w-6xl max-h-[92vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  Applicant Bureau Report: {viewingReport.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  PAN: <strong className="font-mono text-slate-800">{viewingReport.pan}</strong> · Bureau:{" "}
                  <strong className="uppercase text-blue-600">{viewingReport.bureau}</strong> · Branch:{" "}
                  <strong className="text-slate-800">{viewingReport.branch}</strong> · Fetched By:{" "}
                  <strong className="text-emerald-700">{viewingReport.fetched_by_name || "N/A"} ({viewingReport.fetched_by_type})</strong>
                </p>
              </div>
              <button
                onClick={() => setViewingReport(null)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
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
            </div>
          </div>
        </div>
      )}

      {/* Inspect Log Modal */}
      {viewingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl max-h-[85vh] rounded-2xl p-5 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileWarning className="w-4 h-4 text-blue-400" />
                  Diagnostic Log: {viewingLog.event}
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  Request ID: {viewingLog.request_id || "N/A"}
                </span>
              </div>
              <button
                onClick={() => setViewingLog(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 whitespace-pre-wrap">
              {JSON.stringify(viewingLog, null, 2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
