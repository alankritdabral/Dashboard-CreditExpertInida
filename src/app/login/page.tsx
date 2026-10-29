"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  Lock,
  Mail,
  Building2,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [activeTab, setActiveTab] = useState<"branch" | "admin">("branch");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[26rem] h-[26rem] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-blue-400 font-semibold shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Credit Expert India · Operations Portal
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Operations Sign In
          </h1>
          <p className="text-xs text-slate-400">
            Secure authorized access for Branch teams and Executive Administrators.
          </p>
        </div>

        {/* Portal Selection Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => {
              setActiveTab("branch");
              setErrorMessage(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "branch"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "text-slate-400 hover:text-slate-200"
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
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "admin"
                ? "bg-slate-800 text-white shadow-md shadow-slate-900/40 border border-slate-700/60"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Executive Admin
          </button>
        </div>

        {/* Login Form Box */}
        <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {activeTab === "branch" ? "Branch Team Access" : "Control Panel Sign In"}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {activeTab === "branch"
                  ? "Enter your branch email & password to fetch CIBIL"
                  : "Administrative credential verification"}
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Encrypted
            </span>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Registered Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] font-medium text-blue-400 hover:text-blue-300 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                activeTab === "branch"
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25"
                  : "bg-gradient-to-r from-blue-700 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 text-white shadow-indigo-600/25"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Credentials...
                </>
              ) : (
                <>
                  Sign In to {activeTab === "branch" ? "Branch Workplace" : "Admin Panel"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Notice info */}
          <div className="pt-2 border-t border-slate-800/60 text-center">
            <p className="text-[11px] text-slate-500">
              {activeTab === "branch"
                ? "Daily access codes are retired. Sign in with your assigned branch account."
                : "Executive access is restricted to verified administrators."}
            </p>
          </div>
        </div>

        {/* Quick-Fill Demo Helpers */}
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 backdrop-blur-md space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Quick-Fill Demo Credentials
            </span>
            <span className="text-[10px] text-slate-500">Click to fill</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill("admin@creditexpertindia.com", "admin")}
              className="p-2 text-left rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white group-hover:text-indigo-400">
                  Super Admin
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Admin
                </span>
              </div>
              <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                admin@creditexpertindia.com
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill("rudrapur@creditexpertindia.com", "branch")}
              className="p-2 text-left rounded-xl bg-slate-950/80 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white group-hover:text-blue-400">
                  Rudrapur Branch
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Branch
                </span>
              </div>
              <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                rudrapur@creditexpertindia.com
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill("delhi@creditexpertindia.com", "branch")}
              className="p-2 text-left rounded-xl bg-slate-950/80 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white group-hover:text-blue-400">
                  Delhi Branch
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Branch
                </span>
              </div>
              <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                delhi@creditexpertindia.com
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill("dehradun@creditexpertindia.com", "branch")}
              className="p-2 text-left rounded-xl bg-slate-950/80 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white group-hover:text-blue-400">
                  Dehradun Branch
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Branch
                </span>
              </div>
              <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                dehradun@creditexpertindia.com
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
