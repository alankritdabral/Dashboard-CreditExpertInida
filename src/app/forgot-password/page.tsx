"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  ShieldAlert,
} from "lucide-react";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // STEP 1: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid work email address.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMessage(data.message);
        if (data.devOtp) setDevOtpCode(data.devOtp);
        setStep(2);
      } else {
        setErrorMessage(data.error || "Failed to dispatch verification code.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setErrorMessage("Please enter the 6-digit verification code.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpCode }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMessage(null);
        setStep(3);
      } else {
        setErrorMessage(data.error || "Invalid verification code.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword, confirmPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setStep(4);
      } else {
        setErrorMessage(data.error || "Failed to reset password.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F9FC] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow matching website */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Logo & Header */}
        <div className="text-center space-y-3">
          <Link href="/login" className="inline-block group">
            <Image
              src="/img/logo_with_name.webp"
              alt="Credit Expert India"
              width={200}
              height={48}
              priority
              className="h-10 w-auto object-contain mx-auto group-hover:opacity-90 transition-opacity"
            />
          </Link>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === s
                    ? "w-8 bg-[#3F8EFC]"
                    : step > s
                    ? "w-4 bg-emerald-500"
                    : "w-4 bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Card Box */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xl shadow-slate-900/5 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && step < 4 && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* STEP 1: ENTER EMAIL */}
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-[#3F8EFC] mx-auto flex items-center justify-center">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Reset Your Password</h2>
                <p className="text-xs text-slate-500">
                  Enter your registered work email to receive a 6-digit verification code.
                </p>
              </div>

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
                    placeholder="branch@creditexpertindia.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-[#3F8EFC] hover:bg-blue-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#3F8EFC]/25 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending Verification Code...
                    </>
                  ) : (
                    <>
                      Send 6-Digit Code
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                  </Link>
                </div>
              </div>
            </form>
          )}

          {/* STEP 2: VERIFY OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-[#3F8EFC] mx-auto flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Enter Security Code</h2>
                <p className="text-xs text-slate-500">
                  We sent a 6-digit code to <span className="text-slate-800 font-bold">{email}</span>.
                </p>
              </div>

              {devOtpCode && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                  <span>
                    🛠️ <strong>Dev Code:</strong>{" "}
                    <span className="font-mono text-sm font-bold text-amber-900">{devOtpCode}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setOtpCode(devOtpCode)}
                    className="text-[11px] underline font-bold text-amber-700 hover:text-amber-900 cursor-pointer"
                  >
                    Auto-fill
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest text-slate-900 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-bold"
                />
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-[#3F8EFC] hover:bg-blue-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#3F8EFC]/25 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying Code...
                    </>
                  ) : (
                    <>
                      Verify Code
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setErrorMessage(null);
                    }}
                    className="text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Change Email
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleSendOtp}
                    className="text-[#3F8EFC] hover:text-blue-700 font-semibold underline cursor-pointer"
                  >
                    Resend Code
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* STEP 3: NEW PASSWORD */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-[#3F8EFC] mx-auto flex items-center justify-center">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Set New Password</h2>
                <p className="text-xs text-slate-500">
                  Create a new secure password for <span className="text-slate-800 font-bold">{email}</span>.
                </p>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    New Password (min 6 characters)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#3F8EFC] focus:ring-2 focus:ring-[#3F8EFC]/20 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-[#3F8EFC] hover:bg-blue-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#3F8EFC]/25 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  <>
                    Update Password
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 4 && (
            <div className="text-center space-y-5 py-3 animate-fadeIn">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto flex items-center justify-center shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  Password Updated
                </span>
                <h2 className="text-xl font-bold text-slate-900">Reset Complete</h2>
                <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                  Your password has been successfully updated. You can now sign in with your new credentials.
                </p>
              </div>

              <Link
                href="/login"
                className="inline-flex w-full py-3.5 rounded-xl bg-[#3F8EFC] hover:bg-blue-600 text-white text-xs font-bold items-center justify-center gap-2 shadow-lg shadow-[#3F8EFC]/25 transition-all"
              >
                Proceed to Sign In
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
