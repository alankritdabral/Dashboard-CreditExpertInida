"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { CibilFetchForm } from "@/components/CibilFetchForm";
import { CreditReportDashboard } from "@/components/CreditReportDashboard";
import {
  Building2,
  FileText,
  History,
  LogOut,
  Search,
  Eye,
  X,
  CreditCard,
  Calendar,
  Sparkles,
  Phone,
  User,
  Loader2,
  Shield,
  Download,
} from "lucide-react";
import { CreditReportRecord } from "@/lib/types";

export default function BranchPortalPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"fetch" | "history">("fetch");
  const [reports, setReports] = useState<CreditReportRecord[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingReport, setViewingReport] = useState<any | null>(null);
  const [viewingLoading, setViewingLoading] = useState(false);

  // Authentication protection
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Load branch reports
  const fetchBranchReports = async () => {
    if (!user) return;
    setReportsLoading(true);
    try {
      const res = await fetch(`/api/reports?branch=${encodeURIComponent(user.branch)}&limit=200&_t=${Date.now()}`);
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
    if (activeTab === "history") {
      fetchBranchReports();
    }
  }, [activeTab, user]);

  const handleOpenReportModal = async (reportId: string) => {
    setViewingLoading(true);
    try {
      const res = await fetch(`/api/reports/${reportId}`);
      const data = await res.json();
      if (data.success && data.report) {
        setViewingReport(data.report);
      }
    } catch (e) {
      console.error("Failed to load full report:", e);
    } finally {
      setViewingLoading(false);
    }
  };

  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.toLowerCase().trim();
    return reports.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.pan?.toLowerCase().includes(q) ||
        r.mobile?.includes(q)
    );
  }, [reports, searchQuery]);

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
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/30 font-black text-white text-base">
            CE
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-sm tracking-tight">
                Credit Expert India
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {user.branch} Branch
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Branch Operations Workplace</p>
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
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("fetch")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "fetch"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Fetch CIBIL Report
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "history"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Branch Reports History ({reports.length})
            </button>
          </div>

          <div className="text-[11px] text-slate-500 hidden md:block">
            Branch: <strong className="text-slate-300">{user.branch}</strong> · Access:{" "}
            <strong className="text-emerald-400">Bureau Fetch Only</strong>
          </div>
        </div>

        {/* TAB 1: FETCH CIBIL */}
        {activeTab === "fetch" && (
          <div className="animate-fadeIn">
            <CibilFetchForm onSuccess={fetchBranchReports} defaultBranch={user.branch} />
          </div>
        )}

        {/* TAB 2: BRANCH REPORTS HISTORY */}
        {activeTab === "history" && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by PAN, Name, or Mobile..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchBranchReports}
                  disabled={reportsLoading}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {reportsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <History className="w-3.5 h-3.5" />}
                  Refresh
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-4">Applicant</th>
                      <th className="p-4">PAN Number</th>
                      <th className="p-4">Mobile</th>
                      <th className="p-4">Bureau & Score</th>
                      <th className="p-4">Fetched At</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredReports.map((report) => {
                      const score = report.credit_score;
                      const scoreColor =
                        !score || score < 650
                          ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                          : score < 750
                          ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                          : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

                      return (
                        <tr key={report.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 font-bold text-white flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-500 shrink-0" />
                            {report.name}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-300">
                            {report.pan}
                          </td>
                          <td className="p-4 font-mono text-slate-400">
                            {report.mobile}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="uppercase text-[10px] font-bold text-slate-400">
                                {report.bureau}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md font-black border ${scoreColor}`}>
                                {score || "N/A"}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-slate-400 font-mono text-[11px]">
                            {report.created_at?.seconds
                              ? new Date(report.created_at.seconds * 1000).toLocaleString()
                              : "Recent"}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleOpenReportModal(report.id)}
                              className="px-3 py-1.5 bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" /> View Report
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredReports.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          {reportsLoading ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                              Loading branch reports...
                            </div>
                          ) : (
                            "No reports found for this branch."
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Full Report Details Modal */}
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
                  <strong className="text-slate-800">{viewingReport.branch}</strong>
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
    </div>
  );
}
