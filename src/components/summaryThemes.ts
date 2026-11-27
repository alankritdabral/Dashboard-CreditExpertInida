/**
 * Colour theme for the "Loan Refinance Summary" PNG card (Sunset Gradient).
 * Brand tokens come from the Amortas site: orange #FD6C01 / #FF5A00, charcoal #252525,
 * cream #FFF9F4, peach #FFE4CC, light orange #FFB366.
 */

export interface BankPalette {
  l1: string; // column bottom
  m0: string; // entablature top
  m1: string; // entablature bottom
  b0: string; // base top
  b1: string; // base bottom
  side: string; // column shadow side
  cap: string; // column cap
  capBase: string; // column foot
  ped: string; // pediment inner
  plat: string; // ground shadow
  glow: string;
  glowOp: number;
}

export interface SummaryTheme {
  id: string;
  name: string;
  blurb: string;
  pageBg: string;
  ink: string;
  slate: string;
  line: string;
  panelBg: string;
  accent: string;
  accentSoft: string;
  footnote: string;
  hero: { bg: string; text: string; sub: string; hi: string; pillBg: string; pillBorder: string; pillText: string; pillIcon: string; border?: string };
  logo: { mark: string; word: string };
  bank: BankPalette;
  cur: { bg0: string; bg1: string; border: string; pillBg: string; pillText: string; divider: string };
  progress: [string, string];
  track: string;
  savings: { bg: string; border: string; title: string; sub: string; btnBg: string; btnText: string };
}

const WHITE_BANK: BankPalette = { l1: "#FFE0C2", m0: "#FFFFFF", m1: "#FFD1A3", b0: "#FFB366", b1: "#FD6C01", side: "#FFD1A3", cap: "#FFFFFF", capBase: "#FFE4CC", ped: "#FFE4CC", plat: "#B44300", glow: "#FFFFFF", glowOp: 0.45 };

const CHARCOAL_SAVINGS = { bg: "linear-gradient(100deg, #1A1A1A 0%, #252525 55%, #3A3A3A 100%)", border: "#FD6C01", title: "#FFD1A3", sub: "#E8C9AE", btnBg: "#FD6C01", btnText: "#FFFFFF" };

const WARM_CUR = { bg0: "#FFF9F4", bg1: "#FFEFE0", border: "#FFD1A3", pillBg: "#FFE4CC", pillText: "#8A3500", divider: "#F5CFAE" };

const WARM = { ink: "#252525", slate: "#626262", line: "#F3E3D3", panelBg: "#FFFFFF", accent: "#E15F00", accentSoft: "#FFE4CC", footnote: "#8A8A8A" };

export const SUMMARY_THEME: SummaryTheme = {
    id: "sunset", name: "4 · Sunset Gradient", blurb: "Deep orange fading to light orange, charcoal savings banner.",
    pageBg: "#FFF3E8", ...WARM,
    hero: { bg: "linear-gradient(135deg, #FF5A00 0%, #FF8A33 60%, #FFB366 100%)", text: "#FFFFFF", sub: "#FFF3E8", hi: "#252525", pillBg: "#FFFFFF", pillBorder: "#FFFFFF", pillText: "#8A3500", pillIcon: "#FD6C01" },
    logo: { mark: "#FFFFFF", word: "#FFFFFF" }, bank: WHITE_BANK, cur: WARM_CUR,
    progress: ["#FF5A00", "#FFB366"], track: "#F3E3D3", savings: CHARCOAL_SAVINGS,
  };

export const DEFAULT_SUMMARY_THEME = SUMMARY_THEME;
