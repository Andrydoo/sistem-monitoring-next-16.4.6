"use client";

import * as React from "react";
import Link from "next/link";
import type {
  BentukPenyelesaian,
  RentangJanjiBayar,
  StatusRekonsiliasi,
} from "@prisma/client";
import {
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  Clock,
  History,
  MapPin,
  Search,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { formatDaya, formatRupiah, formatTanggalWib } from "@/lib/format";
import { StatusBadge } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PetugasTugasItem {
  id: number;
  idPelanggan: string;
  periode: string;
  jumlahLembar: number;
  nilaiTagihan: string;
  statusRekonsiliasi: StatusRekonsiliasi;
  pelanggan: {
    idPelanggan: string;
    namaPelanggan: string;
    alamat: string;
    tarif: string;
    daya: number;
  };
  jumlahKunjungan: number;
  kunjunganTerakhir: {
    id: number;
    waktuInput: string;
    bentukPenyelesaian: BentukPenyelesaian;
    rentangJanjiBayar: RentangJanjiBayar | null;
  } | null;
}

export interface DaftarTugasClientProps {
  tasks: PetugasTugasItem[];
  periodeList: string[];
  petugasUsername: string;
}

type StatusChipFilter =
  | "ALL"
  | "PRIORITAS"
  | "BELUM_TERTAGIH"
  | "KLAIM_LAPANGAN"
  | "DITINDAKLANJUTI"
  | "LUNAS_RESMI";

const STATUS_CHIPS: ReadonlyArray<{
  key: StatusChipFilter;
  label: string;
}> = [
  { key: "ALL", label: "Semua" },
  { key: "PRIORITAS", label: "Prioritas" },
  { key: "BELUM_TERTAGIH", label: "Belum Tertagih" },
  { key: "KLAIM_LAPANGAN", label: "Klaim Lapangan" },
  { key: "DITINDAKLANJUTI", label: "Ditindaklanjuti" },
  { key: "LUNAS_RESMI", label: "Lunas Resmi" },
];

const PENYELESAIAN_LABEL: Record<BentukPenyelesaian, string> = {
  LUNAS_ONLINE: "Lunas Online",
  TITIP_LUNAS: "Titip Lunas",
  DIPUTUS: "Diputus",
  JANJI_BAYAR: "Janji Bayar",
};

function matchesStatusChip(
  status: StatusRekonsiliasi,
  chip: StatusChipFilter
): boolean {
  switch (chip) {
    case "ALL":
      return true;
    case "PRIORITAS":
      return (
        status === "OVERDUE" ||
        status === "MASA_JANJI_BAYAR" ||
        status === "BELUM_TERTAGIH"
      );
    case "BELUM_TERTAGIH":
      return status === "BELUM_TERTAGIH";
    case "KLAIM_LAPANGAN":
      return status === "KLAIM_LAPANGAN";
    case "DITINDAKLANJUTI":
      return status === "DITINDAKLANJUTI";
    case "LUNAS_RESMI":
      return status === "LUNAS_RESMI";
  }
}

export function DaftarTugasClient({
  tasks,
  periodeList,
  petugasUsername,
}: DaftarTugasClientProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedPeriode, setSelectedPeriode] = React.useState<string>("ALL");
  const [selectedChip, setSelectedChip] =
    React.useState<StatusChipFilter>("ALL");

  const tasksByPeriode = React.useMemo(() => {
    if (selectedPeriode === "ALL") return tasks;
    return tasks.filter((item) => item.periode === selectedPeriode);
  }, [tasks, selectedPeriode]);

  const metrics = React.useMemo(() => {
    let totalNilai = BigInt(0);
    let overdueCount = 0;
    let janjiBayarCount = 0;
    let belumTertagihCount = 0;
    let klaimLapanganCount = 0;

    for (const item of tasksByPeriode) {
      totalNilai += BigInt(item.nilaiTagihan);
      if (item.statusRekonsiliasi === "OVERDUE") overdueCount++;
      if (item.statusRekonsiliasi === "MASA_JANJI_BAYAR") janjiBayarCount++;
      if (item.statusRekonsiliasi === "BELUM_TERTAGIH") belumTertagihCount++;
      if (item.statusRekonsiliasi === "KLAIM_LAPANGAN") klaimLapanganCount++;
    }

    return {
      totalCount: tasksByPeriode.length,
      totalNilai,
      overdueCount,
      janjiBayarCount,
      belumTertagihCount,
      klaimLapanganCount,
    };
  }, [tasksByPeriode]);

  const chipCounts = React.useMemo(() => {
    const counts: Record<StatusChipFilter, number> = {
      ALL: tasksByPeriode.length,
      PRIORITAS: 0,
      BELUM_TERTAGIH: 0,
      KLAIM_LAPANGAN: 0,
      DITINDAKLANJUTI: 0,
      LUNAS_RESMI: 0,
    };

    for (const item of tasksByPeriode) {
      if (matchesStatusChip(item.statusRekonsiliasi, "PRIORITAS")) {
        counts.PRIORITAS++;
      }
      if (item.statusRekonsiliasi === "BELUM_TERTAGIH") {
        counts.BELUM_TERTAGIH++;
      } else if (item.statusRekonsiliasi === "KLAIM_LAPANGAN") {
        counts.KLAIM_LAPANGAN++;
      } else if (item.statusRekonsiliasi === "DITINDAKLANJUTI") {
        counts.DITINDAKLANJUTI++;
      } else if (item.statusRekonsiliasi === "LUNAS_RESMI") {
        counts.LUNAS_RESMI++;
      }
    }

    return counts;
  }, [tasksByPeriode]);

  const filteredTasks = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return tasksByPeriode.filter((item) => {
      if (!matchesStatusChip(item.statusRekonsiliasi, selectedChip)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        item.idPelanggan.toLowerCase().includes(normalizedQuery) ||
        item.pelanggan.namaPelanggan.toLowerCase().includes(normalizedQuery) ||
        item.pelanggan.alamat.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [tasksByPeriode, selectedChip, searchQuery]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedPeriode !== "ALL" ||
    selectedChip !== "ALL";

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedPeriode("ALL");
    setSelectedChip("ALL");
  };

  return (
    <div className="space-y-4">
      {/* Strip Ringkasan 4 Metrik Padat */}
      <section aria-label="Ringkasan Beban Tugas" className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <ClipboardCheck
              className="h-4 w-4 text-sky-600"
              strokeWidth={1.75}
            />
            <h1 className="text-sm font-semibold text-slate-900">
              Daftar Tugas Penagihan
            </h1>
          </div>
          <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
            @{petugasUsername}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-md border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                Total Tugas
              </span>
              <Wallet className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
              {metrics.totalCount.toLocaleString("id-ID")}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-slate-600 tabular-nums">
              {formatRupiah(metrics.totalNilai)}
            </p>
          </div>

          <div
            className={cn(
              "rounded-md border bg-white p-3.5 shadow-xs",
              metrics.overdueCount > 0 ? "border-red-300" : "border-slate-200"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                Overdue
              </span>
              <AlertTriangle
                className={cn(
                  "h-4 w-4",
                  metrics.overdueCount > 0 ? "text-red-600" : "text-slate-600"
                )}
                strokeWidth={1.75}
              />
            </div>
            <p
              className={cn(
                "mt-1 text-lg font-bold tabular-nums",
                metrics.overdueCount > 0 ? "text-red-700" : "text-slate-900"
              )}
            >
              {metrics.overdueCount.toLocaleString("id-ID")}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-600">
              Prioritas utama
            </p>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                Janji Bayar
              </span>
              <Clock className="h-4 w-4 text-amber-600" strokeWidth={1.75} />
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
              {metrics.janjiBayarCount.toLocaleString("id-ID")}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-600">
              Masa pantau aktif
            </p>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                Belum Tertagih
              </span>
              <ClipboardCheck
                className="h-4 w-4 text-slate-700"
                strokeWidth={1.75}
              />
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
              {metrics.belumTertagihCount.toLocaleString("id-ID")}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-600 tabular-nums">
              Klaim Lapangan: {metrics.klaimLapanganCount.toLocaleString("id-ID")}
            </p>
          </div>
        </div>
      </section>

      {/* Panel Filter Cepat Mobile-First */}
      <section
        aria-label="Filter Daftar Tugas"
        className="space-y-3 rounded-md border border-slate-200 bg-white p-3.5 shadow-xs"
      >
        <div className="space-y-2.5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-600"
              strokeWidth={1.75}
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari IDPEL 12 digit, nama, atau alamat..."
              aria-label="Cari pelanggan berdasarkan ID Pelanggan, nama, atau alamat"
              className="min-h-11 rounded-md border-slate-300 bg-white pr-11 pl-9 text-sm text-slate-900 placeholder:text-slate-600"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Hapus kata kunci pencarian"
                className="absolute top-1/2 right-0 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-600 hover:text-slate-900"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            )}
          </div>

          <div>
            <label
              htmlFor="filter-periode-petugas"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Periode Tagihan
            </label>
            <select
              id="filter-periode-petugas"
              value={selectedPeriode}
              onChange={(e) => setSelectedPeriode(e.target.value)}
              className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus-visible:border-sky-600 focus-visible:ring-2 focus-visible:ring-sky-600/20"
            >
              <option value="ALL">
                Semua Periode ({tasks.length.toLocaleString("id-ID")})
              </option>
              {periodeList.map((periode) => (
                <option key={periode} value={periode}>
                  Periode {periode}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chip Filter Status */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-700">Status Tugas</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_CHIPS.map((chip) => {
              const active = selectedChip === chip.key;
              const count = chipCounts[chip.key];
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setSelectedChip(chip.key)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
                    active
                      ? "border-sky-600 bg-sky-600 text-white shadow-xs"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <span>{chip.label}</span>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
                      active
                        ? "bg-sky-700 text-white"
                        : "bg-slate-100 text-slate-700"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Info Hasil Filter */}
      <div className="flex items-center justify-between px-0.5 text-xs text-slate-600">
        <span className="font-medium tabular-nums">
          Menampilkan{" "}
          <strong className="font-semibold text-slate-900">
            {filteredTasks.length.toLocaleString("id-ID")}
          </strong>{" "}
          dari{" "}
          <strong className="font-semibold text-slate-900">
            {tasks.length.toLocaleString("id-ID")}
          </strong>{" "}
          tugas
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex min-h-11 items-center rounded-md px-2.5 text-xs font-semibold text-sky-700 hover:bg-sky-50"
          >
            Reset Filter
          </button>
        )}
      </div>

      {/* Daftar Kartu Pelanggan Mobile-First */}
      <section aria-label="Daftar Kartu Tugas Pelanggan" className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-white p-6 text-center shadow-xs">
            <p className="text-sm font-semibold text-slate-900">
              {tasks.length === 0
                ? "Belum Ada Penugasan Aktif"
                : "Tidak Ada Tugas Sesuai Filter"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {tasks.length === 0 ? (
                <>
                  Belum ada data piutang pelanggan yang ditugaskan kepada akun{" "}
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    @{petugasUsername}
                  </span>
                  .
                </>
              ) : (
                "Ubah kata kunci pencarian atau pilih filter status lainnya untuk melihat daftar pelanggan."
              )}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-900 hover:bg-slate-50"
              >
                Tampilkan Semua Tugas
              </button>
            )}
          </div>
        ) : (
          filteredTasks.map((tugas) => {
            const isLunasResmi = tugas.statusRekonsiliasi === "LUNAS_RESMI";

            return (
              <article
                key={tugas.id}
                className={cn(
                  "rounded-md border border-slate-200 bg-white p-4 shadow-xs",
                  tugas.statusRekonsiliasi === "OVERDUE" &&
                    "border-l-4 border-l-red-600",
                  tugas.statusRekonsiliasi === "MASA_JANJI_BAYAR" &&
                    "border-l-4 border-l-amber-500"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                        {tugas.idPelanggan}
                      </span>
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700 tabular-nums">
                        {tugas.periode}
                      </span>
                    </div>
                    <h2 className="mt-1 text-base font-semibold text-slate-900">
                      {tugas.pelanggan.namaPelanggan}
                    </h2>
                  </div>
                  <StatusBadge status={tugas.statusRekonsiliasi} />
                </div>

                <div className="mt-2.5 flex items-start gap-2 text-xs text-slate-600">
                  <MapPin
                    className="mt-0.5 h-4 w-4 shrink-0 text-slate-600"
                    strokeWidth={1.75}
                  />
                  <span className="leading-relaxed">
                    {tugas.pelanggan.alamat}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 tabular-nums">
                    <Zap
                      className="h-4 w-4 shrink-0 text-sky-600"
                      strokeWidth={1.75}
                    />
                    <span>
                      {tugas.pelanggan.tarif} / {formatDaya(tugas.pelanggan.daya)}{" "}
                      • {tugas.jumlahLembar.toLocaleString("id-ID")} Lbr
                    </span>
                  </div>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {formatRupiah(tugas.nilaiTagihan)}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
                  <History
                    className="h-4 w-4 shrink-0 text-slate-600"
                    strokeWidth={1.75}
                  />
                  {tugas.jumlahKunjungan === 0 || !tugas.kunjunganTerakhir ? (
                    <span className="font-medium">
                      Belum ada riwayat kunjungan lapangan
                    </span>
                  ) : (
                    <span className="tabular-nums">
                      <strong className="font-semibold text-slate-900">
                        {tugas.jumlahKunjungan}x kunjungan
                      </strong>{" "}
                      • Terakhir:{" "}
                      {PENYELESAIAN_LABEL[
                        tugas.kunjunganTerakhir.bentukPenyelesaian
                      ]}{" "}
                      ({formatTanggalWib(tugas.kunjunganTerakhir.waktuInput)})
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <Link
                    href={`/petugas/piutang/${tugas.id}`}
                    className={cn(
                      "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors",
                      isLunasResmi
                        ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                        : "bg-sky-600 text-white hover:bg-sky-700"
                    )}
                  >
                    <span>
                      {isLunasResmi
                        ? "Lihat Detail & Riwayat"
                        : tugas.jumlahKunjungan > 0
                          ? "Buka Tugas & Kelola Kunjungan"
                          : "Buka Tugas & Input Kunjungan"}
                    </span>
                    <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
