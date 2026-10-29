"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { Building2, ShieldCheck, LogOut, LucideIcon, ExternalLink } from "lucide-react";

export interface NavTabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

interface DashboardHeaderProps {
  tabs: NavTabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  badgeLabel?: string;
}

export function DashboardHeader({
  tabs,
  activeTab,
  onTabChange,
  badgeLabel,
}: DashboardHeaderProps) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[68px] sm:h-[72px] flex items-center justify-between gap-4">
        {/* Left: Official Brand Logo with Name & Scope Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={isAdmin ? "/admin" : "/branch"}
            className="flex items-center gap-2 group transition-transform active:scale-[0.99]"
          >
            <Image
              src="/img/logo_with_name.webp"
              alt="Credit Expert India"
              width={195}
              height={46}
              priority
              className="h-8 sm:h-9 w-auto object-contain group-hover:opacity-90 transition-opacity"
            />
          </Link>

          {/* Role / Branch Pill Badge */}
          <div
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${
              isAdmin
                ? "bg-[#0A2540] text-white border-slate-800"
                : "bg-blue-50 text-[#3F8EFC] border-blue-200"
            }`}
          >
            {isAdmin ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Executive Admin</span>
              </>
            ) : (
              <>
                <Building2 className="w-3.5 h-3.5 text-[#3F8EFC]" />
                <span>{badgeLabel || `${user?.branch || "Branch"} Workplace`}</span>
              </>
            )}
          </div>
        </div>

        {/* Center: Website-style Pill Navigation Tab Bar */}
        <nav className="flex-1 flex items-center justify-center overflow-x-auto no-scrollbar py-1">
          <ul className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-full border border-slate-200/80 shadow-inner">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    className={`relative px-3.5 sm:px-4 py-1.5 text-xs sm:text-[13px] font-semibold transition-all rounded-full flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "text-white"
                        : "text-[#3C4F69] hover:text-[#0A2540] hover:bg-white/60"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="dashboard-header-active-pill"
                        className="absolute inset-0 bg-[#3F8EFC] rounded-full shadow-md shadow-[#3F8EFC]/30"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                      {tab.label}
                      {typeof tab.count === "number" && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isActive
                              ? "bg-white/25 text-white"
                              : "bg-slate-200/90 text-slate-700"
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Right: Quick Website Link, User Profile & Sign Out Button */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="https://creditexpertindia.com"
            target="_blank"
            rel="noreferrer"
            className="hidden xl:inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#3F8EFC] transition-colors px-2 py-1"
            title="Open Credit Expert India customer website in a new tab"
          >
            <span>Visit Website</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          <div className="text-right hidden lg:block">
            <span className="text-xs font-bold text-slate-900 block leading-tight">
              {user?.name}
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              {isAdmin ? "Super Admin" : `${user?.branch} Branch`}
            </span>
          </div>

          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
            title="Sign out of workplace"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
