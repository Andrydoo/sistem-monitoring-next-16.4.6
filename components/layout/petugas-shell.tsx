"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PeranPengguna } from "@prisma/client";
import { ClipboardCheck, Clock, LogOut, Zap } from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";

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

const PETUGAS_TABS = [
  {
    label: "Tugas Saya",
    href: "/petugas",
    icon: ClipboardCheck,
  },
  {
    label: "Janji Bayar",
    href: "/petugas/pengingat",
    icon: Clock,
  },
];

export function PetugasShell({ user, children }: PetugasShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-900">
      {/* Top Bar Gelap Kontras Tinggi */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 text-white">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-sky-400">
            <Zap className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">
              {user.nama}
            </p>
            <p className="truncate font-mono text-[11px] text-slate-300 tabular-nums">
              @{user.username} • Unit {user.kodeUnit ?? "51304"}
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

      {/* Kontainer Konten Mobile-First */}
      <main className="mx-auto max-w-lg px-4 py-4">{children}</main>

      {/* Bottom Navigation Bar Tetap */}
      <nav
        aria-label="Navigasi Bawah Petugas"
        className="fixed inset-x-0 bottom-0 z-30 h-16 border-t border-slate-200 bg-white"
      >
        <div className="mx-auto grid h-full max-w-lg grid-cols-2 gap-2 px-4">
          {PETUGAS_TABS.map((tab) => {
            const Icon = tab.icon;
            const active =
              tab.href === "/petugas"
                ? pathname === "/petugas"
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

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
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
