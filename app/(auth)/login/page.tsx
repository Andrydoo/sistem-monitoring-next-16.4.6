import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2, ShieldCheck, Zap } from "lucide-react";
import { auth } from "@/auth";
import { getRoleHomePath } from "@/lib/auth-guard";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Autentikasi Pengguna | PT PLN (Persero) ULP Kraksaan",
  description:
    "Portal Autentikasi Sistem Monitoring Penagihan Piutang Pelanggan PT PLN (Persero) ULP Kraksaan (Kode Unit 51304)",
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.peran) {
    redirect(getRoleHomePath(session.user.peran));
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-md border border-slate-200 bg-white shadow-xs md:grid-cols-12">
        {/* Panel Samping Korporat PT PLN */}
        <section className="flex flex-col justify-between bg-slate-900 p-7 text-slate-100 md:col-span-5 md:p-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-sky-400">
                <Zap className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wider text-sky-400 uppercase">
                  PT PLN (Persero)
                </p>
                <p className="text-sm font-semibold text-white">
                  ULP Kraksaan — Unit{" "}
                  <span className="font-mono tabular-nums">51304</span>
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                <Building2
                  className="h-3.5 w-3.5 text-sky-400"
                  strokeWidth={1.75}
                />
                <span>PT PLN (Persero) — ULP Kraksaan (Kode Unit 51304)</span>
              </span>
              <h1 className="text-lg leading-snug font-semibold text-white">
                Sistem Monitoring Penagihan Piutang Pelanggan
              </h1>
              <p className="text-xs leading-relaxed text-slate-300">
                Platform pengendalian piutang terpadu untuk rekonsiliasi saldo
                TUL III-09, pemantauan janji bayar lapangan, dan pelaporan
                eksekutif berbasis bukti (evidence) terverifikasi.
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-3 border-t border-slate-800 pt-5 text-xs text-slate-400">
            <div className="flex items-start gap-2.5">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-sky-400"
                strokeWidth={1.75}
              />
              <p className="leading-relaxed">
                Seluruh aktivitas autentikasi dan perubahan status piutang
                dicatat secara otomatis ke dalam log audit internal.
              </p>
            </div>
            <p className="font-mono text-[11px] text-slate-500 tabular-nums">
              UID JAWA TIMUR • UP3 PASURUAN • ULP KRAKSAAN (51304)
            </p>
          </div>
        </section>

        {/* Panel Form Autentikasi */}
        <section className="flex flex-col justify-between p-7 md:col-span-7 md:p-8">
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Otorisasi Sesi Operasional
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                Masuk ke Akun Pengguna
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Gunakan kredensial resmi Admin, Pimpinan (Manajer ULP), atau
                Petugas Lapangan.
              </p>
            </div>

            <LoginForm />
          </div>

          <div className="mt-8 border-t border-slate-200 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Kebijakan Sesi: JWT 12 Jam Shift Kerja</span>
              <span className="font-mono tabular-nums">
                Kode Unit: 51304
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
