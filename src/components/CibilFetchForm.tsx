"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Search,
  Shield,
  User,
  Phone,
  CreditCard,
  Calendar,
  MapPin,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  RotateCcw,
} from "lucide-react";
import { CreditReportDashboard } from "./CreditReportDashboard";

interface CibilFetchFormProps {
  onSuccess?: () => void;
  defaultBranch?: string;
}

export function CibilFetchForm({ onSuccess, defaultBranch }: CibilFetchFormProps) {
  const { user } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [pan, setPan] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<"Male" | "Female">("Male");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [bureau, setBureau] = useState("v1"); // v1 = CIBIL, crif = CRIF, experian = Experian

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportResult, setReportResult] = useState<{
    bureau: string;
    raw_api_data: any;
    formData: any;
  } | null>(null);

  const effectiveBranch = defaultBranch || user?.branch || "Online";

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please provide first and last name.");
      return;
    }

    const cleanMobile = mobile.trim().replace(/\D/g, "");
    if (cleanMobile.length !== 10) {
      setError("Please provide a valid 10-digit mobile number.");
      return;
    }

    const cleanPan = pan.trim().toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(cleanPan)) {
      setError("Please enter a valid 10-character PAN number (e.g., ABCDE1234F).");
      return;
    }

    setLoading(true);

    try {
      // 1. Prepare bureau payload
      const bodyPayload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        mobile: cleanMobile,
        pan: cleanPan,
        dob: dob || "1990-01-01",
        gender: gender.toLowerCase(),
        address: address || "City Center",
        pincode: pincode || "110001",
        city: city || "Delhi",
        state: state || "Delhi",
        consent: "Y",
      };

      // 2. Call IDSPay API proxy
      const apiRes = await fetch("/api/idspay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bureau,
          bodyPayload,
        }),
      });

      const resData = await apiRes.json();

      if (!apiRes.ok && !resData.data && !resData.raw_api_data) {
        throw new Error(resData.error || resData.message || "Bureau request failed");
      }

      const bureauPayload = resData.data || resData;

      // 3. Save to database with attribution: WHO fetched the report
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          mobile: cleanMobile,
          pan: cleanPan,
          gender,
          bureau,
          credit_score: bureauPayload?.credit_score || bureauPayload?.personalInfo?.score || null,
          raw_api_data: bureauPayload,
          sourceOverride: user?.role === "admin" ? "dashboard_admin" : "dashboard_branch",
          fetchedByOverride: {
            type: user?.role === "admin" ? "admin" : "branch",
            name: user?.name || "Staff",
            email: user?.email || "staff@creditexpertindia.com",
            branch: effectiveBranch,
            role: user?.role || "branch",
            source: user?.role === "admin" ? "dashboard_admin" : "dashboard_branch",
          },
        }),
      });

      // 4. Set state to display CreditReportDashboard
      setReportResult({
        bureau,
        raw_api_data: bureauPayload,
        formData: {
          firstName,
          lastName,
          mobile: cleanMobile,
          pan: cleanPan,
          gender,
          bureau,
        },
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Fetch report error:", err);
      setError(err.message || "Failed to fetch bureau report. Please verify details.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setReportResult(null);
    setFirstName("");
    setLastName("");
    setMobile("");
    setPan("");
    setDob("");
    setAddress("");
    setPincode("");
    setCity("");
    setState("");
    setError(null);
  };

  if (reportResult) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between bg-white border border-slate-200/90 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Report Generated: {firstName} {lastName}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                PAN: <span className="font-mono font-bold text-slate-800">{pan.toUpperCase()}</span> · Branch:{" "}
                <span className="text-[#3F8EFC] font-bold">{effectiveBranch}</span> · Bureau:{" "}
                <span className="uppercase text-indigo-600 font-bold">{reportResult.bureau}</span>
              </p>
            </div>
          </div>

          <button
            onClick={resetForm}
            className="px-4 py-2.5 bg-[#3F8EFC] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#3F8EFC]/20 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Fetch Another Applicant
          </button>
        </div>

        {/* Interactive Bureau Dashboard */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl overflow-hidden border border-slate-200 text-slate-900">
          <CreditReportDashboard
            bureau={reportResult.bureau}
            cibilData={reportResult.raw_api_data}
            formData={reportResult.formData}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Info Banner matching website */}
      <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-blue-50 border border-blue-100 text-[#3F8EFC] flex items-center justify-center shrink-0 shadow-xs">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Instant Credit Bureau Pull</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct live query to CIBIL / Experian / CRIF. Results auto-attributed to{" "}
              <strong className="text-[#3F8EFC] font-semibold">{effectiveBranch}</strong> branch.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs shadow-2xs">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-slate-500 font-medium">Attribution:</span>
          <span className="text-slate-900 font-bold">{user?.name} ({effectiveBranch})</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-3 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Fetch Error:</span>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleFetch} className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl shadow-slate-900/5">
        {/* Section 1: Bureau Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
            1. Select Credit Bureau
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: "v1", name: "TransUnion CIBIL", desc: "Hybrid Score & Accounts" },
              { id: "crif", name: "CRIF High Mark", desc: "B2C Comprehensive Report" },
              { id: "experian", name: "Experian Bureau", desc: "IN Profile Score & Enquiries" },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBureau(b.id)}
                className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                  bureau === b.id
                    ? "bg-blue-50/60 border-[#3F8EFC] text-slate-900 shadow-md shadow-blue-500/10 ring-2 ring-[#3F8EFC]/20"
                    : "bg-slate-50/70 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold block text-slate-900">{b.name}</span>
                  {bureau === b.id && <CheckCircle className="w-4 h-4 text-[#3F8EFC]" />}
                </div>
                <span className="text-[11px] text-slate-500 block mt-1">{b.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Personal Identification */}
        <div className="space-y-3.5 pt-4 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            2. Applicant Identification
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Rahul"
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Sharma"
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number *</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                  placeholder="9876543210"
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-mono font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Number *</label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-mono uppercase font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGender("Male")}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    gender === "Male"
                      ? "bg-[#3F8EFC] text-white border-[#3F8EFC] shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Male
                </button>
                <button
                  type="button"
                  onClick={() => setGender("Female")}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    gender === "Female"
                      ? "bg-[#3F8EFC] text-white border-[#3F8EFC] shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Female
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Address & Location Details */}
        <div className="space-y-3.5 pt-4 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            3. Address & Location Details
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Plot No. / Area / Landmark"
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Code</label>
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                placeholder="110001"
                className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-mono font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Rudrapur"
                className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Uttarakhand"
                className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium"
              />
            </div>
          </div>
        </div>

        {/* Action Button matching website */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Queries the official bureau API and persists the report with full attribution.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-7 py-3.5 rounded-xl bg-[#3F8EFC] hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-[#3F8EFC]/25 transition-all cursor-pointer shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Querying Bureau...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Fetch Bureau Report
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
