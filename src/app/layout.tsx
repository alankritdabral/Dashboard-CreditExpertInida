import type { Metadata } from "next";
import { Poppins, Inter, Manrope } from "next/font/google";
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

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Amortas — Operations & Admin Dashboard",
    template: "%s | Amortas",
  },
  description:
    "Authorized operational control center for Amortas. CIBIL bureau pull portal, cross-branch management, lender eligibility engine, and analytics.",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
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
      className={`${inter.variable} ${manrope.variable} ${poppins.variable} h-full scroll-smooth`}
    >
      <body className="min-h-full bg-[#FFF8F3] text-[#2E2E2E] font-sans antialiased selection:bg-[#FF5A00] selection:text-white flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
