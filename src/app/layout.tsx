import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Credit Expert India — Operations & Admin Dashboard",
    template: "%s | Credit Expert India",
  },
  description:
    "Authorized operational control center for Credit Expert India. CIBIL bureau pull portal, cross-branch management, lender eligibility engine, and analytics.",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "any" },
      { url: "/favicon.ico", type: "image/x-icon", sizes: "48x48" },
      { url: "/img/logo.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${manrope.variable} h-full scroll-smooth`}
    >
      <body className="min-h-full bg-[#F6F9FC] text-[#0A2540] font-sans antialiased selection:bg-[#3F8EFC] selection:text-white flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
