"use client";
import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, Loader2, Trash2, Download, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { analyzeLenderEligibility } from "@/lib/lenderEngine";
import { parseBureauData } from "@/lib/bureauParsers";
import { searchEmployers, EmployerResult } from "@/lib/employerLookup";
import { useEffect } from "react";
import { db } from "@/lib/firebaseClient";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { generatePDFReport } from "@/lib/pdfGenerator";
export function CreditReportDashboard({ bureau, cibilData, formData }: any) {
  const captureRef = useRef<HTMLDivElement>(null);
  const basicRef = useRef<HTMLDivElement>(null);
  const loansRef = useRef<HTMLDivElement>(null);
  const eligRef = useRef<HTMLDivElement>(null);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [isDownloadingSection, setIsDownloadingSection] = useState<string | null>(null);
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  const [userOverrides, setUserOverrides] = useState<any>({});
  const [manualLoans, setManualLoans] = useState<any[]>([]);

  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [dashboardTab, setDashboardTab] = useState<"enquiries" | "ongoing" | "closed" | "eligibility">("enquiries");
  const [loanOverrides, setLoanOverrides] = useState<any>({});

  const sessionKey = `report_session_${formData?.pan || "NOPAN"}_${formData?.mobile || "NOMOBILE"}`;
  const safePan = formData?.pan ? formData.pan.toUpperCase() : "NOPAN";
  const docId = `${safePan}_${formData?.mobile}_${bureau || formData?.bureau}`;

  useEffect(() => {
    // 1. Try to load from session storage for instant UX
    try {
      const saved = sessionStorage.getItem(sessionKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (parsed.userOverrides) setUserOverrides(parsed.userOverrides);
        if (parsed.loanOverrides) setLoanOverrides(parsed.loanOverrides);
      }
    } catch (e) {
      console.error("Failed to load session overrides", e);
    }

    // 2. Load from Firebase as source of truth
    // TEMP: Disabled DB Read (Overrides) - will remove in future
    /*
    const loadFromDB = async () => {
      try {
        const docSnap = await getDoc(doc(db, "credit_reports", docId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.overrides) {
            setUserOverrides((prev: any) => ({ ...prev, ...data.overrides.userOverrides }));
            setLoanOverrides((prev: any) => ({ ...prev, ...data.overrides.loanOverrides }));
          }
        }
      } catch (e) {
        console.error("Failed to load overrides from DB", e);
      }
    };
    loadFromDB();
    */
  }, [sessionKey, docId]);

  useEffect(() => {
    // Save to session storage instantly
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify({ userOverrides, loanOverrides }));
    } catch (e) {
      console.error("Failed to save session overrides", e);
    }

    // Save to Firebase (debounced)
    // TEMP: Disabled DB Write (Overrides) - will remove in future
    /*
    const handler = setTimeout(async () => {
      try {
        // Only update if there are keys, to avoid writing empty data needlessly
        if (Object.keys(userOverrides).length > 0 || Object.keys(loanOverrides).length > 0) {
          await updateDoc(doc(db, "credit_reports", docId), {
            overrides: { userOverrides, loanOverrides }
          });
        }
      } catch (e) {
        console.error("Failed to save overrides to DB", e);
      }
    }, 5000);

    return () => clearTimeout(handler);
    */
  }, [userOverrides, loanOverrides, sessionKey, docId]);

  const [showEmployerDropdown, setShowEmployerDropdown] = useState(false);
  const [employerSearch, setEmployerSearch] = useState("");
  const [debouncedEmployerSearch, setDebouncedEmployerSearch] = useState(employerSearch);
  const [asyncEmployers, setAsyncEmployers] = useState<EmployerResult[]>([]);
  const [isSearchingEmployer, setIsSearchingEmployer] = useState(false);
  const employerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedEmployerSearch(employerSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [employerSearch]);

  useEffect(() => {
    const fetchEmployersFromDB = async () => {
      if (debouncedEmployerSearch.length < 2) {
        setAsyncEmployers([]);
        return;
      }
      setIsSearchingEmployer(true);
      const results = await searchEmployers(debouncedEmployerSearch);
      setAsyncEmployers(results);
      setIsSearchingEmployer(false);
    };
    fetchEmployersFromDB();
  }, [debouncedEmployerSearch]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (employerDropdownRef.current && !employerDropdownRef.current.contains(event.target as Node)) {
        setShowEmployerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDownloadImage = async (section: 'basic' | 'loans' | 'eligibility') => {
    setIsDownloadingImage(true);
    setIsDownloadingSection(section);
    setIsPreparingDownload(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const targetRef = section === 'basic' ? basicRef : section === 'loans' ? loansRef : eligRef;
      if (!targetRef.current) {
        alert("Error: Capture area not found after preparing.");
        return;
      }
      const htmlToImage = await import('html-to-image');
      const names = {
        'basic': '1_Basic_Details',
        'loans': '2_Loans',
        'eligibility': '3_Eligibility'
      };
      const dataUrl = await htmlToImage.toPng(targetRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `CEI_${names[section]}_${formData.firstName || 'Report'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Failed to capture image", e);
      alert("Failed to download image. See console for details.");
    } finally {
      setIsDownloadingImage(false);
      setIsDownloadingSection(null);
      setIsPreparingDownload(false);
    }
  };


  // The extracted case 6 code:
  const isEquifax = formData.bureau.startsWith("v2");
  const isCrif = formData.bureau.startsWith("crif");
  const isExperian = formData.bureau.startsWith("experian");

  const extractContactInfo = (bureau: string, data: any) => {
    let latestAddress = "N/A";
    let latestEmail = "N/A";
    if (!data) return { latestAddress, latestEmail };
    const strData = JSON.stringify(data);

    if (bureau.startsWith("crif")) {
      const newReport = data?.result_json?.parsed_data?.["B2C-REPORT"]?.["REPORT-DATA"]?.["STANDARD-DATA"];
      if (newReport?.DEMOGS?.VARIATIONS) {
        const addrVars = newReport.DEMOGS.VARIATIONS.find((v: any) => v.TYPE === "ADDRESS-VARIATIONS")?.VARIATION || [];
        if (addrVars.length > 0) {
          const sorted = [...addrVars].sort((a: any, b: any) => {
            if (!a["REPORTED-DT"]) return 1; if (!b["REPORTED-DT"]) return -1;
            const d1 = a["REPORTED-DT"].split('-').reverse().join('-');
            const d2 = b["REPORTED-DT"].split('-').reverse().join('-');
            return d2.localeCompare(d1);
          });
          latestAddress = sorted[0].VALUE || "N/A";
        }
        const emailVars = newReport.DEMOGS.VARIATIONS.find((v: any) => v.TYPE === "EMAIL-VARIATIONS")?.VARIATION || [];
        if (emailVars.length > 0) {
          const sorted = [...emailVars].sort((a: any, b: any) => {
            if (!a["REPORTED-DT"]) return 1; if (!b["REPORTED-DT"]) return -1;
            const d1 = a["REPORTED-DT"].split('-').reverse().join('-');
            const d2 = b["REPORTED-DT"].split('-').reverse().join('-');
            return d2.localeCompare(d1);
          });
          latestEmail = sorted[0].VALUE || "N/A";
        }
      }
    } else if (bureau.startsWith("experian")) {
      const emailMatch = strData.match(/"EMailId"\s*:\s*"([^"]+)"/i);
      if (emailMatch && emailMatch[1]) latestEmail = emailMatch[1];
      const addrMatch = strData.match(/"First_Line_Of_Address_non_normalized"\s*:\s*"([^"]+)"/i);
      const addrMatch2 = strData.match(/"Second_Line_Of_Address_non_normalized"\s*:\s*"([^"]+)"/i);
      const cityMatch = strData.match(/"City_non_normalized"\s*:\s*"([^"]+)"/i);
      if (addrMatch && addrMatch[1]) {
        latestAddress = addrMatch[1] + (addrMatch2 && addrMatch2[1] ? " " + addrMatch2[1] : "") + (cityMatch && cityMatch[1] ? ", " + cityMatch[1] : "");
      }
    } else {
      const emailMatch = strData.match(/"EmailAddress"\s*:\s*"([^"]+)"/i);
      if (emailMatch && emailMatch[1]) latestEmail = emailMatch[1];
      const addrMatch = strData.match(/"StreetAddress"\s*:\s*"([^"]+)"/i);
      const cityMatch = strData.match(/"City"\s*:\s*"([^"]+)"/i);
      const zipMatch = strData.match(/"PostalCode"\s*:\s*"([^"]+)"/i);
      if (addrMatch && addrMatch[1]) {
        latestAddress = addrMatch[1] + (cityMatch && cityMatch[1] ? ", " + cityMatch[1] : "") + (zipMatch && zipMatch[1] ? " " + zipMatch[1] : "");
      }
    }
    return { latestAddress, latestEmail };
  };

  const contactInfo = extractContactInfo(formData.bureau, cibilData);
  const parsed = parseBureauData(formData.bureau, cibilData);
  const { accountSummary, inquirySummary, accounts, enquiries, personalInfo: equifaxPersonalInfo } = parsed;

  const safeAccounts = accounts || [];
  // A closed loan is exactly one that has 0 or less balance left
  const closedAccounts = safeAccounts.filter((a: any) => Number(a.currentBalance) <= 0);
  const activeAccounts = [...safeAccounts.filter((a: any) => !closedAccounts.includes(a)), ...manualLoans];

  // Call Eligibility Engine
  const baseMonthly = Number(userOverrides.netSalary) || Number(formData.monthlyIncome) || 50000;
  const avgYearlyBonus = Number(userOverrides.yearlyBonus) || 0;
  const effectiveNetSalary = baseMonthly + (avgYearlyBonus / 12);

  const engineProfile = {
    netSalary: effectiveNetSalary,
    employer: userOverrides.employer || formData.employer || "Unknown",
    employerTier: userOverrides.companyCategory || null, // null = auto-detect per bank
    hasBounce: userOverrides.hasBounce || "no",
    hasLatePayment: userOverrides.hasLatePayment || "no",
    hasActiveOverdue: userOverrides.hasActiveOverdue || ((accountSummary?.overdueAccounts || 0) > 0 ? "yes" : "no"),
    wantsTopUp: userOverrides.wantsTopUp || "no",
    btPreference: userOverrides.btPreference || "Any",
    axisCustomerSegment: userOverrides.axisCustomerSegment || "NTB",
    casaVintage: userOverrides.casaVintage || "no",
    cibilScore: parsed.personalInfo?.score || 0,
    residenceType: userOverrides.residenceType || "Rented",
    cityTier: userOverrides.cityTier || "Non-Metro",
    location: userOverrides.location || formData.city || "",
    yearlyBonus: avgYearlyBonus,
    rentalIncome: Number(userOverrides.rentalIncome) || 0,
    monthlyIncentive: Number(userOverrides.monthlyIncentive) || 0,
    quarterlyIncentive: Number(userOverrides.quarterlyIncentive) || 0,
    halfYearlyIncentive: Number(userOverrides.halfYearlyIncentive) || 0,
    monthlyBonus: Number(userOverrides.monthlyBonus) || 0,
    quarterlyBonus: Number(userOverrides.quarterlyBonus) || 0,
    lta: Number(userOverrides.lta) || 0,
    jobProfile: userOverrides.jobProfile || "",
    age: Number(userOverrides.age) || 0,
    coApplicant: userOverrides.coApplicant === "yes",
    hasEPFO: userOverrides.hasEPFO === "yes",
    hasOMID: userOverrides.hasOMID === "yes",
    hasHRMS: userOverrides.hasHRMS === "yes",
    has26AS: userOverrides.has26AS === "yes",
  };

  const mappedAccounts = activeAccounts.map((acc: any) => {
    const overrides = loanOverrides[acc.accountNumber] || {};

    const currentOutstanding = overrides.currentOutstanding !== undefined ? overrides.currentOutstanding : (acc.currentBalance || 0);
    const type = overrides.type !== undefined ? overrides.type : (
      (acc.accountType || "").includes("Personal") ? "Personal Loan" :
        (acc.accountType || "").includes("Credit") ? "Credit Card" :
          (acc.accountType || "").includes("Education") ? "Education Loan" :
            (acc.accountType || "").includes("Gold") ? "Gold Loan" :
              (acc.accountType || "").includes("Overdraft") ? "Overdraft" : "Unknown"
    );

    const originalAmount = overrides.originalAmount !== undefined ? Number(overrides.originalAmount) : Number(acc.highCreditAmount || 0);
    const tenure = overrides.tenure !== undefined ? overrides.tenure : (acc.repaymentTenure || "N/A");

    let rate = overrides.rate !== undefined ? Number(overrides.rate) : Number(acc.interest_rate || 0);
    if (type === 'Gold Loan' && overrides.rate === undefined && !rate) {
      rate = 10;
    }

    let emi = overrides.emi !== undefined ? Number(overrides.emi) : (Number(acc.emiAmount) || 0);
    if (type === 'Credit Card' && overrides.emi === undefined) {
      emi = currentOutstanding * 0.05;
    } else if (!emi && originalAmount > 0 && rate > 0 && !isNaN(Number(tenure))) {
      const r = rate / 12 / 100;
      const n = Number(tenure);
      if (n > 0) {
        emi = Math.round((originalAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
      }
    }

    return {
      id: acc.accountNumber,
      originalType: acc.accountType || "Unknown",
      type,
      wantsBT: overrides.wantsBT !== undefined ? overrides.wantsBT : "no",
      userPaysEmi: overrides.userPaysEmi !== undefined ? overrides.userPaysEmi : true,
      originalAmount,
      currentOutstanding,
      rate,
      emi,
      bankName: overrides.bankName !== undefined ? overrides.bankName : (acc.memberShortName || "Unknown Lender"),
      dateOpened: overrides.dateOpened !== undefined ? overrides.dateOpened : (acc.dateOpened || "N/A"),
      tenure,
      odPlan: overrides.odPlan !== undefined ? overrides.odPlan : "2yr",
      pastDueAmount: acc.pastDueAmount || 0
    };
  });

  const catBLoans = mappedAccounts.filter((l: any) => l.wantsBT === 'yes' && Number(l.currentOutstanding) > 0);

  const { eligibleLenders, ineligibleLenders } = analyzeLenderEligibility({ profile: engineProfile, catBLoans, allLoans: mappedAccounts });

  const totalCurrentEMI = mappedAccounts.reduce((sum: number, loan: any) => {
    if (Number(loan.currentOutstanding) <= 0 || !loan.userPaysEmi) {
      return sum;
    }
    return sum + Number(loan.emi || 0);
  }, 0);

  const totalActiveEMI = mappedAccounts.reduce((sum: number, loan: any) => {
    if (Number(loan.currentOutstanding) <= 0 || !loan.userPaysEmi || loan.wantsBT === 'yes') {
      return sum;
    }
    return sum + Number(loan.emi || 0);
  }, 0);

  const netSalary = (Number(userOverrides.netSalary) || Number(formData.monthlyIncome) || 0) + ((Number(userOverrides.yearlyBonus) || 0) / 12);
  const maxEmiCapacity = netSalary * 0.7;

  const bestLenderForCapacity = eligibleLenders.length > 0 ? eligibleLenders[0] : null;
  let newConsolidationEmiForCapacity = 0;
  const consolidationAmountForCapacity = catBLoans.reduce((sum: number, l: any) => sum + Number(l.currentOutstanding || 0), 0);
  if (bestLenderForCapacity && consolidationAmountForCapacity > 0) {
    const ratePerMonth = (bestLenderForCapacity.headlineRate || 12) / 12 / 100;
    const tenureMonths = Number(userOverrides.consolidationTenure) || bestLenderForCapacity.maxTenure || 60;
    newConsolidationEmiForCapacity = Math.round(
      (consolidationAmountForCapacity * ratePerMonth * Math.pow(1 + ratePerMonth, tenureMonths)) /
      (Math.pow(1 + ratePerMonth, tenureMonths) - 1)
    ) || 0;
  }

  const unusedEmiCapacity = Math.max(0, maxEmiCapacity - totalActiveEMI - newConsolidationEmiForCapacity);
  const topUpTenure = Number(userOverrides.topUpTenure) || 5;
  const topUpRoi = Number(userOverrides.topUpRoi) || 12;

  let maxFreshLoanAmount = 0;
  if (topUpTenure > 0 && unusedEmiCapacity > 0) {
    const r = topUpRoi / 12 / 100;
    const n = topUpTenure * 12;
    maxFreshLoanAmount = r > 0 ? unusedEmiCapacity * ((1 - Math.pow(1 + r, -n)) / r) : unusedEmiCapacity * n;
  }
  const score = cibilData?.credit_score || parsed.personalInfo?.score;

  let scoreLabel = "Not Available";
  let scoreColor = "text-brand-black/70";
  let ringColor = "text-slate-200";
  const scoreNum = Number(score);
  if (scoreNum) {
    if (scoreNum >= 800) { scoreLabel = "Excellent"; scoreColor = "text-emerald-600"; ringColor = "text-emerald-500"; }
    else if (scoreNum >= 750) { scoreLabel = "Very Good"; scoreColor = "text-teal-500"; ringColor = "text-teal-400"; }
    else if (scoreNum >= 650) { scoreLabel = "Good"; scoreColor = "text-blue-500"; ringColor = "text-blue-400"; }
    else if (scoreNum >= 550) { scoreLabel = "Fair"; scoreColor = "text-amber-500"; ringColor = "text-amber-400"; }
    else { scoreLabel = "Poor"; scoreColor = "text-red-500"; ringColor = "text-red-400"; }
  }

  const scorePercent = scoreNum ? Math.max(0, Math.min(100, ((scoreNum - 300) / 600) * 100)) : 0;
  const dashArray = `${scorePercent} 100`;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-2">
      <div ref={captureRef} className="bg-white">
        <div ref={basicRef} className={isDownloadingSection === 'basic' ? "bg-white p-4 mb-4" : ""}>
          {/* CIBIL Dashboard */}
          <div className="mb-10">
            {isDownloadingSection === 'basic' && (
              <h3 className="text-xl font-bold bg-[#382F2A] text-white p-3 rounded-lg mb-6 uppercase tracking-wider text-center">Section 1: Basic Details</h3>
            )}
            {formData?.fallbackWarning && !isPreparingDownload && (
              <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{formData.fallbackWarning}</p>
              </div>
            )}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-brand-black">Credit Report</h3>
              <div className="flex items-center gap-3">
                {!isPreparingDownload && (
                  <>
                    {(cibilData?.credit_report_link || cibilData?.data?.pdf_url) && (
                      <a href={cibilData?.credit_report_link || cibilData?.data?.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold px-4 py-1.5 bg-blue-energy text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1">
                        Download Bureau PDF
                      </a>
                    )}
                    <button onClick={() => generatePDFReport(bureau, cibilData, formData)} className="text-xs font-bold px-4 py-1.5 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1">
                      Download CIBIL PDF
                    </button>
                    <div className="flex items-center gap-1 bg-indigo-50 p-1 rounded-full border border-indigo-100">
                      <button onClick={() => handleDownloadImage('basic')} disabled={isDownloadingImage} className="text-[10px] font-bold px-3 py-1 bg-white text-indigo-700 rounded-full hover:bg-indigo-600 hover:text-white transition-colors shadow-sm flex items-center gap-1 disabled:opacity-50">
                        {isDownloadingSection === 'basic' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Basic
                      </button>
                      <button onClick={() => handleDownloadImage('loans')} disabled={isDownloadingImage} className="text-[10px] font-bold px-3 py-1 bg-white text-indigo-700 rounded-full hover:bg-indigo-600 hover:text-white transition-colors shadow-sm flex items-center gap-1 disabled:opacity-50">
                        {isDownloadingSection === 'loans' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Loans
                      </button>
                      <button onClick={() => handleDownloadImage('eligibility')} disabled={isDownloadingImage} className="text-[10px] font-bold px-3 py-1 bg-white text-indigo-700 rounded-full hover:bg-indigo-600 hover:text-white transition-colors shadow-sm flex items-center gap-1 disabled:opacity-50">
                        {isDownloadingSection === 'eligibility' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Elig.
                      </button>
                    </div>
                  </>
                )}
                <span className="text-xs font-semibold px-3 py-1.5 bg-[#F1EFE7] text-[#4A3D36] rounded-full">Updated: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Score Hero Card */}
            <div className="bg-gradient-to-br from-[#FAF8F5] to-[#F1EFE7] rounded-3xl p-6 border border-[#EBE6DD] mb-6 shadow-sm flex flex-col items-center justify-center text-center">
              <h4 className="text-xs font-extrabold tracking-widest uppercase text-[#8B7C73] mb-4">Your Credit Score</h4>

              <div className="relative w-40 h-40 flex flex-col items-center justify-center">
                <svg viewBox="0 0 36 36" className="absolute top-0 left-0 w-full h-full transform -rotate-90">
                  <path
                    className="text-slate-200"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {scoreNum > 0 && (
                    <path
                      className={`${ringColor} transition-all duration-1000 ease-out`}
                      strokeWidth="3"
                      strokeDasharray={dashArray}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  )}
                </svg>
                <span className="text-4xl font-extrabold text-[#382F2A] relative z-10">{score || "N/A"}</span>
                {score && <span className={`text-sm font-bold mt-1 ${scoreColor} relative z-10`}>{scoreLabel}</span>}
              </div>

              {parsed.personalInfo?.scoreName && (
                <div className="mt-4 flex flex-col items-center">
                  <span className="text-xs font-semibold text-[#8B7C73] bg-[#EBE6DD] px-3 py-1 rounded-full uppercase tracking-wider">
                    {parsed.personalInfo.scoreName}
                  </span>
                  {parsed.personalInfo.scoreDescription && (
                    <span className="text-xs font-bold text-[#382F2A] mt-2">
                      Grade: {parsed.personalInfo.scoreDescription}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Score Factors */}
            {parsed.personalInfo?.factors && parsed.personalInfo.factors.length > 0 && (
              <div className="bg-white border border-[#EBE6DD] rounded-3xl p-5 mb-6 shadow-sm">
                <h4 className="text-sm font-extrabold text-[#382F2A] mb-4">Credit Score Factors</h4>
                <div className="space-y-3">
                  {parsed.personalInfo.factors.map((factor: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 bg-[#FAF8F5] p-3 rounded-xl border border-[#EBE6DD]">
                      <div className="bg-[#EBE6DD] text-[#8B7C73] text-[10px] font-bold px-2 py-1 rounded">
                        {factor.TYPE}
                      </div>
                      <p className="text-xs font-medium text-[#382F2A] leading-relaxed flex-1">
                        {factor.DESC}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}


            {/* Contact Information */}
            <div className="bg-white border border-[#EBE6DD] rounded-3xl p-5 mb-6 shadow-sm">
              <h4 className="text-lg font-bold text-[#382F2A] mb-4">Contact Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#FAF8F5] border border-[#EBE6DD] rounded-2xl p-4">
                  <p className="text-[#8B7C73] text-xs font-semibold mb-1 uppercase tracking-wider">Latest Email</p>
                  <p className="text-[#382F2A] font-medium text-sm break-all">{contactInfo.latestEmail}</p>
                </div>
                <div className="bg-[#FAF8F5] border border-[#EBE6DD] rounded-2xl p-4">
                  <p className="text-[#8B7C73] text-xs font-semibold mb-1 uppercase tracking-wider">Latest Address</p>
                  <p className="text-[#382F2A] font-medium text-sm">{contactInfo.latestAddress}</p>
                </div>
              </div>
            </div>

            {/* Credit Overview */}
            {accountSummary && (
              <>
                <h4 className="text-lg font-bold text-[#382F2A] mb-4">Credit Overview</h4>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { label: "Total Accounts", value: accountSummary?.totalAccounts || 0 },
                    { label: "Outstanding Balance", value: accountSummary?.currentBalance ? `₹${Number(accountSummary.currentBalance).toLocaleString('en-IN')}` : '₹0' },
                    { label: "Total Loans Taken Till Date", value: accountSummary?.highCreditAmount ? `₹${Number(accountSummary.highCreditAmount).toLocaleString('en-IN')}` : '₹0' },
                    { label: "Overdue", value: accountSummary?.overdueBalance ? `₹${Number(accountSummary.overdueBalance).toLocaleString('en-IN')}` : '₹0' },
                    { label: "Overdue Accounts", value: accountSummary?.overdueAccounts || 0 },
                    { label: "Closed Accounts", value: accountSummary?.zeroBalanceAccounts || 0 }
                  ].map((stat, i) => (
                    <div key={i} className="bg-[#FAF8F5] border border-[#EBE6DD] rounded-2xl p-4">
                      <p className="text-[#8B7C73] text-xs font-semibold mb-1">{stat.label}</p>
                      <p className="text-[#382F2A] font-extrabold text-sm">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </>
            )}


            {/* Dashboard Tabs */}
            {!isPreparingDownload && (
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6 overflow-x-auto no-scrollbar">
                {[
                  { id: 'enquiries', label: 'Recent Enquiries' },
                  { id: 'ongoing', label: 'Ongoing Loans' },
                  { id: 'closed', label: 'Closed Loans' },
                  { id: 'eligibility', label: 'Eligibility Check' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDashboardTab(tab.id as any)}
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${dashboardTab === tab.id ? 'bg-white text-blue-energy shadow-sm' : 'text-brand-black/70 hover:text-brand-black/90'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {(!isPreparingDownload ? dashboardTab === 'enquiries' : isDownloadingSection === 'basic') && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Enquiries Summary */}
                {inquirySummary && (
                  <div className="bg-[#FAF8F5] border border-[#EBE6DD] rounded-3xl p-5 mb-6">
                    <h4 className="text-sm font-extrabold text-[#382F2A] mb-4">Credit Enquiries</h4>
                    <div className="flex items-center justify-between gap-2 text-center border-b border-[#EBE6DD] pb-4 mb-4">
                      <div>
                        <p className="text-xl font-bold text-[#382F2A]">{inquirySummary?.totalInquiry || 0}</p>
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-[#8B7C73]">Total</p>
                      </div>
                      {inquirySummary?.inquiryPast30Days !== undefined && (
                        <>
                          <div className="w-px h-8 bg-[#EBE6DD]"></div>
                          <div>
                            <p className="text-xl font-bold text-[#382F2A]">{inquirySummary?.inquiryPast30Days || 0}</p>
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#8B7C73]">30 Days</p>
                          </div>
                        </>
                      )}
                      {inquirySummary?.inquiryPast12Months !== undefined && (
                        <>
                          <div className="w-px h-8 bg-[#EBE6DD]"></div>
                          <div>
                            <p className="text-xl font-bold text-[#382F2A]">{inquirySummary?.inquiryPast12Months || 0}</p>
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#8B7C73]">12 Mos</p>
                          </div>
                        </>
                      )}
                      {inquirySummary?.inquiryPast24Months !== undefined && (
                        <>
                          <div className="w-px h-8 bg-[#EBE6DD]"></div>
                          <div>
                            <p className="text-xl font-bold text-[#382F2A]">{inquirySummary?.inquiryPast24Months || 0}</p>
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#8B7C73]">24 Mos</p>
                          </div>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-[#8B7C73] leading-relaxed">
                      <span className="font-bold text-[#382F2A]">Note:</span> Frequent credit enquiries can be one factor considered in credit assessment. The impact depends on the overall credit profile.
                    </p>
                  </div>
                )}


                {/* Enquiries List */}
                {enquiries && enquiries.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-lg font-bold text-[#382F2A] mb-4">Recent Enquiries</h4>
                    <div className="space-y-3">
                      {enquiries.map((enq: any, i: number) => (
                        <div key={i} className="bg-white border border-[#EBE6DD] rounded-2xl p-4 shadow-sm flex items-center justify-between">
                          <div className="text-left">
                            <p className="text-sm font-bold text-[#382F2A]">{enq.memberShortName || 'Unknown Lender'}</p>
                            <p className="text-xs font-semibold text-[#8B7C73] mt-0.5">Date: {enq.enquiryDate || 'N/A'}</p>
                          </div>
                          <div className="text-right">
                            {Number(enq.enquiryAmount) > 0 && (
                              <>
                                <p className="text-sm font-bold text-[#382F2A]">₹{Number(enq.enquiryAmount).toLocaleString('en-IN')}</p>
                                <p className="text-[10px] font-semibold text-[#8B7C73] uppercase tracking-wider mt-0.5">Amount</p>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


              </motion.div>
            )}
          </div>

          <div>
            {(!isPreparingDownload ? dashboardTab === 'ongoing' : false) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Accounts List */}
                {activeAccounts && activeAccounts.length > 0 && (
                  <div>
                    <h4 className="text-lg font-bold text-[#382F2A] mb-4">Ongoing Loans</h4>
                    <div className="space-y-3">
                      {activeAccounts.map((acc: any, i: number) => {
                        const isExpanded = expandedAccount === acc.accountNumber;
                        return (
                          <div key={i} className="bg-white border border-[#EBE6DD] rounded-2xl overflow-hidden transition-all shadow-sm">
                            <div className="w-full flex items-center justify-between p-4 bg-[#FAF8F5] border-b border-[#EBE6DD]">
                              <div className="text-left">
                                <p className="text-sm font-bold text-[#382F2A]">{acc.memberShortName || 'Unknown Lender'}</p>
                                <p className="text-xs font-semibold text-[#8B7C73] mt-0.5">{acc.accountType || 'Unknown Type'}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-sm font-bold text-[#382F2A]">₹{Number(acc.currentBalance || 0).toLocaleString('en-IN')}</p>
                                  <p className="text-[10px] font-semibold text-[#8B7C73] uppercase tracking-wider mt-0.5">Balance</p>
                                </div>
                              </div>
                            </div>

                            <div className="p-4 grid grid-cols-2 gap-y-4 gap-x-2 bg-white">
                              <div>
                                <p className="text-[10px] font-bold text-[#8B7C73] uppercase">Account Number</p>
                                <p className="text-sm font-semibold text-[#382F2A]">{acc.accountNumber || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-[#8B7C73] uppercase">High Credit</p>
                                <p className="text-sm font-semibold text-[#382F2A]">₹{Number(acc.highCreditAmount || 0).toLocaleString('en-IN')}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-[#8B7C73] uppercase">EMI</p>
                                <p className="text-sm font-semibold text-[#382F2A]">{acc.emiAmount ? `₹${Number(acc.emiAmount).toLocaleString('en-IN')}` : 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-[#8B7C73] uppercase">Interest Rate</p>
                                <p className="text-sm font-semibold text-[#382F2A]">{acc.interest_rate ? `${acc.interest_rate}%` : 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-[#8B7C73] uppercase">Date Opened</p>
                                <p className="text-sm font-semibold text-[#382F2A]">{acc.dateOpened || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-[#8B7C73] uppercase">Date Reported</p>
                                <p className="text-sm font-semibold text-[#382F2A]">{acc.dateReported || 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}


                {(!activeAccounts || activeAccounts.length === 0) && (
                  <div className="bg-slate-50 border border-icy-blue rounded-2xl p-4 text-center">
                    <p className="text-sm font-medium text-brand-black/70">No ongoing loans found.</p>
                  </div>
                )}
              </motion.div>
            )}

            {(!isPreparingDownload ? dashboardTab === 'closed' : false) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Accounts List */}
                {closedAccounts && closedAccounts.length > 0 && (
                  <div>
                    <h4 className="text-lg font-bold text-[#382F2A] mb-4">Closed Loans</h4>
                    <div className="space-y-3">
                      {closedAccounts.map((acc: any, i: number) => {
                        const isExpanded = expandedAccount === acc.accountNumber;
                        return (
                          <div key={i} className="bg-white border border-[#EBE6DD] rounded-2xl overflow-hidden transition-all shadow-sm">
                            <button
                              onClick={() => setExpandedAccount(isExpanded ? null : acc.accountNumber)}
                              className="w-full flex items-center justify-between p-4 hover:bg-[#FAF8F5] transition-colors"
                            >
                              <div className="text-left">
                                <p className="text-sm font-bold text-[#382F2A]">{acc.memberShortName || 'Unknown Lender'}</p>
                                <p className="text-xs font-semibold text-[#8B7C73] mt-0.5">{acc.accountType || 'Unknown Type'}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-sm font-bold text-[#382F2A]">₹{Number(acc.currentBalance || 0).toLocaleString('en-IN')}</p>
                                  <p className="text-[10px] font-semibold text-[#8B7C73] uppercase tracking-wider mt-0.5">Balance</p>
                                </div>
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-[#8B7C73]" /> : <ChevronDown className="w-4 h-4 text-[#8B7C73]" />}
                              </div>
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-[#EBE6DD]"
                                >
                                  <div className="p-4 grid grid-cols-2 gap-y-4 gap-x-2 bg-[#FAF8F5]">
                                    <div>
                                      <p className="text-[10px] font-bold text-[#8B7C73] uppercase">Account Number</p>
                                      <p className="text-sm font-semibold text-[#382F2A]">{acc.accountNumber || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-[#8B7C73] uppercase">High Credit</p>
                                      <p className="text-sm font-semibold text-[#382F2A]">₹{Number(acc.highCreditAmount || 0).toLocaleString('en-IN')}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-[#8B7C73] uppercase">EMI</p>
                                      <p className="text-sm font-semibold text-[#382F2A]">{acc.emiAmount ? `₹${Number(acc.emiAmount).toLocaleString('en-IN')}` : 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-[#8B7C73] uppercase">Interest Rate</p>
                                      <p className="text-sm font-semibold text-[#382F2A]">{acc.interest_rate ? `${acc.interest_rate}%` : 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-[#8B7C73] uppercase">Date Opened</p>
                                      <p className="text-sm font-semibold text-[#382F2A]">{acc.dateOpened || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold text-[#8B7C73] uppercase">Date Reported</p>
                                      <p className="text-sm font-semibold text-[#382F2A]">{acc.dateReported || 'N/A'}</p>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}


                {(!closedAccounts || closedAccounts.length === 0) && (
                  <div className="bg-slate-50 border border-icy-blue rounded-2xl p-4 text-center">
                    <p className="text-sm font-medium text-brand-black/70">No closed loans found.</p>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {(!isPreparingDownload ? dashboardTab === 'eligibility' : (isDownloadingSection === 'eligibility' || isDownloadingSection === 'loans')) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Equifax Personal Info (Fallback) */}
              {(!isPreparingDownload || isDownloadingSection === 'eligibility') && (isEquifax || isCrif) && (
                <div className="bg-[#FAF8F5] border border-[#EBE6DD] rounded-3xl p-5 mb-6">
                  <h4 className="text-sm font-extrabold text-[#382F2A] mb-4">{isEquifax ? 'Equifax' : 'CRIF'} Profile Data</h4>
                  {equifaxPersonalInfo && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-[#8B7C73]">Name</p>
                        <p className="text-sm font-bold text-[#382F2A]">{equifaxPersonalInfo.Name?.FullName || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-[#8B7C73]">Date of Birth</p>
                        <p className="text-sm font-bold text-[#382F2A]">{equifaxPersonalInfo.DateOfBirth || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                  <div className="p-3 bg-white border border-[#EBE6DD] rounded-xl text-center">
                    <p className="text-xs text-[#8B7C73] leading-relaxed">
                      {isEquifax ? 'Equifax' : 'CRIF'} does not return detailed credit accounts in their JSON response.
                      <br />Please use the <strong>{isEquifax ? 'Equifax' : 'CRIF'} (PDF)</strong> option to view full account details.
                    </p>
                  </div>
                </div>
              )}



              {/* Profile Edit & Open Loans Form */}
              {(!isPreparingDownload || isDownloadingSection === 'loans') && (
                <div ref={loansRef} className={`mb-6 ${isDownloadingSection === 'loans' ? 'bg-white p-4 mb-4' : ''}`}>
                  {isDownloadingSection === 'loans' && (
                    <h3 className="text-xl font-bold bg-[#382F2A] text-white p-3 rounded-lg mt-8 mb-6 uppercase tracking-wider text-center">Section 2: Loans (Overrides)</h3>
                  )}
                  <h4 className="text-lg font-bold text-[#382F2A] mb-4">Complete Profile for Accurate Eligibility</h4>

                  <div className="bg-slate-50 border border-icy-blue rounded-2xl p-5 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-brand-black/80 mb-1 flex justify-between items-center">
                          <span>Net Monthly Salary</span>
                          <div className="flex items-center gap-2 text-[10px] font-bold">
                            <span className={`px-2 py-0.5 rounded-full ${totalCurrentEMI > maxEmiCapacity ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-brand-black/80'}`}>
                              Used EMI: ₹{totalCurrentEMI.toLocaleString('en-IN')}
                            </span>
                            <span className="bg-blue-50 text-blue-energy px-2 py-0.5 rounded-full">
                              Max EMI: ₹{maxEmiCapacity.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </label>
                        <input
                          type="number"
                          value={userOverrides.netSalary !== undefined ? userOverrides.netSalary : (formData.monthlyIncome || "")}
                          onChange={e => setUserOverrides({ ...userOverrides, netSalary: e.target.value })}
                          className="w-full bg-white border border-icy-blue rounded-xl px-3 py-2 text-sm focus:border-blue-energy outline-none"
                          placeholder="e.g. 50000"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-brand-black/80 mb-1 block">
                          Average Yearly Bonus
                        </label>
                        <input
                          type="number"
                          value={userOverrides.yearlyBonus !== undefined ? userOverrides.yearlyBonus : ""}
                          onChange={e => setUserOverrides({ ...userOverrides, yearlyBonus: e.target.value })}
                          className="w-full bg-white border border-icy-blue rounded-xl px-3 py-2 text-sm focus:border-blue-energy outline-none"
                          placeholder="e.g. 100000"
                        />
                      </div>

                      <div ref={employerDropdownRef} className="relative z-10">
                        <label className="text-xs font-semibold text-brand-black/80 mb-1 flex justify-between items-center">
                          <span>Employer</span>
                          {userOverrides.companyCategory && userOverrides.companyCategory !== 'Unknown' && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                              Tier: {userOverrides.companyCategory}
                            </span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={employerSearch || userOverrides.employer || formData.employer || ""}
                            onChange={e => {
                              setEmployerSearch(e.target.value);
                              setShowEmployerDropdown(true);
                              setUserOverrides({ ...userOverrides, employer: e.target.value });
                            }}
                            onFocus={() => setShowEmployerDropdown(true)}
                            className="w-full bg-white border border-icy-blue rounded-xl px-3 py-2 text-sm focus:border-blue-energy outline-none"
                            placeholder="Search your company..."
                            autoComplete="off"
                          />
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>

                        <AnimatePresence>
                          {showEmployerDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              transition={{ duration: 0.1 }}
                              className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-icy-blue rounded-xl shadow-lg z-50 py-1"
                            >
                              {isSearchingEmployer ? (
                                <div className="px-4 py-3 text-sm text-brand-black/70">Searching database...</div>
                              ) : asyncEmployers.length > 0 ? (
                                <>
                                  {asyncEmployers.map(e => (
                                    <div
                                      key={e.name}
                                      onClick={() => {
                                        setEmployerSearch(e.name);
                                        setUserOverrides({
                                          ...userOverrides,
                                          employer: e.name,
                                          companyCategory: e.tier
                                        });
                                        setShowEmployerDropdown(false);
                                      }}
                                      className="px-4 py-2 text-sm text-brand-black/90 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center"
                                    >
                                      <span>{e.name}</span>
                                      {e.tier !== 'Unknown' && (
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                          Tier: {e.tier}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                  <div
                                    onClick={() => {
                                      setEmployerSearch(debouncedEmployerSearch || "Unlisted Company");
                                      setUserOverrides({
                                        ...userOverrides,
                                        employer: debouncedEmployerSearch || "Unlisted Company",
                                        companyCategory: "Unknown"
                                      });
                                      setShowEmployerDropdown(false);
                                    }}
                                    className="px-4 py-2 text-sm font-semibold text-blue-700 cursor-pointer hover:bg-blue-50 border-t border-slate-100 flex justify-between items-center"
                                  >
                                    <span>Unlisted Company (Other)</span>
                                  </div>
                                </>
                              ) : (
                                <div className="px-4 py-3 text-sm text-brand-black/70 flex flex-col gap-2">
                                  {debouncedEmployerSearch.length >= 2 ? "No exact matches found." : "Type to specify company"}
                                  {debouncedEmployerSearch.length >= 2 && (
                                    <button
                                      onClick={() => {
                                        setEmployerSearch(debouncedEmployerSearch);
                                        setUserOverrides({
                                          ...userOverrides,
                                          employer: debouncedEmployerSearch,
                                          companyCategory: "Unknown"
                                        });
                                        setShowEmployerDropdown(false);
                                      }}
                                      className="mt-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-left text-xs font-semibold transition-colors"
                                    >
                                      Use "{debouncedEmployerSearch}" as Unlisted
                                    </button>
                                  )}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-brand-black/80 mb-1 block">Any EMI Bounce (6M)?</label>
                        <select
                          value={userOverrides.hasBounce || "no"}
                          onChange={e => setUserOverrides({ ...userOverrides, hasBounce: e.target.value })}
                          className="w-full bg-white border border-icy-blue rounded-xl px-3 py-2 text-sm focus:border-blue-energy outline-none"
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-brand-black/80 mb-1 block">Any Active Overdue?</label>
                        <select
                          value={userOverrides.hasActiveOverdue || ((accountSummary?.overdueAccounts || 0) > 0 ? "yes" : "no")}
                          onChange={e => setUserOverrides({ ...userOverrides, hasActiveOverdue: e.target.value })}
                          className="w-full bg-white border border-icy-blue rounded-xl px-3 py-2 text-sm focus:border-blue-energy outline-none"
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-brand-black/80 mb-1 block">Axis Customer Segment</label>
                        <select
                          value={userOverrides.axisCustomerSegment || "NTB"}
                          onChange={e => setUserOverrides({ ...userOverrides, axisCustomerSegment: e.target.value })}
                          className="w-full bg-white border border-icy-blue rounded-xl px-3 py-2 text-sm focus:border-blue-energy outline-none"
                        >
                          <option value="CSG">CSG</option>
                          <option value="Non-CSG CASA">Non-CSG CASA</option>
                          <option value="NTB">NTB</option>
                          <option value="Blue Collar">Blue Collar Staff</option>
                        </select>
                      </div>
                      {userOverrides.axisCustomerSegment === "Non-CSG CASA" && (
                        <div>
                          <label className="text-xs font-semibold text-brand-black/80 mb-1 block">Axis CASA Vintage &gt; 90 Days?</label>
                          <select
                            value={userOverrides.casaVintage || "no"}
                            onChange={e => setUserOverrides({ ...userOverrides, casaVintage: e.target.value })}
                            className="w-full bg-white border border-icy-blue rounded-xl px-3 py-2 text-sm focus:border-blue-energy outline-none"
                          >
                            <option value="no">No</option>
                            <option value="yes">Yes</option>
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-semibold text-brand-black/80 mb-1 block">Residence Type</label>
                        <select
                          value={userOverrides.residenceType || "Rented"}
                          onChange={e => setUserOverrides({ ...userOverrides, residenceType: e.target.value })}
                          className="w-full bg-white border border-icy-blue rounded-xl px-3 py-2 text-sm focus:border-blue-energy outline-none"
                        >
                          <option value="Rented">Rented</option>
                          <option value="Owned">Owned</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-brand-black/80 mb-1 block">City Tier</label>
                        <select
                          value={userOverrides.cityTier || "Non-Metro"}
                          onChange={e => setUserOverrides({ ...userOverrides, cityTier: e.target.value })}
                          className="w-full bg-white border border-icy-blue rounded-xl px-3 py-2 text-sm focus:border-blue-energy outline-none"
                        >
                          <option value="Non-Metro">Non-Metro</option>
                          <option value="Metro">Metro</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Fresh Loan / Top-Up Requirement */}
                  <div className="bg-slate-50 border border-icy-blue rounded-2xl p-5 mb-6">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-brand-black/90">Do you want a Fresh Loan / Top-Up?</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="wantsTopUp"
                            value="yes"
                            checked={userOverrides.wantsTopUp === 'yes'}
                            onChange={e => setUserOverrides({ ...userOverrides, wantsTopUp: e.target.value })}
                            className="accent-blue-energy"
                          /> Yes
                        </label>
                        <label className="flex items-center gap-1 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="wantsTopUp"
                            value="no"
                            checked={(userOverrides.wantsTopUp || 'no') === 'no'}
                            onChange={e => setUserOverrides({ ...userOverrides, wantsTopUp: e.target.value })}
                            className="accent-blue-energy"
                          /> No
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Balance Transfer Preference */}
                  <div className="bg-slate-50 border border-icy-blue rounded-2xl p-5 mb-6">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-brand-black/90">BT / Loan Preference</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="btPreference"
                            value="Any"
                            checked={(userOverrides.btPreference || 'Any') === 'Any'}
                            onChange={e => setUserOverrides({ ...userOverrides, btPreference: e.target.value })}
                            className="accent-blue-energy"
                          /> Any
                        </label>
                        <label className="flex items-center gap-1 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="btPreference"
                            value="BT to PL"
                            checked={userOverrides.btPreference === 'BT to PL'}
                            onChange={e => setUserOverrides({ ...userOverrides, btPreference: e.target.value })}
                            className="accent-blue-energy"
                          /> BT to PL
                        </label>
                        <label className="flex items-center gap-1 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="btPreference"
                            value="BT to OD"
                            checked={userOverrides.btPreference === 'BT to OD'}
                            onChange={e => setUserOverrides({ ...userOverrides, btPreference: e.target.value })}
                            className="accent-blue-energy"
                          /> BT to OD
                        </label>
                      </div>
                    </div>

                    {userOverrides.wantsTopUp === 'yes' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pt-4 border-t border-icy-blue">
                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-semibold text-brand-black/80 mb-1 block">Expected Tenure (Years)</label>
                            <input
                              type="number"
                              value={userOverrides.topUpTenure ?? 5}
                              onChange={e => setUserOverrides({ ...userOverrides, topUpTenure: e.target.value })}
                              className="w-full bg-white border border-icy-blue rounded-xl px-3 py-2 text-sm focus:border-blue-energy outline-none"
                              min={1}
                              max={30}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-brand-black/80 mb-1 block">Expected ROI (% p.a.)</label>
                            <input
                              type="number"
                              value={userOverrides.topUpRoi ?? 12}
                              onChange={e => setUserOverrides({ ...userOverrides, topUpRoi: e.target.value })}
                              className="w-full bg-white border border-icy-blue rounded-xl px-3 py-2 text-sm focus:border-blue-energy outline-none"
                              step="0.1"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-brand-black/80 mb-1 block">Required Loan Amount (₹)</label>
                            <input
                              type="number"
                              value={userOverrides.topUpAmount ?? ""}
                              onChange={e => setUserOverrides({ ...userOverrides, topUpAmount: e.target.value })}
                              className="w-full bg-white border border-icy-blue rounded-xl px-3 py-2 text-sm focus:border-blue-energy outline-none"
                              placeholder={`Max: ₹${Math.floor(maxFreshLoanAmount).toLocaleString('en-IN')}`}
                            />
                          </div>
                        </div>

                        <div className="bg-white border border-blue-energy p-4 rounded-xl flex flex-col justify-center">
                          <p className="text-xs text-brand-black/70 mb-1">Maximum Eligible Fresh Loan Amount:</p>
                          <p className="text-2xl font-bold text-blue-energy mb-2">₹{Math.floor(maxFreshLoanAmount).toLocaleString('en-IN')}</p>
                          <p className="text-xs text-brand-black/80">
                            Based on your unused EMI capacity of <strong>₹{Math.floor(unusedEmiCapacity).toLocaleString('en-IN')} / mo</strong>.
                          </p>
                          {Number(userOverrides.topUpAmount) > maxFreshLoanAmount && (
                            <p className="text-xs text-red-500 mt-2 font-semibold">
                              Error: Required amount exceeds maximum eligible limit.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <h4 className="text-lg font-bold text-[#382F2A] mb-4">Review Open Loans</h4>
                  <div className="space-y-4 mb-8">
                    {mappedAccounts.length === 0 && <p className="text-sm text-brand-black/70">No active loans found to evaluate.</p>}
                    {mappedAccounts.map((loan: any, idx: number) => {
                      const l = loanOverrides[loan.id] || {};
                      return (
                        <div key={`${loan.id}-${idx}`} className="bg-white border border-[#EBE6DD] rounded-2xl p-4 shadow-sm">
                          <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-[#382F2A]">Loan #{idx + 1} - {loan.originalType}</p>
                              {loan.pastDueAmount > 0 && (
                                <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-red-200">
                                  Overdue: ₹{loan.pastDueAmount.toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <label className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-brand-black/80">
                                <input
                                  type="checkbox"
                                  checked={loan.wantsBT === 'yes'}
                                  onChange={e => setLoanOverrides((prev: any) => ({ ...prev, [loan.id]: { ...(prev[loan.id] || {}), wantsBT: e.target.checked ? 'yes' : 'no' } }))}
                                  className="w-4 h-4 text-blue-energy accent-blue-energy rounded border-slate-300"
                                />
                                Consolidate?
                              </label>
                              <label className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-brand-black/80">
                                <input
                                  type="checkbox"
                                  checked={loan.userPaysEmi !== false}
                                  onChange={e => setLoanOverrides((prev: any) => ({ ...prev, [loan.id]: { ...(prev[loan.id] || {}), userPaysEmi: e.target.checked } }))}
                                  className="w-4 h-4 text-blue-energy accent-blue-energy rounded border-slate-300"
                                />
                                I pay this EMI
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="text-[10px] uppercase font-bold text-[#8B7C73]">Bank / NBFC</label>
                              {isDownloadingSection === 'loans' ? (
                                <p className="text-sm font-semibold text-[#382F2A] px-2 py-1.5">{l.bankName !== undefined ? l.bankName : (loan.bankName || "")}</p>
                              ) : (
                                <input
                                  type="text"
                                  value={l.bankName !== undefined ? l.bankName : (loan.bankName || "")}
                                  onChange={e => setLoanOverrides((prev: any) => ({ ...prev, [loan.id]: { ...(prev[loan.id] || {}), bankName: e.target.value } }))}
                                  className="w-full bg-[#FAF8F5] border border-[#EBE6DD] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-energy"
                                />
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-[#8B7C73]">Type</label>
                              {isDownloadingSection === 'loans' ? (
                                <p className="text-sm font-semibold text-[#382F2A] px-2 py-1.5">{l.type !== undefined ? l.type : (loan.type || "Personal Loan")}</p>
                              ) : (
                                <select
                                  value={l.type !== undefined ? l.type : (loan.type || "Personal Loan")}
                                  onChange={e => setLoanOverrides((prev: any) => ({ ...prev, [loan.id]: { ...(prev[loan.id] || {}), type: e.target.value } }))}
                                  className="w-full bg-[#FAF8F5] border border-[#EBE6DD] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-energy"
                                >
                                  <optgroup label="Generally Non-Transferable (Category A)">
                                    {['Car Loan', 'Home Loan', 'LAP', 'Gold Loan', 'Consumer Loan', 'Education Loan'].map(t => <option key={t} value={t}>{t}</option>)}
                                  </optgroup>
                                  <optgroup label="Potentially Transferable (Category B)">
                                    {['Personal Loan', 'Overdraft', 'App Loan', 'Credit Card'].map(t => <option key={t} value={t}>{t}</option>)}
                                  </optgroup>
                                  <option value="Unknown">Unknown</option>
                                </select>
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-[#8B7C73]">{loan.type === 'Overdraft' ? 'Amount Drawn' : 'Orig. Amount'}</label>
                              {isDownloadingSection === 'loans' ? (
                                <p className="text-sm font-semibold text-[#382F2A] px-2 py-1.5">{l.originalAmount !== undefined ? l.originalAmount : (loan.originalAmount || "")}</p>
                              ) : (
                                <input
                                  type="number"
                                  value={l.originalAmount !== undefined ? l.originalAmount : (loan.originalAmount || "")}
                                  onChange={e => setLoanOverrides((prev: any) => ({ ...prev, [loan.id]: { ...(prev[loan.id] || {}), originalAmount: e.target.value } }))}
                                  className="w-full bg-[#FAF8F5] border border-[#EBE6DD] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-energy"
                                />
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-[#8B7C73]">Current Bal.</label>
                              {isDownloadingSection === 'loans' ? (
                                <p className="text-sm font-semibold text-[#382F2A] px-2 py-1.5">{l.currentOutstanding !== undefined ? l.currentOutstanding : (loan.currentOutstanding || "")}</p>
                              ) : (
                                <input
                                  type="number"
                                  value={l.currentOutstanding !== undefined ? l.currentOutstanding : (loan.currentOutstanding || "")}
                                  onChange={e => setLoanOverrides((prev: any) => ({ ...prev, [loan.id]: { ...(prev[loan.id] || {}), currentOutstanding: e.target.value } }))}
                                  className="w-full bg-[#FAF8F5] border border-[#EBE6DD] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-energy"
                                />
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-[#8B7C73]">Date Issue</label>
                              {isDownloadingSection === 'loans' ? (
                                <p className="text-sm font-semibold text-[#382F2A] px-2 py-1.5">{l.dateOpened !== undefined ? l.dateOpened : (loan.dateOpened || "")}</p>
                              ) : (
                                <input
                                  type="text"
                                  value={l.dateOpened !== undefined ? l.dateOpened : (loan.dateOpened || "")}
                                  onChange={e => setLoanOverrides((prev: any) => ({ ...prev, [loan.id]: { ...(prev[loan.id] || {}), dateOpened: e.target.value } }))}
                                  className="w-full bg-[#FAF8F5] border border-[#EBE6DD] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-energy"
                                />
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-[#8B7C73]">{loan.type === 'Overdraft' ? 'OD Plan' : 'Tenure (Mos)'}</label>
                              {isDownloadingSection === 'loans' ? (
                                <p className="text-sm font-semibold text-[#382F2A] px-2 py-1.5">
                                  {loan.type === 'Overdraft' ?
                                    (l.odPlan !== undefined ? l.odPlan : (loan.odPlan || "2yr"))
                                    : (l.tenure !== undefined ? l.tenure : (loan.tenure || ""))}
                                </p>
                              ) : (
                                loan.type === 'Overdraft' ? (
                                  <select
                                    value={l.odPlan !== undefined ? l.odPlan : (loan.odPlan || "2yr")}
                                    onChange={e => setLoanOverrides((prev: any) => ({ ...prev, [loan.id]: { ...(prev[loan.id] || {}), odPlan: e.target.value } }))}
                                    className="w-full bg-[#FAF8F5] border border-[#EBE6DD] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-energy"
                                  >
                                    <option value="2yr">2 Years</option>
                                    <option value="3yr">3 Years</option>
                                  </select>
                                ) : (
                                  <input
                                    type="number"
                                    value={l.tenure !== undefined ? l.tenure : (loan.tenure || "")}
                                    onChange={e => setLoanOverrides((prev: any) => ({ ...prev, [loan.id]: { ...(prev[loan.id] || {}), tenure: e.target.value } }))}
                                    className="w-full bg-[#FAF8F5] border border-[#EBE6DD] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-energy"
                                  />
                                )
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-[#8B7C73]">EMI</label>
                              {isDownloadingSection === 'loans' ? (
                                <p className="text-sm font-semibold text-[#382F2A] px-2 py-1.5">{l.emi !== undefined ? l.emi : (loan.emi || "")}</p>
                              ) : (
                                <input
                                  type="number"
                                  value={l.emi !== undefined ? l.emi : (loan.emi || "")}
                                  onChange={e => setLoanOverrides((prev: any) => ({ ...prev, [loan.id]: { ...(prev[loan.id] || {}), emi: e.target.value } }))}
                                  className="w-full bg-[#FAF8F5] border border-[#EBE6DD] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-energy"
                                />
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-[#8B7C73]">Rate %</label>
                              {isDownloadingSection === 'loans' ? (
                                <p className="text-sm font-semibold text-[#382F2A] px-2 py-1.5">{l.rate !== undefined ? l.rate : (loan.rate || "")}</p>
                              ) : (
                                <input
                                  type="number"
                                  value={l.rate !== undefined ? l.rate : (loan.rate || "")}
                                  onChange={e => setLoanOverrides((prev: any) => ({ ...prev, [loan.id]: { ...(prev[loan.id] || {}), rate: e.target.value } }))}
                                  className="w-full bg-[#FAF8F5] border border-[#EBE6DD] rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-energy"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    <button
                      onClick={() => setManualLoans([...manualLoans, { accountNumber: 'manual_' + Date.now(), accountType: 'Personal Loan', currentBalance: 0, highCreditAmount: 0, memberShortName: '', interest_rate: 0, emiAmount: 0 }])}
                      className="mt-4 flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-brand-black/70 font-semibold hover:border-blue-energy hover:text-blue-energy transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add Missing Loan
                    </button>
                  </div>
                </div>
              )}

              {/* Eligibility Engine Results */}

              {(!isPreparingDownload || isDownloadingSection === 'eligibility') && (
                <div ref={eligRef} className={`mb-6 ${isDownloadingSection === 'eligibility' ? 'bg-white p-4 mb-4' : ''}`}>
                  {isDownloadingSection === 'eligibility' && (
                    <h3 className="text-xl font-bold bg-[#382F2A] text-white p-3 rounded-lg mt-8 mb-6 uppercase tracking-wider text-center">Section 3: Eligibility Results</h3>
                  )}
                  <h4 className="text-lg font-bold text-[#382F2A] mb-4">Eligible Consolidation Options</h4>
                  {eligibleLenders.length > 0 ? (
                    <div className="space-y-4">
                      {(() => {
                        const bestLender = eligibleLenders[0];
                        const consolidationAmount = catBLoans.reduce((sum: number, l: any) => sum + Number(l.currentOutstanding || 0), 0);
                        const currentEmiToConsolidate = catBLoans.reduce((sum: number, l: any) => sum + Number(l.emi || 0), 0);
                        const totalNewLoan = consolidationAmount + (userOverrides.wantsTopUp === 'yes' ? Number(userOverrides.topUpAmount || 0) : 0);

                        const ratePerMonth = (bestLender.headlineRate || 12) / 12 / 100;
                        const maxLenderTenure = bestLender.maxTenure || 60;
                        const selectedTenure = Number(userOverrides.consolidationTenure);
                        const tenureMonths = selectedTenure ? Math.min(selectedTenure, maxLenderTenure) : maxLenderTenure;

                        let dynamicMaxLoan = bestLender.universalMaxLoan || 0;
                        if (catBLoans.length > 0) {
                          const maxEmi = bestLender.universalMaxEmi || 0;
                          const usedEmi = bestLender.universalUsedEmi || 0;
                          const dynamicUnusedEmi = Math.max(0, maxEmi - (usedEmi - currentEmiToConsolidate));
                          if (dynamicUnusedEmi > 0) {
                            dynamicMaxLoan = Math.floor(
                              (dynamicUnusedEmi * (Math.pow(1 + ratePerMonth, maxLenderTenure) - 1)) /
                              (ratePerMonth * Math.pow(1 + ratePerMonth, maxLenderTenure))
                            );
                            if (bestLender.maxLoanAmount && dynamicMaxLoan > bestLender.maxLoanAmount) {
                              dynamicMaxLoan = bestLender.maxLoanAmount;
                            }
                          } else {
                            dynamicMaxLoan = 0;
                          }
                        }

                        const amountForEmi = Math.min(totalNewLoan, dynamicMaxLoan);
                        const isCapped = amountForEmi < totalNewLoan;

                        const newEmi = amountForEmi > 0 ? Math.round(
                          (amountForEmi * ratePerMonth * Math.pow(1 + ratePerMonth, tenureMonths)) /
                          (Math.pow(1 + ratePerMonth, tenureMonths) - 1)
                        ) : 0;

                        const hasTopUp = userOverrides.wantsTopUp === 'yes' && Number(userOverrides.topUpAmount || 0) > 0;
                        const canFullyConsolidate = dynamicMaxLoan >= consolidationAmount;
                        const consolidationOnlyEmi = (consolidationAmount > 0 && canFullyConsolidate) ? Math.round(
                          (consolidationAmount * ratePerMonth * Math.pow(1 + ratePerMonth, tenureMonths)) /
                          (Math.pow(1 + ratePerMonth, tenureMonths) - 1)
                        ) : 0;

                        const emiSavings = isCapped ? 0 : (currentEmiToConsolidate - newEmi);

                        if (totalNewLoan === 0) {
                          return (
                            <div className="bg-slate-50 border border-icy-blue rounded-2xl p-4 mb-2 shadow-sm text-center">
                              <p className="text-sm font-medium text-brand-black/80">
                                Select at least one loan to consolidate from the &quot;Review Open Loans&quot; section above, or request a fresh loan, to see your estimated savings.
                              </p>
                            </div>
                          );
                        }
                        return (
                          <div className="bg-[#FAF8F5] border border-[#EBE6DD] rounded-2xl p-5 mb-2 shadow-sm">
                            <h4 className="text-sm font-extrabold text-[#382F2A] mb-4 flex items-center justify-between">
                              <span>Consolidation Estimate (Best Option: {bestLender.name})</span>
                              <span className="text-xs font-semibold text-blue-energy bg-blue-50 px-2 py-1 rounded-md">{bestLender.headlineRate}% p.a.</span>
                            </h4>

                            {/* Details of consolidating loans */}
                            {catBLoans.length > 0 && (
                              <div className="mb-5 bg-white border border-icy-blue rounded-xl p-3 shadow-sm">
                                <p className="text-[10px] uppercase font-bold text-brand-black/70 mb-2">Loans Being Consolidated</p>
                                <div className="space-y-2 mb-3">
                                  {catBLoans.map((l: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-[#382F2A]">{l.bankName || 'Lender'}</span>
                                        <span className="text-slate-400">({l.type})</span>
                                      </div>
                                      <div className="text-right">
                                        <span className="font-semibold text-[#382F2A]">₹{Number(l.currentOutstanding || 0).toLocaleString('en-IN')}</span>
                                        <span className="text-slate-400 ml-2">EMI: ₹{Number(l.emi || 0).toLocaleString('en-IN')}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                  <span className="text-xs font-bold text-brand-black/90">Total</span>
                                  <div className="text-right text-xs">
                                    <span className="font-bold text-[#382F2A]">₹{consolidationAmount.toLocaleString('en-IN')}</span>
                                    <span className="font-bold text-blue-energy ml-2">EMI: ₹{currentEmiToConsolidate.toLocaleString('en-IN')}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-white border border-slate-100 p-3 rounded-xl relative">
                                <p className="text-[10px] uppercase tracking-wider font-bold text-brand-black/70">Total New Loan</p>
                                <p className="text-xl font-black text-[#382F2A] mt-1">
                                  ₹{amountForEmi.toLocaleString('en-IN')}
                                </p>
                                {isCapped && (
                                  <p className="text-[9px] text-amber-600 mt-1 font-semibold">Capped by lender policy</p>
                                )}
                                {userOverrides.wantsTopUp === 'yes' && Number(userOverrides.topUpAmount || 0) > 0 && !isCapped && (
                                  <p className="text-[10px] text-brand-black/70 mt-1">Includes ₹{Number(userOverrides.topUpAmount).toLocaleString('en-IN')} Top-up</p>
                                )}
                              </div>
                              <div className="bg-white border border-slate-100 p-3 rounded-xl">
                                <p className="text-[10px] uppercase tracking-wider font-bold text-brand-black/70">Est. New EMI</p>
                                <p className="text-xl font-black text-[#382F2A] mt-1">₹{newEmi.toLocaleString('en-IN')}</p>
                                {hasTopUp && consolidationAmount > 0 && canFullyConsolidate && (
                                  <p className="text-[10px] text-brand-black/70 mt-1 font-semibold">
                                    Consolidation only: ₹{consolidationOnlyEmi.toLocaleString('en-IN')} ({tenureMonths}m)
                                  </p>
                                )}
                                <div className="mt-2 flex items-center gap-2">
                                  <label className="text-[10px] text-brand-black/70 font-semibold whitespace-nowrap">Tenure (Mos):</label>
                                  <select
                                    value={tenureMonths}
                                    onChange={(e) => setUserOverrides({ ...userOverrides, consolidationTenure: e.target.value })}
                                    className="bg-slate-50 border border-icy-blue rounded px-1 py-0.5 text-xs outline-none"
                                  >
                                    {[12, 24, 36, 48, 60, 72, 84].filter(t => t <= maxLenderTenure).map(t => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className={`border p-3 rounded-xl ${emiSavings >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                <p className={`text-[10px] uppercase tracking-wider font-bold ${emiSavings >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {emiSavings >= 0 ? 'EMI Savings' : 'Extra EMI'}
                                </p>
                                <p className={`text-xl font-black mt-1 ${emiSavings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {emiSavings >= 0 ? '↓' : '↑'} ₹{Math.abs(emiSavings).toLocaleString('en-IN')}
                                </p>
                                <p className={`text-[10px] mt-1 ${emiSavings >= 0 ? 'text-emerald-600/80' : 'text-red-600/80'}`}>
                                  vs current consolidated EMI
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {eligibleLenders.map((lender: any, i: number) => {
                        const isConsolidating = catBLoans && catBLoans.length > 0;
                        const consolidationAmount = isConsolidating ? catBLoans.reduce((sum: number, l: any) => sum + Number(l.currentOutstanding || 0), 0) : 0;
                        const currentEmiToConsolidate = isConsolidating ? catBLoans.reduce((sum: number, l: any) => sum + Number(l.emi || 0), 0) : 0;

                        const totalNewLoanReq = consolidationAmount + (userOverrides.wantsTopUp === 'yes' ? Number(userOverrides.topUpAmount || 0) : 0);

                        const ratePerMonth = (lender.headlineRate || 12) / 12 / 100;
                        const maxLenderTenure = lender.maxTenure || 60;
                        const selectedTenure = Number(userOverrides.consolidationTenure);
                        const tenureMonths = selectedTenure ? Math.min(selectedTenure, maxLenderTenure) : maxLenderTenure;

                        let dynamicMaxLoan = lender.universalMaxLoan || 0;
                        if (isConsolidating) {
                          const maxEmi = lender.universalMaxEmi || 0;
                          const usedEmi = lender.universalUsedEmi || 0;
                          const dynamicUnusedEmi = Math.max(0, maxEmi - (usedEmi - currentEmiToConsolidate));
                          if (dynamicUnusedEmi > 0) {
                            dynamicMaxLoan = Math.floor(
                              (dynamicUnusedEmi * (Math.pow(1 + ratePerMonth, maxLenderTenure) - 1)) /
                              (ratePerMonth * Math.pow(1 + ratePerMonth, maxLenderTenure))
                            );
                            if (lender.maxLoanAmount && dynamicMaxLoan > lender.maxLoanAmount) {
                              dynamicMaxLoan = lender.maxLoanAmount;
                            }
                          } else {
                            dynamicMaxLoan = 0;
                          }
                        }

                        const amountForEmi = totalNewLoanReq > 0 ? Math.min(totalNewLoanReq, dynamicMaxLoan) : dynamicMaxLoan;
                        const isCapped = totalNewLoanReq > 0 && amountForEmi < totalNewLoanReq;

                        const newEmi = amountForEmi > 0 ? Math.round(
                          (amountForEmi * ratePerMonth * Math.pow(1 + ratePerMonth, tenureMonths)) /
                          (Math.pow(1 + ratePerMonth, tenureMonths) - 1)
                        ) : 0;

                        const hasTopUp = userOverrides.wantsTopUp === 'yes' && Number(userOverrides.topUpAmount || 0) > 0;
                        const canFullyConsolidate = dynamicMaxLoan >= consolidationAmount;
                        const consolidationOnlyEmi = (consolidationAmount > 0 && canFullyConsolidate) ? Math.round(
                          (consolidationAmount * ratePerMonth * Math.pow(1 + ratePerMonth, tenureMonths)) /
                          (Math.pow(1 + ratePerMonth, tenureMonths) - 1)
                        ) : 0;

                        const emiSavings = (isConsolidating && totalNewLoanReq > 0 && !isCapped) ? (currentEmiToConsolidate - newEmi) : 0;

                        return (
                          <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-3 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-bold text-emerald-900">{lender.name}</p>
                                <p className="text-xs font-semibold text-emerald-700 mt-0.5">Est. Rate: {lender.headlineRate}%</p>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-bold px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full uppercase">
                                  {lender.outcome === 'ELIGIBLE' ? 'High Match' : 'Conditional'}
                                </span>
                              </div>
                            </div>

                            {/* Universal Calculation Breakdown */}
                            <div className="bg-emerald-100/50 rounded-lg p-3 mt-1">
                              <p className="text-[11px] font-bold text-emerald-800 mb-2 border-b border-emerald-200/50 pb-1 flex items-center justify-between">
                                Calculation Breakdown
                                {lender.cibilMinus1MaxFunding > 0 && <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded uppercase">CIBIL -1 Allowed</span>}
                              </p>
                              <div className="grid grid-cols-2 gap-3 text-[10px]">
                                <div>
                                  <p className="text-emerald-700/80 font-semibold mb-0.5 uppercase tracking-wider">Bank-Specific Category</p>
                                  <p className="font-bold text-emerald-900">{lender.employerCategory || lender.employerTier || 'Unknown'}</p>
                                </div>
                                <div>
                                  <p className="text-emerald-700/80 font-semibold mb-0.5 uppercase tracking-wider">Effective NMI (Add-backs)</p>
                                  <p className="font-bold text-emerald-900">₹{(lender.effectiveNTH || 0).toLocaleString('en-IN')}</p>
                                </div>
                                <div>
                                  <p className="text-emerald-700/80 font-semibold mb-0.5 uppercase tracking-wider">Max FOIR</p>
                                  <p className="font-bold text-emerald-900">{lender.maxFOIR || `${lender.maxFoir}%`}</p>
                                </div>
                                <div>
                                  <p className="text-emerald-700/80 font-semibold mb-0.5 uppercase tracking-wider">Used EMI / Max EMI</p>
                                  <p className="font-bold text-emerald-900">
                                    ₹{(lender.universalUsedEmi || 0).toLocaleString('en-IN')} / ₹{(lender.universalMaxEmi || 0).toLocaleString('en-IN')}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-emerald-700/80 font-semibold mb-0.5 uppercase tracking-wider">Est. Max New Loan</p>
                                  <p className="font-black text-blue-700 text-[13px]">
                                    ₹{dynamicMaxLoan.toLocaleString('en-IN')}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-emerald-700/80 font-semibold mb-0.5 uppercase tracking-wider">Est. New EMI</p>
                                  <p className="font-bold text-emerald-900">
                                    ₹{newEmi.toLocaleString('en-IN')} <span className="font-normal text-[9px]">({tenureMonths}m{isCapped ? ' on partial loan' : ''})</span>
                                  </p>
                                  {hasTopUp && consolidationAmount > 0 && canFullyConsolidate && (
                                    <p className="text-[9px] text-emerald-700 mt-0.5 font-semibold">
                                      Consolidation only: ₹{consolidationOnlyEmi.toLocaleString('en-IN')} ({tenureMonths}m)
                                    </p>
                                  )}
                                  <div className="mt-1.5 flex items-center gap-1.5">
                                    <label className="text-[9px] text-emerald-700/80 font-semibold">Tenure (Mos):</label>
                                    <select
                                      value={tenureMonths}
                                      onChange={(e) => setUserOverrides({ ...userOverrides, consolidationTenure: e.target.value })}
                                      className="bg-emerald-50/50 border border-emerald-200/50 rounded px-1 py-0.5 text-[9px] outline-none text-emerald-900 font-medium"
                                    >
                                      {[12, 24, 36, 48, 60, 72, 84].filter(t => t <= maxLenderTenure).map(t => (
                                        <option key={t} value={t}>{t}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                                {isConsolidating && (
                                  <div>
                                    <p className="text-emerald-700/80 font-semibold mb-0.5 uppercase tracking-wider">EMI Savings</p>
                                    <p className={`font-bold ${emiSavings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                      {emiSavings >= 0 ? '↓' : '↑'} ₹{Math.abs(emiSavings).toLocaleString('en-IN')}
                                    </p>
                                  </div>
                                )}
                                {(lender.axisCibilRequired || lender.minCibil) ? (
                                  <div>
                                    <p className="text-emerald-700/80 font-semibold mb-0.5 uppercase tracking-wider">Required CIBIL</p>
                                    <p className="font-bold text-emerald-900">{lender.axisCibilRequired || lender.minCibil}</p>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-emerald-700/80 font-semibold mb-0.5 uppercase tracking-wider">Required CIBIL</p>
                                    <p className="font-bold text-emerald-900">Profile Based</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {lender.id === 'axis' && lender.axisMaxLoan !== undefined && (
                              <div className="bg-white rounded-lg p-3 border border-emerald-100 mt-1 shadow-sm">
                                <p className="text-[11px] font-bold text-emerald-800 mb-2 border-b border-emerald-50 pb-1">Axis Specific Policy Estimate</p>
                                <div className="grid grid-cols-2 gap-3 text-[10px]">
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">Max Eligible Loan</p>
                                    <p className="font-black text-emerald-900 text-sm">₹{lender.axisMaxLoan.toLocaleString('en-IN')}</p>
                                  </div>
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">Max EMI Capacity</p>
                                    <p className="font-bold text-emerald-900">₹{lender.axisMaxEmiCapacity.toLocaleString('en-IN')}</p>
                                  </div>
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">Considered Obligations</p>
                                    <p className="font-bold text-emerald-900">₹{lender.axisTotalObligations.toLocaleString('en-IN')}</p>
                                  </div>
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">Unused Capacity</p>
                                    <p className="font-bold text-emerald-900">₹{lender.axisUnusedCapacity.toLocaleString('en-IN')}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {lender.id === 'indusind' && lender.indusindMaxLoan !== undefined && (
                              <div className="bg-white rounded-lg p-3 border border-emerald-100 mt-1 shadow-sm">
                                <p className="text-[11px] font-bold text-emerald-800 mb-2 border-b border-emerald-50 pb-1">IndusInd Specific Policy Estimate</p>
                                <div className="grid grid-cols-2 gap-3 text-[10px]">
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">Max Eligible Loan</p>
                                    <p className="font-black text-emerald-900 text-sm">₹{lender.indusindMaxLoan.toLocaleString('en-IN')}</p>
                                  </div>
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">FOIR Applied</p>
                                    <p className="font-bold text-emerald-900">{lender.indusindFOIR}%</p>
                                  </div>
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">Max Tenure</p>
                                    <p className="font-bold text-emerald-900">{lender.maxTenure} Months</p>
                                  </div>
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">Unused Capacity</p>
                                    <p className="font-bold text-emerald-900">₹{lender.indusindUnusedCapacity.toLocaleString('en-IN')}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {lender.id === 'kotak' && lender.kotakEffectiveNTH !== undefined && (
                              <div className="bg-white rounded-lg p-3 border border-emerald-100 mt-1 shadow-sm">
                                <p className="text-[11px] font-bold text-emerald-800 mb-2 border-b border-emerald-50 pb-1">Kotak OD Specific Policy Estimate</p>
                                <div className="grid grid-cols-2 gap-3 text-[10px]">
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">Effective Net Income</p>
                                    <p className="font-black text-emerald-900 text-sm">₹{lender.kotakEffectiveNTH.toLocaleString('en-IN')}</p>
                                  </div>
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">OD Structure</p>
                                    <p className="font-bold text-emerald-900">2 Yr Fixed + 5 Yr Dropline</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {lender.id === 'abfl' && lender.abflMaxLoan !== undefined && (
                              <div className="bg-white rounded-lg p-3 border border-emerald-100 mt-1 shadow-sm">
                                <p className="text-[11px] font-bold text-emerald-800 mb-2 border-b border-emerald-50 pb-1">Aditya Birla Specific Policy Estimate</p>
                                <div className="grid grid-cols-2 gap-3 text-[10px]">
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">High Limit Eligibility</p>
                                    <p className="font-black text-emerald-900 text-sm">₹{lender.abflMaxLoan.toLocaleString('en-IN')}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {lender.id === 'poonawalla' && lender.poonawallaMaxLoan !== undefined && (
                              <div className="bg-white rounded-lg p-3 border border-emerald-100 mt-1 shadow-sm">
                                <p className="text-[11px] font-bold text-emerald-800 mb-2 border-b border-emerald-50 pb-1">Poonawalla Specific Policy Estimate</p>
                                <div className="grid grid-cols-2 gap-3 text-[10px]">
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">Max Eligible Loan</p>
                                    <p className="font-black text-emerald-900 text-sm">₹{lender.poonawallaMaxLoan.toLocaleString('en-IN')}</p>
                                  </div>
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">FOIR Applied</p>
                                    <p className="font-bold text-emerald-900">{lender.poonawallaFOIR}%</p>
                                  </div>
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">Unused Capacity</p>
                                    <p className="font-bold text-emerald-900">₹{lender.poonawallaUnusedCapacity.toLocaleString('en-IN')}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {lender.id === 'chola' && lender.cholaEffectiveNTH !== undefined && (
                              <div className="bg-white rounded-lg p-3 border border-emerald-100 mt-1 shadow-sm">
                                <p className="text-[11px] font-bold text-emerald-800 mb-2 border-b border-emerald-50 pb-1">Chola Specific Policy Estimate</p>
                                <div className="grid grid-cols-2 gap-3 text-[10px]">
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">Effective Net Income</p>
                                    <p className="font-black text-emerald-900 text-sm">₹{lender.cholaEffectiveNTH.toLocaleString('en-IN')}</p>
                                  </div>
                                  <div>
                                    <p className="text-emerald-700/70 font-semibold mb-0.5 uppercase tracking-wider">Max Eligible Loan</p>
                                    <p className="font-black text-emerald-900 text-sm">₹{lender.cholaMaxLoan.toLocaleString('en-IN')}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                      <p className="text-sm font-medium text-amber-800">
                        Based on this initial data, standard consolidation options require deeper review.
                      </p>
                    </div>
                  )}

                  {ineligibleLenders.length > 0 && (
                    <div className="mt-8">
                      <h4 className="text-sm font-bold text-[#382F2A] mb-3">Lenders Not Currently Eligible</h4>
                      <div className="space-y-3">
                        {ineligibleLenders.map((lender: any, i: number) => (
                          <div key={i} className="bg-red-50/50 border border-red-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-red-900">{lender.name}</p>
                              <p className="text-xs font-semibold text-red-700 mt-0.5">Est. Rate: {lender.headlineRate}%</p>
                            </div>
                            <div className="text-left sm:text-right flex-1 sm:max-w-[60%]">
                              {lender.reasons && lender.reasons.length > 0 ? (
                                <ul className="text-[11px] text-red-800 list-disc list-inside sm:text-right space-y-0.5">
                                  {lender.reasons.map((reason: string, rIdx: number) => (
                                    <li key={rIdx} className="leading-tight">{reason}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-[11px] text-red-800">Does not meet policy requirements</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}


            </motion.div>
          )}

        </div>
        <button className="w-full py-4 bg-blue-energy text-white rounded-xl font-medium hover:bg-blue-800 transition-all duration-300 active:scale-95 shadow-sm hover:shadow-md">
          Speak with a Consolidation Expert
        </button>
        <p className="text-[10px] text-slate-400 text-center mt-4 leading-tight">
          *These figures are indicative estimates. Final eligibility, rate, amount, tenure and approval are determined by the lender.
        </p>
      </div>
    </motion.div>
  );
}