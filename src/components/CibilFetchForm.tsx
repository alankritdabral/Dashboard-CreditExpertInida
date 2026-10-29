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
  Building,
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
  const [bureau, setBureau] = useState("v1"); // v1 = CIBIL TransUnion, crif = CRIF, experian = Experian

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
      // 1. Prepare IDSPay bureau payload
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

  // If report is fetched, display full interactive report view
  if (reportResult) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Report Generated Successfully for {firstName} {lastName}
              </h3>
              <p className="text-xs text-slate-400">
                PAN: <span className="font-mono text-slate-200">{pan.toUpperCase()}</span> · Branch:{" "}
                <span className="text-blue-400 font-semibold">{effectiveBranch}</span> · Bureau:{" "}
                <span className="uppercase text-indigo-400 font-bold">{reportResult.bureau}</span>
              </p>
            </div>
          </div>

          <button
            onClick={resetForm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Fetch Another Applicant
          </button>
        </div>

        {/* Interactive Bureau Dashboard */}
        <div className="bg-white rounded-3xl p-6 shadow-2xl overflow-hidden border border-slate-200 text-slate-900">
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
      {/* Header Info Banner */}
      <div className="bg-gradient-to-r from-blue-900/40 via-slate-900 to-indigo-950/40 border border-blue-800/40 p-5 rounded-3xl backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/10">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Instant Credit Bureau Pull</h2>
            <p className="text-xs text-slate-400">
              Fetch real-time CIBIL / Experian / CRIF reports directly. Automatically attributed to{" "}
              <strong className="text-blue-400">{effectiveBranch}</strong> branch.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400 font-medium">Attribution:</span>
          <span className="text-emerald-400 font-bold">{user?.name} ({effectiveBranch})</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Fetch Error:</span>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleFetch} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl">
        {/* Section 1: Bureau Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
            1. Select Credit Bureau
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "v1", name: "TransUnion CIBIL", desc: "Standard Score & Hybrid Report" },
              { id: "crif", name: "CRIF High Mark", desc: "B2C Full Credit Profile" },
              { id: "experian", name: "Experian Bureau", desc: "IN Profile Score & Enquiries" },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBureau(b.id)}
                className={`p-3.5 rounded-2xl text-left border transition-all cursor-pointer ${
                  bureau === b.id
                    ? "bg-blue-600/15 border-blue-500 text-white shadow-lg shadow-blue-500/10"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold block">{b.name}</span>
                  {bureau === b.id && <CheckCircle className="w-3.5 h-3.5 text-blue-400" />}
                </div>
                <span className="text-[10px] text-slate-500 block mt-1">{b.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Personal Identification */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            2. Applicant Identification
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">First Name *</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Rahul"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Last Name *</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Sharma"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Mobile Number *</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                  placeholder="9876543210"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">PAN Number *</label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono uppercase tracking-wider"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Date of Birth</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Gender</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGender("Male")}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    gender === "Male"
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  Male
                </button>
                <button
                  type="button"
                  onClick={() => setGender("Female")}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    gender === "Female"
                      ? "bg-blue-600 text-white border-blue-500"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  Female
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Address & Location Details */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            3. Address & Location Details
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-400 mb-1">Street Address</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Plot No. / Area / Landmark"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">PIN Code</label>
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                placeholder="110001"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Rudrapur"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Uttarakhand"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Fetching report directly queries the official bureau API. Full report is saved automatically.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
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
