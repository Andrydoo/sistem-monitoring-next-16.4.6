import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sistem Monitoring Penagihan Piutang | PT PLN (Persero) ULP Kraksaan",
  description:
    "Sistem Operasional dan Eksekutif Monitoring Penagihan Piutang Pelanggan PT PLN (Persero) ULP Kraksaan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`}>
      <body
        className={`${inter.className} min-h-full bg-slate-50 text-slate-900 antialiased`}
      >
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
