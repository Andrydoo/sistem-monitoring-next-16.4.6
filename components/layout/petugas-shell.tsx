"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PeranPengguna } from "@prisma/client";
import {
  Building2,
  ClipboardCheck,
  Clock,
  LogOut,
  Shield,
  Zap,
} from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface PetugasShellUser {
  id: number;
  username: string;
  nama: string;
  peran: PeranPengguna;
  kodeUnit: string | null;
}

export interface PetugasShellProps {
  user: PetugasShellUser;
  children: React.ReactNode;
}

interface PetugasNavItem {
  mobileLabel: string;
  desktopLabel: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const PETUGAS_NAV_ITEMS: ReadonlyArray<PetugasNavItem> = [
  {
    mobileLabel: "Tugas Saya",
    desktopLabel: "Daftar Tugas Saya",
    href: "/petugas",
    icon: ClipboardCheck,
  },
  {
    mobileLabel: "Janji Bayar",
    desktopLabel: "Jadwal Janji Bayar",
    href: "/petugas/pengingat",
    icon: Clock,
  },
];

function isPetugasNavActive(pathname: string, href: string): boolean {
  if (href === "/petugas") {
    return pathname === "/petugas" || pathname.startsWith("/petugas/piutang");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function resolveActiveModuleTitle(pathname: string): string {
  if (pathname.startsWith("/petugas/pengingat")) {
    return "Jadwal Janji Bayar & Overdue";
  }
  if (pathname.startsWith("/petugas/piutang")) {
    return "Detail Piutang & Laporan Kunjungan";
  }
  return "Daftar Tugas Penagihan";
}

export function PetugasShell({ user, children }: PetugasShellProps) {
  const pathname = usePathname();
  const unitCode = user.kodeUnit ?? "51304";
  const activeModuleTitle = resolveActiveModuleTitle(pathname);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      {/* Sidebar Desktop Tetap (Seragam dengan CorporateShell) */}
      <aside className="hidden border-r border-slate-800 bg-slate-900 text-slate-200 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col">
        <div className="flex h-full flex-col justify-between">
          <div>
            {/* Brand Header Formal PT PLN */}
            <div className="flex h-14 items-center gap-3 border-b border-slate-800 px-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-sky-400">
                <Zap className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold tracking-wider text-sky-400 uppercase">
                  PT PLN (Persero)
                </p>
                <p className="truncate text-xs font-medium text-slate-100">
                  ULP Kraksaan • Unit{" "}
                  <span className="font-mono tabular-nums">{unitCode}</span>
                </p>
              </div>
            </div>

            {/* Label Peran Formal */}
            <div className="border-b border-slate-800 px-4 py-3">
              <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                Workspace Operasional
              </p>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                <Shield
                  className="h-3.5 w-3.5 shrink-0 text-sky-400"
                  strokeWidth={1.75}
                />
                <span>Modul Petugas Lapangan</span>
              </div>
            </div>

            {/* Menu Navigasi Desktop */}
            <nav className="space-y-1 p-3" aria-label="Navigasi Utama Petugas">
              {PETUGAS_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isPetugasNavActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-sky-600 text-white shadow-xs"
                        : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-white" : "text-slate-400"
                      )}
                      strokeWidth={1.75}
                    />
                    <span className="truncate">{item.desktopLabel}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer Identitas Petugas di Sidebar */}
          <div className="border-t border-slate-800 p-4">
            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
              <p className="truncate text-xs font-semibold text-slate-100">
                {user.nama}
              </p>
              <p className="mt-0.5 truncate font-mono text-xs text-slate-400 tabular-nums">
                @{user.username} • Unit {unitCode}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Area Utama (Mobile + Desktop) */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-slate-50 pb-20 lg:pb-8 lg:pl-64">
        {/* Top Bar Gelap Mobile (< lg) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 text-white lg:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-sky-400">
              <Zap className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                {user.nama}
              </p>
              <p className="truncate font-mono text-[11px] text-slate-300 tabular-nums">
                ULP Kraksaan • Unit {unitCode}
              </p>
            </div>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Keluar dari sesi petugas"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-700"
            >
              <LogOut className="h-4 w-4 text-slate-300" strokeWidth={1.75} />
              <span>Keluar</span>
            </button>
          </form>
        </header>

        {/* Top Header Korporat Desktop (>= lg) */}
        <header className="sticky top-0 z-20 hidden h-14 items-center justify-between border-b border-slate-200 bg-white px-6 lg:flex">
          <div className="flex min-w-0 items-center gap-3">
            <Building2
              className="h-4 w-4 shrink-0 text-sky-600"
              strokeWidth={1.75}
            />
            <span className="truncate text-sm font-semibold text-slate-900">
              {activeModuleTitle}
            </span>
            <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 tabular-nums">
              Unit {unitCode}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-900">
                {user.nama}
              </p>
              <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                @{user.username}
              </p>
            </div>

            <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
              {user.peran}
            </span>

            <form action={logoutAction}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-9 rounded-md border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut
                  className="h-4 w-4 text-slate-600"
                  strokeWidth={1.75}
                />
                <span>Keluar</span>
              </Button>
            </form>
          </div>
        </header>

        {/* Kontainer Konten Responsif (Mobile max-w-lg -> Desktop max-w-7xl) */}
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 lg:max-w-7xl lg:px-6 lg:py-6">
          {children}
        </main>
      </div>

      {/* Bottom Navigation Bar Tetap Mobile (< lg) */}
      <nav
        aria-label="Navigasi Bawah Petugas"
        className="fixed inset-x-0 bottom-0 z-30 h-16 border-t border-slate-200 bg-white lg:hidden"
      >
        <div className="mx-auto grid h-full max-w-lg grid-cols-2 gap-2 px-4">
          {PETUGAS_NAV_ITEMS.map((tab) => {
            const Icon = tab.icon;
            const active = isPetugasNavActive(pathname, tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "my-auto flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors",
                  active
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-white" : "text-slate-500"
                  )}
                  strokeWidth={1.75}
                />
                <span>{tab.mobileLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
