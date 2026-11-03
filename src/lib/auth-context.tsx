"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { DashboardUser, UserRole } from "./types";

interface AuthContextType {
  user: DashboardUser | null;
  loading: boolean;
  login: (email: string, pass: string, code?: string) => Promise<{ success: boolean; error?: string; role?: UserRole; codeRequired?: boolean }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

// The signed session cookie is the source of truth. Mirror the last validated
// user in sessionStorage so reloads inside the freshness window skip the
// /api/auth/session round-trip (and its Firestore lookup).
const CACHE_KEY = "cei_session_user";
const FRESH_MS = 5 * 60_000;

function loadCached(): { user: DashboardUser; at: number } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user && Date.now() - parsed.at < FRESH_MS ? parsed : null;
  } catch {
    return null;
  }
}

function saveCached(user: DashboardUser | null) {
  try {
    if (user) sessionStorage.setItem(CACHE_KEY, JSON.stringify({ user, at: Date.now() }));
    else sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage unavailable */
  }
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  refreshSession: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const lastSessionFetch = useRef(0);

  const fetchSession = async () => {
    lastSessionFetch.current = Date.now();
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          saveCached(data.user);
          return;
        }
      }
      setUser(null);
      saveCached(null);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Re-validate on navigation only when signed out or the last check is stale.
  useEffect(() => {
    if (!user && lastSessionFetch.current === 0) {
      const cached = loadCached();
      if (cached) {
        lastSessionFetch.current = cached.at;
        // sessionStorage is only readable after mount, so this has to run in an effect.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser(cached.user);
        setLoading(false);
        return;
      }
    }
    const stale = Date.now() - lastSessionFetch.current > 5 * 60_000;
    if (!user || stale) fetchSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const login = async (email: string, pass: string, code?: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass, code }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        saveCached(data.user);
        return { success: true, role: data.user.role as UserRole };
      }
      return { success: false, error: data.error || "Login failed", codeRequired: !!data.codeRequired };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {}
    setUser(null);
    saveCached(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshSession: fetchSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
