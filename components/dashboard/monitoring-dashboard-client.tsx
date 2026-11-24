"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FileSpreadsheet,
  Smartphone,
  TrendingDown,
  Upload,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonitoringDashboardData } from "@/lib/dashboard-queries";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ExportPiutangButton } from "@/components/shared/export-piutang-button";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface MonitoringDashboardClientProps {
  data: MonitoringDashboardData;
  periods: string[];
  selectedPeriode: string;
  mode: "ADMIN" | "PIMPINAN";
  basePath: "/admin" | "/pimpinan";
}

function formatCompactRupiah(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) {
    const val = (abs / 1_000_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    });
    return `${sign}Rp ${val} M`;
  }
  if (abs >= 1_000_000) {
    const val = (abs / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    });
    return `${sign}Rp ${val} Jt`;
  }
  if (abs >= 1_000) {
    const val = (abs / 1_000).toLocaleString("id-ID", {
      maximumFractionDigits: 0,
    });
    return `${sign}Rp ${val} Rb`;
  }
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}

function shortenOfficerName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 16) {
    return trimmed;
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1][0]}.`;
  }
  return `${trimmed.slice(0, 14)}...`;
}

export function MonitoringDashboardClient({
  data,
  periods,
  selectedPeriode,
  mode,
  basePath,
}: MonitoringDashboardClientProps) {
  const router = useRouter();
  const {
    officialSummary,
    fieldSummary,
    petugasComparison,
    workloadPerPetugas,
    statusDistribution,
    kinerjaComparisonChart,
  } = data;

  const handlePeriodeChange = (nextPeriode: string) => {
    router.push(`${basePath}?periode=${encodeURIComponent(nextPeriode)}`);
  };

  // Rasio penurunan Saldo Akhir Bulan terhadap Saldo Akhir Periode
  const hasSaldoPeriode = officialSummary.totalSaldoAkhirPeriode > 0;
  const selisihSaldo =
    officialSummary.totalSaldoAkhirPeriode -
    officialSummary.totalSaldoAkhirBulan;
  const rasioSaldoBulanPct = hasSaldoPeriode
    ? (officialSummary.totalSaldoAkhirBulan /
        officialSummary.totalSaldoAkhirPeriode) *
      100
    : 0;
  const penurunanSaldoPct = hasSaldoPeriode
    ? (selisihSaldo / officialSummary.totalSaldoAkhirPeriode) * 100
    : 0;

  const workloadChartData = React.useMemo(
    () =>
      workloadPerPetugas.map((row) => ({
        ...row,
        labelPendek: shortenOfficerName(row.namaPetugas),
      })),
    [workloadPerPetugas]
  );

  const kinerjaChartData = React.useMemo(
    () =>
      kinerjaComparisonChart.map((row) => ({
        ...row,
        labelPendek: shortenOfficerName(row.namaPetugas),
      })),
    [kinerjaComparisonChart]
  );

  // Total kolom beban tugas & klaim lapangan pada tabel 7 indikator
  const tableFieldTotals = React.useMemo(() => {
    return petugasComparison.reduce(
      (acc, row) => ({
        totalTugas: acc.totalTugas + row.totalTugas,
        overdueCount: acc.overdueCount + row.overdueCount,
        klaimLapanganCount: acc.klaimLapanganCount + row.klaimLapanganCount,
        klaimLapanganNominal:
          acc.klaimLapanganNominal + row.klaimLapanganNominal,
      }),
      {
        totalTugas: 0,
        overdueCount: 0,
        klaimLapanganCount: 0,
        klaimLapanganNominal: 0,
      }
    );
  }, [petugasComparison]);

  const isPimpinan = mode === "PIMPINAN";

  return (
    <div className="space-y-6">
      {/* 1. Bar Filter Periode & Identitas Mode */}
      <section className="flex flex-col justify-between gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Calendar className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
            <span>Periode Monitoring:</span>
          </div>

          <Select value={selectedPeriode} onValueChange={handlePeriodeChange}>
            <SelectTrigger
              aria-label="Pilih Periode Monitoring"
              className="h-9 w-40 rounded-md border-slate-300 bg-white font-mono text-xs font-semibold text-slate-900 tabular-nums"
            >
              <SelectValue placeholder="Pilih Periode" />
            </SelectTrigger>
            <SelectContent className="rounded-md border-slate-200 bg-white">
              {periods.map((periode) => (
                <SelectItem
                  key={periode}
                  value={periode}
                  className="font-mono text-xs tabular-nums"
                >
                  {periode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-slate-500 tabular-nums">
            {fieldSummary.totalPiutangCount.toLocaleString("id-ID")} rekaman
            piutang • {officialSummary.petugasTercatatCount} laporan kinerja
            petugas
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isPimpinan ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                <Eye className="h-3.5 w-3.5 text-slate-600" strokeWidth={1.75} />
                <span>Mode Monitoring Eksekutif (Read-Only)</span>
              </span>
              <Link
                href={`/pimpinan/piutang?periode=${encodeURIComponent(selectedPeriode)}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50"
              >
                <ClipboardList
                  className="h-3.5 w-3.5 text-sky-600"
                  strokeWidth={1.75}
                />
                <span>Daftar Detail Piutang</span>
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Link>
              <ExportPiutangButton periode={selectedPeriode} />
            </>
          ) : (
            <>
              <Link
                href="/admin/impor"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50"
              >
                <Upload className="h-3.5 w-3.5 text-sky-600" strokeWidth={1.75} />
                <span>Impor Excel</span>
              </Link>
              <Link
                href="/admin/anomali"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50"
              >
                <AlertTriangle
                  className={cn(
                    "h-3.5 w-3.5",
                    fieldSummary.unassignedCount > 0
                      ? "text-red-600"
                      : "text-slate-500"
                  )}
                  strokeWidth={1.75}
                />
                <span>Antrean Anomali</span>
                {fieldSummary.unassignedCount > 0 && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-red-700 tabular-nums">
                    {fieldSummary.unassignedCount}
                  </span>
                )}
              </Link>
              <Link
                href={`/admin/piutang?periode=${encodeURIComponent(selectedPeriode)}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-sky-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Data Piutang</span>
              </Link>
              <ExportPiutangButton periode={selectedPeriode} />
            </>
          )}
        </div>
      </section>

      {/* 2. Blok KPI Utama — Pemisahan Tegas Saldo Resmi Buku vs Progres Lapangan */}
      <div className="space-y-4">
        {/* Baris 1: Saldo Resmi & Realisasi Buku (Sumber: KinerjaPetugas) */}
        <section className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpenCheck
                className="h-4 w-4 text-sky-600"
                strokeWidth={1.75}
              />
              <h2 className="text-xs font-semibold tracking-wider text-slate-700 uppercase">
                Baris 1 — Saldo Resmi & Realisasi Buku (Sumber: Impor Excel
                Admin)
              </h2>
            </div>
            <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-[11px] font-medium text-sky-800 tabular-nums">
              Periode Buku {selectedPeriode}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  Saldo Akhir Periode (Resmi)
                </span>
                <Wallet className="h-4 w-4 text-slate-700" strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-lg font-semibold text-slate-900 tabular-nums">
                {formatRupiah(officialSummary.totalSaldoAkhirPeriode)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Data Resmi Buku • Basis Impor Kinerja
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  Saldo Akhir Bulan (Resmi)
                </span>
                <TrendingDown
                  className="h-4 w-4 text-sky-600"
                  strokeWidth={1.75}
                />
              </div>
              <p className="mt-2 text-lg font-semibold text-slate-900 tabular-nums">
                {formatRupiah(officialSummary.totalSaldoAkhirBulan)}
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                {hasSaldoPeriode ? (
                  <>
                    Penurunan{" "}
                    <span className="font-semibold text-emerald-700">
                      {penurunanSaldoPct.toLocaleString("id-ID", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                      %
                    </span>{" "}
                    (Rasio{" "}
                    {rasioSaldoBulanPct.toLocaleString("id-ID", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    %)
                  </>
                ) : (
                  "Belum ada data buku pada periode ini"
                )}
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  Pelunasan PLN Mobile
                </span>
                <Smartphone
                  className="h-4 w-4 text-emerald-600"
                  strokeWidth={1.75}
                />
              </div>
              <p className="mt-2 text-lg font-semibold text-emerald-700 tabular-nums">
                {formatRupiah(officialSummary.totalRpPelunasanPlnMobile)}
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                {officialSummary.totalKaliTransaksiPlnMobile.toLocaleString(
                  "id-ID"
                )}{" "}
                kali transaksi tercatat
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  Pelunasan Saldo PRR & Perolehan
                </span>
                <BarChart3
                  className="h-4 w-4 text-sky-600"
                  strokeWidth={1.75}
                />
              </div>
              <p className="mt-2 text-lg font-semibold text-slate-900 tabular-nums">
                {formatRupiah(officialSummary.totalPelunasanSaldoPrr)}
              </p>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                Migrasi:{" "}
                <strong className="font-semibold text-slate-700">
                  {officialSummary.totalMigrasiPrabayar.toLocaleString("id-ID")}
                </strong>{" "}
                | Promo:{" "}
                <strong className="font-semibold text-slate-700">
                  {officialSummary.totalPromoTematik.toLocaleString("id-ID")}
                </strong>
              </p>
            </div>
          </div>
        </section>

        {/* Baris 2: Progres Operasional Lapangan (Terpisah dari Saldo Buku) */}
        <section className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardList
                className="h-4 w-4 text-amber-600"
                strokeWidth={1.75}
              />
              <h2 className="text-xs font-semibold tracking-wider text-slate-700 uppercase">
                Baris 2 — Progres Operasional Lapangan (Terpisah dari Saldo
                Buku)
              </h2>
            </div>
            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              Non-Buku • Pemantauan Aktivitas Lapangan
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Klaim Lapangan — Aksen Amber */}
            <div className="rounded-md border border-amber-200 border-l-4 border-l-amber-500 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-wide text-amber-800 uppercase">
                  Progres Klaim Pelunasan Lapangan
                </span>
                <Clock
                  className="h-4 w-4 shrink-0 text-amber-600"
                  strokeWidth={1.75}
                />
              </div>
              <p className="mt-2 text-lg font-semibold text-amber-900 tabular-nums">
                {formatRupiah(fieldSummary.klaimLapanganNominal)}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-700 tabular-nums">
                {fieldSummary.klaimLapanganCount.toLocaleString("id-ID")}{" "}
                pelanggan
              </p>
              <p className="mt-1.5 border-t border-amber-100 pt-1.5 text-[11px] leading-snug text-amber-800">
                Belum memotong saldo resmi hingga verifikasi impor Excel
                berikutnya
              </p>
            </div>

            {/* Lunas Resmi Terverifikasi */}
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  Lunas Resmi Terverifikasi
                </span>
                <CheckCircle2
                  className="h-4 w-4 text-emerald-600"
                  strokeWidth={1.75}
                />
              </div>
              <p className="mt-2 text-lg font-semibold text-emerald-700 tabular-nums">
                {fieldSummary.lunasResmiCount.toLocaleString("id-ID")} Pelanggan
              </p>
              <p className="mt-1 text-xs font-medium text-slate-700 tabular-nums">
                {formatRupiah(fieldSummary.lunasResmiNominal)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Terverifikasi melalui rekonsiliasi TUL III-09
              </p>
            </div>

            {/* Prioritas Overdue & Janji Bayar */}
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  Prioritas Overdue & Janji Bayar
                </span>
                <AlertTriangle
                  className={cn(
                    "h-4 w-4",
                    fieldSummary.overdueCount > 0
                      ? "text-red-600"
                      : "text-amber-600"
                  )}
                  strokeWidth={1.75}
                />
              </div>
              <p className="mt-2 text-lg font-semibold text-slate-900 tabular-nums">
                <span
                  className={
                    fieldSummary.overdueCount > 0
                      ? "text-red-700"
                      : "text-slate-900"
                  }
                >
                  {fieldSummary.overdueCount.toLocaleString("id-ID")} Overdue
                </span>{" "}
                <span className="font-normal text-slate-300">|</span>{" "}
                <span className="text-amber-700">
                  {fieldSummary.masaJanjiBayarCount.toLocaleString("id-ID")}{" "}
                  Janji
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-600 tabular-nums">
                Nominal Overdue:{" "}
                <strong className="font-semibold text-slate-800">
                  {formatRupiah(fieldSummary.overdueNominal)}
                </strong>
              </p>
              <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                Masa Janji Bayar:{" "}
                {formatRupiah(fieldSummary.masaJanjiBayarNominal)}
              </p>
            </div>

            {/* Anomali Unassigned */}
            <div
              className={cn(
                "rounded-md border bg-white p-4 shadow-xs",
                fieldSummary.unassignedCount > 0
                  ? "border-red-200"
                  : "border-slate-200"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  Anomali Unassigned
                </span>
                <AlertTriangle
                  className={cn(
                    "h-4 w-4",
                    fieldSummary.unassignedCount > 0
                      ? "text-red-600"
                      : "text-slate-400"
                  )}
                  strokeWidth={1.75}
                />
              </div>
              <p
                className={cn(
                  "mt-2 text-lg font-semibold tabular-nums",
                  fieldSummary.unassignedCount > 0
                    ? "text-red-700"
                    : "text-slate-900"
                )}
              >
                {fieldSummary.unassignedCount.toLocaleString("id-ID")} Baris
              </p>
              <p className="mt-1 text-xs text-slate-600 tabular-nums">
                Nilai: {formatRupiah(fieldSummary.unassignedNominal)}
              </p>
              {mode === "ADMIN" && fieldSummary.unassignedCount > 0 ? (
                <Link
                  href="/admin/anomali"
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 underline-offset-2 hover:underline"
                >
                  <span>Buka Antrean Koreksi Anomali</span>
                  <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
                </Link>
              ) : (
                <p className="mt-1 text-[11px] text-slate-500">
                  {fieldSummary.unassignedCount > 0
                    ? "Menunggu pemetaan petugas oleh Administrator"
                    : "Seluruh piutang telah terpetakan ke petugas"}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* 3. Bagian Analitik Visual (Recharts — 2 Grafik Sejajar) */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Grafik 1 — Stacked Bar Chart Beban Kerja & Status per Petugas */}
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Distribusi Beban Kerja & Status per Petugas
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Komposisi jumlah pelanggan berdasarkan status rekonsiliasi pada
                periode{" "}
                <span className="font-mono tabular-nums">
                  {selectedPeriode}
                </span>
              </p>
            </div>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              Stacked Bar
            </span>
          </div>

          {workloadChartData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500">
              Belum ada data petugas aktif untuk periode ini.
            </div>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={workloadChartData}
                  margin={{ top: 8, right: 12, left: -12, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#E2E8F0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="labelPendek"
                    tick={{ fontSize: 11, fill: "#475569" }}
                    axisLine={{ stroke: "#CBD5E1" }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) =>
                      `${Number(value ?? 0).toLocaleString("id-ID")} plg`
                    }
                    labelFormatter={(_label, payload) => {
                      const first = payload?.[0]?.payload as
                        | { namaPetugas?: string; username?: string }
                        | undefined;
                      if (first?.namaPetugas) {
                        return `${first.namaPetugas} (@${first.username ?? ""})`;
                      }
                      return String(_label ?? "");
                    }}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#CBD5E1",
                      borderRadius: "6px",
                      fontSize: "12px",
                      boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  />
                  <Bar
                    dataKey="overdue"
                    name="Overdue"
                    stackId="beban"
                    fill="#DC2626"
                  />
                  <Bar
                    dataKey="masaJanjiBayar"
                    name="Masa Janji Bayar"
                    stackId="beban"
                    fill="#D97706"
                  />
                  <Bar
                    dataKey="belumTertagih"
                    name="Belum Tertagih"
                    stackId="beban"
                    fill="#64748B"
                  />
                  <Bar
                    dataKey="ditindaklanjuti"
                    name="Ditindaklanjuti"
                    stackId="beban"
                    fill="#0284C7"
                  />
                  <Bar
                    dataKey="klaimLapangan"
                    name="Klaim Lapangan"
                    stackId="beban"
                    fill="#F59E0B"
                  />
                  <Bar
                    dataKey="lunasResmi"
                    name="Lunas Resmi"
                    stackId="beban"
                    fill="#059669"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Grafik 2 — Grouped Bar Chart Saldo Resmi & Pelunasan PLN Mobile */}
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Perbandingan Saldo Resmi & Pelunasan PLN Mobile per Petugas
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Realisasi finansial resmi buku antarpetugas pada periode{" "}
                <span className="font-mono tabular-nums">
                  {selectedPeriode}
                </span>
              </p>
            </div>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              Grouped Bar
            </span>
          </div>

          {kinerjaChartData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-500">
              Belum ada data kinerja petugas untuk periode ini.
            </div>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={kinerjaChartData}
                  margin={{ top: 8, right: 12, left: 8, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#E2E8F0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="labelPendek"
                    tick={{ fontSize: 11, fill: "#475569" }}
                    axisLine={{ stroke: "#CBD5E1" }}
                    tickLine={false}
                  />
                  <YAxis
                    width={72}
                    tickFormatter={(val) => formatCompactRupiah(Number(val ?? 0))}
                    tick={{ fontSize: 11, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => formatRupiah(Number(value ?? 0))}
                    labelFormatter={(_label, payload) => {
                      const first = payload?.[0]?.payload as
                        | { namaPetugas?: string; username?: string }
                        | undefined;
                      if (first?.namaPetugas) {
                        return `${first.namaPetugas} (@${first.username ?? ""})`;
                      }
                      return String(_label ?? "");
                    }}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#CBD5E1",
                      borderRadius: "6px",
                      fontSize: "12px",
                      boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  />
                  <Bar
                    dataKey="saldoAkhirPeriode"
                    name="Saldo Akhir Periode"
                    fill="#0F172A"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="saldoAkhirBulan"
                    name="Saldo Akhir Bulan"
                    fill="#0284C7"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="rpPelunasanPlnMobile"
                    name="Rp Pelunasan PLN Mobile"
                    fill="#059669"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Ringkasan Distribusi Status Rekonsiliasi Periode Aktif */}
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold tracking-wider text-slate-700 uppercase">
              Distribusi Status Rekonsiliasi Piutang (Periode {selectedPeriode})
            </h3>
            <p className="text-[11px] text-slate-500">
              Total eksposur lapangan:{" "}
              <span className="font-semibold text-slate-800 tabular-nums">
                {fieldSummary.totalPiutangCount.toLocaleString("id-ID")}{" "}
                pelanggan
              </span>{" "}
              ({formatRupiah(fieldSummary.totalPiutangNominal)})
            </p>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          {statusDistribution.map((item) => (
            <div
              key={item.status}
              className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5"
            >
              <StatusBadge status={item.status} className="text-[11px]" />
              <p className="mt-2 text-sm font-semibold text-slate-900 tabular-nums">
                {item.count.toLocaleString("id-ID")}{" "}
                <span className="text-[11px] font-normal text-slate-500">
                  plg
                </span>
              </p>
              <p className="mt-0.5 truncate text-[11px] font-medium text-slate-600 tabular-nums">
                {formatRupiah(item.nominalRp)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Tabel Perbandingan 7 Indikator Kinerja Antarpetugas */}
      <section className="rounded-md border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Tabel Perbandingan 7 Indikator Kinerja Antarpetugas
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Komparasi capaian resmi buku (kolom 3–9) berdampingan dengan
              kolom terpisah Progres Klaim Lapangan non-buku (kolom 10) periode{" "}
              <span className="font-mono font-medium text-slate-700 tabular-nums">
                {selectedPeriode}
              </span>
              .
            </p>
          </div>

          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 tabular-nums">
            {petugasComparison.length} Petugas Aktif
          </span>
        </div>

        <div className="max-h-[540px] overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[1160px] border-collapse text-left text-xs">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
                <th className="px-4 py-3">Petugas</th>
                <th className="px-3 py-3 text-right">Beban Tugas</th>
                <th className="px-3 py-3 text-right">
                  Saldo Akhir Periode (Rp)
                </th>
                <th className="px-3 py-3 text-right">Saldo Akhir Bulan (Rp)</th>
                <th className="px-3 py-3 text-right">
                  Pelunasan PLN Mobile (Rp)
                </th>
                <th className="px-3 py-3 text-right">
                  Transaksi PLN Mobile (Kali)
                </th>
                <th className="px-3 py-3 text-right">Migrasi Prabayar</th>
                <th className="px-3 py-3 text-right">Promo Tematik</th>
                <th className="px-3 py-3 text-right">
                  Pelunasan Saldo PRR (Rp)
                </th>
                <th className="border-l border-amber-200 bg-amber-50/70 px-3 py-3 text-right text-amber-900">
                  <div>Klaim Lapangan (Rp)</div>
                  <div className="text-[10px] font-medium tracking-normal text-amber-700 normal-case">
                    Non-Buku / Menunggu Excel
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {petugasComparison.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-xs text-slate-500"
                  >
                    Belum ada petugas lapangan aktif yang terdaftar pada sistem.
                  </td>
                </tr>
              ) : (
                petugasComparison.map((row) => (
                  <tr key={row.petugasId} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{row.nama}</p>
                      <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                        @{row.username}
                        {row.kodeUnit ? ` • Unit ${row.kodeUnit}` : ""}
                      </p>
                    </td>

                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                      <p className="font-semibold text-slate-900">
                        {row.totalTugas.toLocaleString("id-ID")} plg
                      </p>
                      <p
                        className={cn(
                          "text-[11px]",
                          row.overdueCount > 0
                            ? "font-semibold text-red-700"
                            : "text-slate-500"
                        )}
                      >
                        {row.overdueCount.toLocaleString("id-ID")} overdue
                      </p>
                    </td>

                    <td className="px-3 py-3 text-right font-medium whitespace-nowrap text-slate-900 tabular-nums">
                      {formatRupiah(row.saldoAkhirPeriode)}
                    </td>

                    <td className="px-3 py-3 text-right font-semibold whitespace-nowrap text-slate-900 tabular-nums">
                      {formatRupiah(row.saldoAkhirBulan)}
                    </td>

                    <td className="px-3 py-3 text-right font-semibold whitespace-nowrap text-emerald-700 tabular-nums">
                      {formatRupiah(row.rpPelunasanPlnMobile)}
                    </td>

                    <td className="px-3 py-3 text-right font-medium whitespace-nowrap text-slate-800 tabular-nums">
                      {row.kaliTransaksiPlnMobile.toLocaleString("id-ID")}
                    </td>

                    <td className="px-3 py-3 text-right font-medium whitespace-nowrap text-slate-800 tabular-nums">
                      {row.perolehanMigrasiPrabayar.toLocaleString("id-ID")}
                    </td>

                    <td className="px-3 py-3 text-right font-medium whitespace-nowrap text-slate-800 tabular-nums">
                      {row.perolehanPromoTematik.toLocaleString("id-ID")}
                    </td>

                    <td className="px-3 py-3 text-right font-medium whitespace-nowrap text-slate-900 tabular-nums">
                      {formatRupiah(row.pelunasanSaldoPrr)}
                    </td>

                    <td className="border-l border-amber-200/80 bg-amber-50/40 px-3 py-3 text-right whitespace-nowrap tabular-nums">
                      <p className="font-semibold text-amber-900">
                        {formatRupiah(row.klaimLapanganNominal)}
                      </p>
                      <p className="text-[11px] text-amber-700">
                        {row.klaimLapanganCount.toLocaleString("id-ID")} plg
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100/90 font-semibold text-slate-900">
                <td className="px-4 py-3.5 text-xs tracking-wide uppercase">
                  TOTAL ULP KRAKSAAN
                </td>
                <td className="px-3 py-3.5 text-right whitespace-nowrap tabular-nums">
                  <div>
                    {tableFieldTotals.totalTugas.toLocaleString("id-ID")} plg
                  </div>
                  <div
                    className={cn(
                      "text-[11px]",
                      tableFieldTotals.overdueCount > 0
                        ? "text-red-700"
                        : "text-slate-600"
                    )}
                  >
                    {tableFieldTotals.overdueCount.toLocaleString("id-ID")}{" "}
                    overdue
                  </div>
                </td>
                <td className="px-3 py-3.5 text-right whitespace-nowrap tabular-nums">
                  {formatRupiah(officialSummary.totalSaldoAkhirPeriode)}
                </td>
                <td className="px-3 py-3.5 text-right whitespace-nowrap tabular-nums">
                  {formatRupiah(officialSummary.totalSaldoAkhirBulan)}
                </td>
                <td className="px-3 py-3.5 text-right whitespace-nowrap text-emerald-800 tabular-nums">
                  {formatRupiah(officialSummary.totalRpPelunasanPlnMobile)}
                </td>
                <td className="px-3 py-3.5 text-right whitespace-nowrap tabular-nums">
                  {officialSummary.totalKaliTransaksiPlnMobile.toLocaleString(
                    "id-ID"
                  )}
                </td>
                <td className="px-3 py-3.5 text-right whitespace-nowrap tabular-nums">
                  {officialSummary.totalMigrasiPrabayar.toLocaleString("id-ID")}
                </td>
                <td className="px-3 py-3.5 text-right whitespace-nowrap tabular-nums">
                  {officialSummary.totalPromoTematik.toLocaleString("id-ID")}
                </td>
                <td className="px-3 py-3.5 text-right whitespace-nowrap tabular-nums">
                  {formatRupiah(officialSummary.totalPelunasanSaldoPrr)}
                </td>
                <td className="border-l border-amber-200 bg-amber-50/70 px-3 py-3.5 text-right whitespace-nowrap text-amber-950 tabular-nums">
                  <div>{formatRupiah(fieldSummary.klaimLapanganNominal)}</div>
                  <div className="text-[11px] font-medium text-amber-800">
                    {fieldSummary.klaimLapanganCount.toLocaleString("id-ID")}{" "}
                    plg
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
