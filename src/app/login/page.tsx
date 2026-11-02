"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import {
  Lock,
  Mail,
  Building2,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ArrowRight,
  Shield,
  MapPin,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithCode } = useAuth();

  const [activeTab, setActiveTab] = useState<"branch" | "admin" | "code">("branch");
  const [codeBranch, setCodeBranch] = useState("rudrapur");
  const [accessCode, setAccessCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (activeTab === "code") {
      if (!accessCode.trim()) {
        setErrorMessage("Please enter the daily access code.");
        return;
      }
      setLoading(true);
      setErrorMessage(null);
      const codeRes = await loginWithCode(codeBranch, accessCode.trim());
      if (codeRes.success) {
        router.push("/branch");
      } else {
        setErrorMessage(codeRes.error || "Invalid daily access code.");
        setLoading(false);
      }
      return;
    }

    if (!email || !password) {
      setErrorMessage("Please enter both work email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const res = await login(email, password);

    if (res.success) {
      if (res.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/branch");
      }
    } else {
      setErrorMessage(res.error || "Authentication failed. Check your credentials.");
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string, demoRole: "branch" | "admin") => {
    setEmail(demoEmail);
    setPassword("Password@123");
    setActiveTab(demoRole);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-dvh bg-[#F6F9FC] flex flex-col items-center justify-center px-4 py-6 sm:p-6 relative overflow-hidden">
      {/* Ambient background glows matching website */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] sm:w-[38rem] h-[28rem] sm:h-[38rem] bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[28rem] h-[28rem] bg-sky-100/60 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Logo & Header */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-block group">
            <Image
              src="/img/logo_with_name.webp"
              alt="Credit Expert India"
              width={220}
              height={52}
              priority
              className="h-11 w-auto object-contain mx-auto group-hover:opacity-90 transition-opacity"
            />
          </Link>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs text-[#3F8EFC] font-bold shadow-2xs">
            <Shield className="w-3.5 h-3.5 text-[#3F8EFC]" />
            Operations & Control Portal
          </div>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Authorized sign in for Branch teams & Executive Administrators.
          </p>
        </div>

        {/* Website-Style Pill Selector Tabs */}
        <div className="flex p-1 bg-white border border-slate-200 rounded-full shadow-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab("branch");
              setErrorMessage(null);
            }}
            className={`flex-1 min-w-0 min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 py-1.5 sm:py-2.5 rounded-full text-[11px] leading-tight text-center sm:text-xs font-bold transition-all cursor-pointer ${
              activeTab === "branch"
                ? "bg-[#3F8EFC] text-white shadow-md shadow-[#3F8EFC]/25"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Branch Workplace
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("admin");
              setErrorMessage(null);
            }}
            className={`flex-1 min-w-0 min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 py-1.5 sm:py-2.5 rounded-full text-[11px] leading-tight text-center sm:text-xs font-bold transition-all cursor-pointer ${
              activeTab === "admin"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/30"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Executive Admin
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("code");
              setErrorMessage(null);
            }}
            className={`flex-1 min-w-0 min-h-[44px] flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 py-1.5 sm:py-2.5 rounded-full text-[11px] leading-tight text-center sm:text-xs font-bold transition-all cursor-pointer ${
              activeTab === "code"
                ? "bg-[#3F8EFC] text-white shadow-md shadow-[#3F8EFC]/25"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Lock className="w-4 h-4" />
            Daily Code
          </button>
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-8 shadow-xl shadow-slate-900/5 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-extrabold text-slate-900">
              {activeTab === "branch"
                ? "Branch Team Sign In"
                : activeTab === "code"
                ? "Branch Daily Code Sign In"
                : "Executive Admin Sign In"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === "branch"
                ? "Sign in with your branch email & password to fetch CIBIL."
                : activeTab === "code"
                ? "Select your branch and enter today's access code."
                : "Verify administrative credentials to access control center."}
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === "code" ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Branch</label>
                  <select
                    value={codeBranch}
                    onChange={(e) => setCodeBranch(e.target.value)}
                    className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3.5 py-3 min-h-[44px] text-base sm:text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium"
                  >
                    <option value="rudrapur">Rudrapur</option>
                    <option value="delhi">Delhi</option>
                    <option value="dehradun">Dehradun</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Daily Access Code
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Enter code"
                      className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 min-h-[44px] text-base sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    activeTab === "branch"
                      ? "rudrapur@creditexpertindia.com"
                      : "admin@creditexpertindia.com"
                  }
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 min-h-[44px] text-base sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Password</label>
                <Link
                  href="/forgot-password"
                  className="inline-flex items-center min-h-[44px] -my-3 text-xs font-semibold text-[#3F8EFC] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 min-h-[44px] text-base sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium"
                />
              </div>
            </div>

              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full min-h-[48px] py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                activeTab !== "admin"
                  ? "bg-[#3F8EFC] hover:bg-blue-600 text-white shadow-[#3F8EFC]/25"
                  : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Credentials...
                </>
              ) : (
                <>
                  Sign In to {activeTab === "admin" ? "Admin Panel" : "Branch Workplace"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500">
              {activeTab === "branch"
                ? "Daily access codes are retired. Sign in with your assigned branch account."
                : "Executive access is strictly restricted to verified administrators."}
            </p>
          </div>
        </div>

        {/* Quick-Fill Demo Helpers */}
        <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-2.5 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-x-2 border-b border-slate-100 pb-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Fill Demo Credentials (Localhost)
            </span>
            <span className="text-[10px] text-slate-400">Click to fill</span>
          </div>

          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill("admin@creditexpertindia.com", "admin")}
              className="p-2.5 min-h-[44px] text-left rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 group-hover:text-slate-900">
                  Super Admin
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">
                  Admin
                </span>
              </div>
              <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                admin@creditexpertindia.com
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill("rudrapur@creditexpertindia.com", "branch")}
              className="p-2.5 min-h-[44px] text-left rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-200 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 group-hover:text-[#3F8EFC]">
                  Rudrapur Branch
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#3F8EFC] border border-blue-200">
                  Branch
                </span>
              </div>
              <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                rudrapur@creditexpertindia.com
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill("delhi@creditexpertindia.com", "branch")}
              className="p-2.5 min-h-[44px] text-left rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-200 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 group-hover:text-[#3F8EFC]">
                  Delhi Branch
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#3F8EFC] border border-blue-200">
                  Branch
                </span>
              </div>
              <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                delhi@creditexpertindia.com
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill("dehradun@creditexpertindia.com", "branch")}
              className="p-2.5 min-h-[44px] text-left rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-200 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 group-hover:text-[#3F8EFC]">
                  Dehradun Branch
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#3F8EFC] border border-blue-200">
                  Branch
                </span>
              </div>
              <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                dehradun@creditexpertindia.com
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
