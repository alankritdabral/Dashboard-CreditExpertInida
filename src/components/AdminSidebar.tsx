"use client";

import React from "react";
import { NavTabItem } from "@/components/DashboardHeader";

interface AdminSidebarProps {
  tabs: NavTabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

// Desktop: sticky left sidebar. Below lg: horizontally scrolling chip row.
export function AdminSidebar({ tabs, activeTab, onTabChange }: AdminSidebarProps) {
  return (
    <>
      <aside className="hidden lg:block w-60 shrink-0 sticky top-[72px] self-start h-[calc(100dvh-72px)] overflow-y-auto border-r border-slate-200/80 bg-white/70 px-3 py-5">
        <nav aria-label="Admin sections">
          <ul className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-[13px] font-semibold text-left cursor-pointer transition-colors ${
                      isActive
                        ? "bg-[#3F8EFC] text-white shadow-md shadow-[#3F8EFC]/25"
                        : "text-[#3C4F69] hover:bg-slate-100 hover:text-[#0A2540]"
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4 shrink-0" />}
                    <span className="flex-1 min-w-0 truncate">{tab.label}</span>
                    {typeof tab.count === "number" && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive ? "bg-white/25 text-white" : "bg-slate-200/90 text-slate-700"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <nav
        aria-label="Admin sections"
        className="lg:hidden overflow-x-auto no-scrollbar border-b border-slate-200/80 bg-white/70"
      >
        <ul className="flex items-center gap-2 px-4 sm:px-8 py-2.5 w-max min-w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`min-h-[44px] px-4 rounded-full flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                    isActive
                      ? "bg-[#3F8EFC] text-white border-[#3F8EFC] shadow-md shadow-[#3F8EFC]/25"
                      : "bg-white text-[#3C4F69] border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                  {tab.label}
                  {typeof tab.count === "number" && (
                    <span
                      className={`text-[10px] px-1.5 rounded-full font-bold ${
                        isActive ? "bg-white/25 text-white" : "bg-slate-200/90 text-slate-700"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
