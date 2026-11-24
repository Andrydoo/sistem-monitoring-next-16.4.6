"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PeranPengguna } from "@prisma/client";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ClipboardList,
  Eye,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Upload,
  Users,
  Zap,
} from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface CorporateShellUser {
  id: number;
  username: string;
  nama: string;
  peran: PeranPengguna;
  kodeUnit: string | null;
}

export interface CorporateShellProps {
  user: CorporateShellUser;
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard Kinerja",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Data Piutang & Penugasan",
    href: "/admin/piutang",
    icon: FileSpreadsheet,
  },
  {
    label: "Impor Excel",
    href: "/admin/impor",
    icon: Upload,
  },
  {
    label: "Antrean Koreksi Anomali",
    href: "/admin/anomali",
    icon: AlertTriangle,
  },
  {
    label: "Manajemen Pengguna",
    href: "/admin/pengguna",
    icon: Users,
  },
];

const PIMPINAN_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard Eksekutif",
    href: "/pimpinan",
    icon: BarChart3,
  },
  {
    label: "Monitoring Piutang",
    href: "/pimpinan/piutang",
    icon: ClipboardList,
  },
];

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/admin" || href === "/pimpinan") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({
  user,
  pathname,
  onNavigate,
}: {
  user: CorporateShellUser;
  pathname: string;
  onNavigate?: () => void;
}) {
  const navItems =
    user.peran === "ADMIN" ? ADMIN_NAV_ITEMS : PIMPINAN_NAV_ITEMS;
  const isPimpinan = user.peran === "PIMPINAN";

  return (
    <div className="flex h-full flex-col justify-between bg-slate-900 text-slate-200">
      <div>
        {/* Brand Header */}
        <div className="flex h-14 items-center gap-3 border-b border-slate-800 px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-sky-400">
            <Zap className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold tracking-wider text-sky-400 uppercase">
              PT PLN (Persero)
            </p>
            <p className="truncate text-xs font-medium text-slate-100">
              ULP Kraksaan •{" "}
              <span className="font-mono tabular-nums">
                {user.kodeUnit ?? "51304"}
              </span>
            </p>
          </div>
        </div>

        {/* Penanda Peran / Read-Only */}
        <div className="border-b border-slate-800 px-4 py-3">
          <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Workspace Operasional
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-100">
              <Shield className="h-3.5 w-3.5 text-sky-400" strokeWidth={1.75} />
              <span>
                {user.peran === "ADMIN"
                  ? "Administrator Unit"
                  : "Pimpinan Eksekutif"}
              </span>
            </span>
            {isPimpinan && (
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                <Eye className="h-3 w-3" strokeWidth={1.75} />
                <span>Akses Read-Only</span>
              </span>
            )}
          </div>
        </div>

        {/* Navigasi Menu */}
        <nav className="space-y-1 p-3" aria-label="Navigasi Utama">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
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
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Identitas Sidebar */}
      <div className="border-t border-slate-800 p-4">
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <p className="truncate text-xs font-semibold text-slate-100">
            {user.nama}
          </p>
          <p className="mt-0.5 truncate font-mono text-xs text-slate-400 tabular-nums">
            @{user.username} • Unit {user.kodeUnit ?? "51304"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CorporateShell({ user, children }: CorporateShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar Desktop Tetap */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-slate-900 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col">
        <SidebarContent user={user} pathname={pathname} />
      </aside>

      {/* Kontainer Utama */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-3">
            {/* Drawer Trigger untuk Layar Kecil */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Buka menu navigasi"
                  className="rounded-md border-slate-200 text-slate-700 lg:hidden"
                >
                  <Menu className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-64 border-r border-slate-800 bg-slate-900 p-0 text-slate-100"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu Navigasi Sistem Monitoring</SheetTitle>
                  <SheetDescription>
                    Navigasi modul PT PLN (Persero) ULP Kraksaan
                  </SheetDescription>
                </SheetHeader>
                <SidebarContent
                  user={user}
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2">
              <Building2
                className="hidden h-4 w-4 text-sky-600 sm:inline-block"
                strokeWidth={1.75}
              />
              <span className="text-sm font-semibold text-slate-900">
                ULP Kraksaan — Unit{" "}
                <span className="font-mono tabular-nums">
                  {user.kodeUnit ?? "51304"}
                </span>
              </span>
              {user.peran === "PIMPINAN" && (
                <span className="hidden items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 md:inline-flex">
                  <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Akses Read-Only</span>
                </span>
              )}
            </div>
          </div>

          {/* Info Pengguna & Tombol Keluar */}
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-semibold text-slate-900">
                {user.nama}
              </p>
              <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                @{user.username}
              </p>
            </div>

            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold",
                user.peran === "ADMIN"
                  ? "border-sky-200 bg-sky-50 text-sky-700"
                  : "border-slate-300 bg-slate-100 text-slate-800"
              )}
            >
              {user.peran}
            </span>

            <form action={logoutAction}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-9 rounded-md border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="h-4 w-4 text-slate-600" strokeWidth={1.75} />
                <span>Keluar</span>
              </Button>
            </form>
          </div>
        </header>

        {/* Area Konten Utama */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
