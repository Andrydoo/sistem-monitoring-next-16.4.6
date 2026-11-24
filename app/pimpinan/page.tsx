import { Eye } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { getMonitoringDashboardData } from "@/lib/dashboard-queries";
import { MonitoringDashboardClient } from "@/components/dashboard/monitoring-dashboard-client";

export default async function PimpinanDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const session = await requireRole(["PIMPINAN"]);
  const resolvedSearchParams = await searchParams;
  const requestedPeriode = resolvedSearchParams.periode?.trim();

  const dashboardData = await getMonitoringDashboardData(requestedPeriode);

  return (
    <div className="space-y-6">
      {/* Header Eksekutif Read-Only */}
      <div className="flex flex-col justify-between gap-3 rounded-md border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Laporan Eksekutif Manajer ULP • Kode Unit{" "}
            <span className="font-mono tabular-nums">
              {session.user.kodeUnit ?? "51304"}
            </span>
          </p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">
            Dashboard Eksekutif Pengendalian Piutang ULP Kraksaan
          </h1>
          <p className="mt-0.5 text-xs text-slate-600">
            Pejabat Pemantau:{" "}
            <span className="font-semibold text-slate-800">
              {session.user.nama}
            </span>{" "}
            (
            <span className="font-mono tabular-nums">
              @{session.user.username}
            </span>
            )
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">
          <Eye className="h-4 w-4 text-slate-600" strokeWidth={1.75} />
          <span>Mode Monitoring Eksekutif (Read-Only)</span>
        </div>
      </div>

      {/* Dashboard Monitoring Eksekutif Read-Only (Nol Tombol Mutasi) */}
      <MonitoringDashboardClient
        data={dashboardData}
        periods={dashboardData.availablePeriods}
        selectedPeriode={dashboardData.activePeriode}
        mode="PIMPINAN"
        basePath="/pimpinan"
      />
    </div>
  );
}
