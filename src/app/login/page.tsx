"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import {
  Lock,
  KeyRound,
  Mail,
  AlertCircle,
  Loader2,
  ArrowRight,
  Shield,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
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

    // One sign-in for everyone: admins send email + password only, employees
    // also send today's access code. The server decides which one applies.
    const res = await login(email, password, accessCode.trim() || undefined);

    if (res.success) {
      router.push(res.role === "admin" ? "/admin" : "/branch");
    } else {
      setErrorMessage(res.error || "Authentication failed. Check your credentials.");
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 min-h-[44px] text-base sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium";

  return (
    <div className="min-h-dvh bg-[#F6F9FC] flex flex-col items-center justify-center px-4 py-6 sm:p-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] sm:w-[38rem] h-[28rem] sm:h-[38rem] bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[28rem] h-[28rem] bg-sky-100/60 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
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
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-8 shadow-xl shadow-slate-900/5 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-extrabold text-slate-900">Sign In</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Admins use email & password. Employees also enter today&apos;s daily access code.
            </p>
          </div>

          {errorMessage && (
            <div role="alert" className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-bold text-slate-700 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@creditexpertindia.com"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="text-xs font-bold text-slate-700">Password</label>
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
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-code" className="block text-xs font-bold text-slate-700 mb-1.5">
                Daily Access Code <span className="font-medium text-slate-400">(employees only)</span>
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-code"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Not needed for admins"
                  className={inputCls}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer bg-[#3F8EFC] hover:bg-blue-600 text-white shadow-[#3F8EFC]/25 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Credentials...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
