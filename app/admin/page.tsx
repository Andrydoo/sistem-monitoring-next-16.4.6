import { ShieldCheck } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { getMonitoringDashboardData } from "@/lib/dashboard-queries";
import { prisma } from "@/lib/prisma";
import { evaluateActiveReminders } from "@/lib/reminder-evaluator";
import { EvaluateRemindersButton } from "@/components/admin/evaluate-reminders-button";
import { MonitoringDashboardClient } from "@/components/dashboard/monitoring-dashboard-client";
import { ReminderPriorityBanner } from "@/components/shared/reminder-priority-banner";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const session = await requireRole(["ADMIN"]);

  try {
    await evaluateActiveReminders({ source: "PAGE_LOAD" });
  } catch (error) {
    console.error(
      "[AdminDashboardPage] Gagal mengevaluasi pengingat otomatis:",
      error
    );
  }

  const resolvedSearchParams = await searchParams;
  const requestedPeriode = resolvedSearchParams.periode?.trim();

  const [dashboardData, globalOverdueAggregate, globalMasaJanjiBayarCount] =
    await Promise.all([
      getMonitoringDashboardData(requestedPeriode),
      prisma.piutang.aggregate({
        where: { statusRekonsiliasi: "OVERDUE" },
        _count: { id: true },
        _sum: { nilaiTagihan: true },
      }),
      prisma.piutang.count({
        where: { statusRekonsiliasi: "MASA_JANJI_BAYAR" },
      }),
    ]);

  const overdueCount = globalOverdueAggregate._count.id;
  const overdueNominal =
    globalOverdueAggregate._sum.nilaiTagihan ?? BigInt(0);

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col justify-between gap-3 rounded-md border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Pusat Kendali Operasional • Administrator
          </p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">
            Dashboard Kinerja & Rekonsiliasi Piutang ULP Kraksaan
          </h1>
          <p className="mt-0.5 text-xs text-slate-600">
            Sesi Aktif:{" "}
            <span className="font-semibold text-slate-800">
              {session.user.nama}
            </span>{" "}
            (
            <span className="font-mono tabular-nums">
              @{session.user.username}
            </span>
            ) • Kode Unit{" "}
            <span className="font-mono tabular-nums">
              {session.user.kodeUnit ?? "51304"}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <EvaluateRemindersButton />
          <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
            <ShieldCheck className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
            <span>Koneksi MySQL Terverifikasi</span>
          </div>
        </div>
      </div>

      {/* Banner Peringatan Prioritas Overdue & Masa Janji Bayar */}
      <ReminderPriorityBanner
        variant="admin"
        overdueCount={overdueCount}
        masaJanjiBayarCount={globalMasaJanjiBayarCount}
        overdueNominal={overdueNominal}
        ctaHref={
          overdueCount > 0
            ? "/admin/piutang?status=OVERDUE"
            : "/admin/piutang?status=MASA_JANJI_BAYAR"
        }
        ctaLabel={
          overdueCount > 0 ? "Tinjau Piutang Overdue" : "Tinjau Masa Janji Bayar"
        }
      />

      {/* Dashboard Monitoring 7 Indikator Kinerja & Analitik Recharts */}
      <MonitoringDashboardClient
        data={dashboardData}
        periods={dashboardData.availablePeriods}
        selectedPeriode={dashboardData.activePeriode}
        mode="ADMIN"
        basePath="/admin"
      />
    </div>
  );
}
