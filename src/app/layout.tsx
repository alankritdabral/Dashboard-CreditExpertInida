import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Credit Expert India - Operations & Admin Dashboard",
  description: "Secure operational control center for Credit Expert India. CIBIL bureau pull portal, cross-branch management, and analytics.",
  icons: {
    icon: "/img/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full bg-slate-950 text-slate-100 antialiased selection:bg-blue-600 selection:text-white flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
