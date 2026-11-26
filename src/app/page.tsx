"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (user.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/branch");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFF8F3] text-[#2E2E2E] p-4">
      <div className="flex flex-col items-center gap-4 animate-fadeIn">
        <Logo size="lg" />
        <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200/80 px-4 py-2 rounded-full shadow-2xs">
          <Loader2 className="w-4 h-4 text-[#FF5A00] animate-spin" />
          <span>Opening Amortas Workplace...</span>
        </div>
      </div>
    </div>
  );
}
