"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F6F9FC] text-[#0A2540] p-4">
      <div className="flex flex-col items-center gap-4 animate-fadeIn">
        <img
          src="/img/logo_with_name.webp"
          alt="Credit Expert India"
          className="h-10 w-auto object-contain"
        />
        <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-500 bg-white border border-slate-200/80 px-4 py-2 rounded-full shadow-2xs">
          <Loader2 className="w-4 h-4 text-[#3F8EFC] animate-spin" />
          <span>Opening Credit Expert India Workplace...</span>
        </div>
      </div>
    </div>
  );
}
