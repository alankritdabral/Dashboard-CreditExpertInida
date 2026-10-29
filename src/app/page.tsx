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
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10">
          <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
        </div>
        <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
          Loading Credit Expert India Operations Portal...
        </p>
      </div>
    </div>
  );
}
