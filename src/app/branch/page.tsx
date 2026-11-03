"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { CibilFetchForm } from "@/components/CibilFetchForm";
import { EmiCalculator } from "@/components/EmiCalculator";
import { CreditReportDashboard } from "@/components/CreditReportDashboard";
import { DashboardHeader, NavTabItem } from "@/components/DashboardHeader";
import {
  FileText,
  History,
  Search,
  Eye,
  X,
  CreditCard,
  User,
  Loader2,
  Calculator,
} from "lucide-react";
import { CreditReportRecord } from "@/lib/types";

export default function BranchPortalPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("fetch");
  const [reports, setReports] = useState<CreditReportRecord[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingReport, setViewingReport] = useState<any | null>(null);

  // Authentication protection
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  // cursors[i] is the cursor used to load page i + 1 (page 1 has none)
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const pageSize = 12;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Load a single page of branch reports; paging issues a new request
  const fetchReportsPage = async (targetPage: number, cursor: string | null) => {
    if (!user) return;
    setReportsLoading(true);
    try {
      const params = new URLSearchParams({
        branch: user.branch,
        pageSize: String(pageSize),
        _t: String(Date.now()),
      });
      // Branch history only covers the last 24 hours (rounded to the minute for caching)
      const minute = Math.floor(Date.now() / 60000) * 60000;
      params.set("startDate", new Date(minute - 24 * 60 * 60 * 1000).toISOString());
      params.set("endDate", new Date(minute + 60000).toISOString());
      if (cursor) params.set("cursor", cursor);
      if (debouncedSearch) params.set("q", debouncedSearch);
      const res = await fetch(`/api/reports?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setReports(data.reports || []);
        setHasMore(!!data.hasMore);
        setPage(targetPage);
        setCursors((prev) => {
          const next = prev.slice(0, targetPage);
          next[targetPage - 1] = cursor;
          if (data.nextCursor) next[targetPage] = data.nextCursor;
          return next;
        });
      }
    } catch (e) {
      console.error("Failed to load reports:", e);
    } finally {
      setReportsLoading(false);
    }
  };

  const fetchBranchReports = () => fetchReportsPage(1, null);

  useEffect(() => {
    if (activeTab === "history") {
      setCursors([null]);
      fetchReportsPage(1, null);
    }
  }, [activeTab, user, debouncedSearch]);

  const handleOpenReportModal = async (reportId: string) => {
    try {
      const res = await fetch(`/api/reports/${reportId}`);
      const data = await res.json();
      if (data.success && data.report) {
        setViewingReport(data.report);
      }
    } catch (e) {
      console.error("Failed to load full report:", e);
    }
  };

  const filteredReports = reports;

  const tabs: NavTabItem[] = [
    { id: "fetch", label: "Fetch CIBIL", icon: FileText },
    { id: "history", label: "Last 24h History", icon: History },
    { id: "emi", label: "EMI Calculator", icon: Calculator },
  ];

  if (loading || !user) {
    return (
      <div className="min-h-dvh bg-[#F6F9FC] flex items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-[#3F8EFC]" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#F6F9FC] text-[#0A2540] flex flex-col font-sans">
      {/* Website-Style Navigation Header */}
      <DashboardHeader
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId)}
        badgeLabel={`${user.branch} Branch`}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* TAB 1: FETCH CIBIL */}
        {activeTab === "fetch" && (
          <div className="animate-fadeIn">
            <CibilFetchForm onSuccess={fetchBranchReports} defaultBranch={user.branch} />
          </div>
        )}

        {activeTab === "emi" && <EmiCalculator />}

        {/* TAB 2: BRANCH REPORTS HISTORY */}
        {activeTab === "history" && (
          <div className="space-y-4 animate-fadeIn">
            {/* Search and Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
              <div className="relative flex-1 sm:max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by PAN, Name, or Mobile..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 min-h-[44px] text-base sm:text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium"
                />
              </div>

              <button
                onClick={fetchBranchReports}
                disabled={reportsLoading}
                className="px-4 py-2.5 min-h-[44px] justify-center bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                {reportsLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <History className="w-3.5 h-3.5" />
                )}
                Refresh
              </button>
            </div>

            {/* Reports Table in Clean White Card */}
            <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xl shadow-slate-900/5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-slate-50/90 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-4">Applicant</th>
                      <th className="p-4">PAN Number</th>
                      <th className="p-4">Mobile</th>
                      <th className="p-4">Bureau & Score</th>
                      <th className="p-4">Fetched Date</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredReports.map((report) => {
                      const score = report.credit_score;
                      const scoreColor =
                        !score || score < 650
                          ? "text-red-700 bg-red-50 border-red-200"
                          : score < 750
                          ? "text-amber-700 bg-amber-50 border-amber-200"
                          : "text-emerald-700 bg-emerald-50 border-emerald-200";

                      return (
                        <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 sm:p-4 font-bold text-slate-900 flex items-center gap-2 min-w-[160px]">
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                            {report.name}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-800">
                            {report.pan}
                          </td>
                          <td className="p-4 font-mono text-slate-600">
                            {report.mobile}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="uppercase text-[10px] font-bold text-slate-500">
                                {report.bureau}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-xs border ${scoreColor}`}>
                                {score || "N/A"}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-slate-500 font-mono text-[11px]">
                            {report.created_at?.seconds
                              ? new Date(report.created_at.seconds * 1000).toLocaleString()
                              : "Recent"}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleOpenReportModal(report.id)}
                              className="px-3.5 py-2.5 min-h-[44px] whitespace-nowrap bg-[#3F8EFC] hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm shadow-[#3F8EFC]/20"
                            >
                              <Eye className="w-3.5 h-3.5" /> View Report
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredReports.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-500">
                          {reportsLoading ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-[#3F8EFC]" />
                              Loading branch reports...
                            </div>
                          ) : (
                            "No CIBILs pulled by this branch in the last 24 hours."
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {(page > 1 || hasMore) && (
                <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-600 font-medium">
                    Page <strong className="text-slate-900">{page}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchReportsPage(page - 1, cursors[page - 2] ?? null)}
                      disabled={page === 1 || reportsLoading}
                      className="max-sm:min-h-11 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer shadow-2xs hover:bg-slate-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchReportsPage(page + 1, cursors[page] ?? null)}
                      disabled={!hasMore || reportsLoading}
                      className="max-sm:min-h-11 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer shadow-2xs hover:bg-slate-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Full Report Details Modal */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white text-slate-900 w-full max-w-6xl max-h-[92dvh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
            <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 break-words">
                  <CreditCard className="w-5 h-5 text-[#3F8EFC]" />
                  Applicant Bureau Report: {viewingReport.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  PAN: <strong className="font-mono text-slate-800">{viewingReport.pan}</strong> · Bureau:{" "}
                  <strong className="uppercase text-[#3F8EFC]">{viewingReport.bureau}</strong> · Branch:{" "}
                  <strong className="text-slate-800">{viewingReport.branch}</strong>
                </p>
              </div>
              <button
                onClick={() => setViewingReport(null)}
                className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-3 sm:p-6 overflow-y-auto bg-slate-50">
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
