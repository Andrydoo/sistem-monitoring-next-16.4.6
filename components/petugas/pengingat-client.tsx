"use client";

import * as React from "react";
import Link from "next/link";
import type {
  RentangJanjiBayar,
  StatusPengingat,
  StatusRekonsiliasi,
} from "@prisma/client";
import {
  AlertOctagon,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Zap,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDaya, formatRupiah } from "@/lib/format";
import {
  formatTanggalDateOnlyId,
  RENTANG_JANJI_BAYAR_OPTIONS,
} from "@/lib/janji-bayar";
import { cn } from "@/lib/utils";

export type PengingatCategory = "OVERDUE" | "MASA_JANJI_BAYAR" | "MENDATANG";

export interface PetugasPengingatItem {
  id: number;
  idPelanggan: string;
  periode: string;
  jumlahLembar: number;
  nilaiTagihan: string;
  statusRekonsiliasi: StatusRekonsiliasi;
  category: PengingatCategory;
  pelanggan: {
    idPelanggan: string;
    namaPelanggan: string;
    alamat: string;
    tarif: string;
    daya: number;
  };
  rentangJanjiBayar: RentangJanjiBayar | null;
  tanggalMulaiRentang: string | null;
  tanggalJatuhTempo: string | null;
  statusPengingat: StatusPengingat | null;
  catatanKendala: string | null;
}

export interface PengingatClientProps {
  items: PetugasPengingatItem[];
  todayIso: string;
  petugasNama: string;
  petugasUsername: string;
}

type PengingatFilterTab = "ALL" | PengingatCategory;

const FILTER_TABS: ReadonlyArray<{
  key: PengingatFilterTab;
  label: string;
}> = [
  { key: "ALL", label: "Semua" },
  { key: "OVERDUE", label: "Overdue" },
  { key: "MASA_JANJI_BAYAR", label: "Masa Janji Bayar" },
  { key: "MENDATANG", label: "Mendatang" },
];

const SHORT_RENTANG_LABEL_MAP: Record<RentangJanjiBayar, string> =
  Object.fromEntries(
    RENTANG_JANJI_BAYAR_OPTIONS.map((opt) => [opt.value, opt.shortLabel])
  ) as Record<RentangJanjiBayar, string>;

const MS_PER_DAY = 86_400_000;

function parseIsoDateToUtcMs(isoDate: string): number {
  const datePart = isoDate.slice(0, 10);
  return new Date(`${datePart}T00:00:00.000Z`).getTime();
}

function getDayIndicator(
  item: PetugasPengingatItem,
  todayIso: string
): {
  text: string;
  tone: "danger" | "warning" | "neutral";
} {
  if (!item.tanggalMulaiRentang || !item.tanggalJatuhTempo) {
    if (item.category === "OVERDUE") {
      return {
        text: "Melewati batas jatuh tempo janji bayar",
        tone: "danger",
      };
    }
    if (item.category === "MASA_JANJI_BAYAR") {
      return {
        text: "Sedang berada dalam masa janji bayar aktif",
        tone: "warning",
      };
    }
    return {
      text: "Jadwal janji bayar mendatang",
      tone: "neutral",
    };
  }

  const todayMs = parseIsoDateToUtcMs(todayIso);
  const startMs = parseIsoDateToUtcMs(item.tanggalMulaiRentang);
  const dueMs = parseIsoDateToUtcMs(item.tanggalJatuhTempo);

  if (todayMs > dueMs) {
    const overdueDays = Math.max(1, Math.round((todayMs - dueMs) / MS_PER_DAY));
    return {
      text: `Terlambat ${overdueDays.toLocaleString("id-ID")} hari sejak jatuh tempo`,
      tone: "danger",
    };
  }

  if (todayMs >= startMs && todayMs <= dueMs) {
    const remainingDays = Math.max(
      0,
      Math.round((dueMs - todayMs) / MS_PER_DAY)
    );
    if (remainingDays === 0) {
      return {
        text: "Jatuh tempo hari ini (hari terakhir masa janji bayar)",
        tone: "warning",
      };
    }
    return {
      text: `Sisa ${remainingDays.toLocaleString("id-ID")} hari masa janji bayar`,
      tone: "warning",
    };
  }

  const daysUntilStart = Math.max(
    1,
    Math.round((startMs - todayMs) / MS_PER_DAY)
  );
  return {
    text: `Dimulai dalam ${daysUntilStart.toLocaleString("id-ID")} hari`,
    tone: "neutral",
  };
}

export function PengingatClient({
  items,
  todayIso,
  petugasNama,
  petugasUsername,
}: PengingatClientProps) {
  const [activeTab, setActiveTab] = React.useState<PengingatFilterTab>("ALL");

  const counts = React.useMemo(() => {
    let overdue = 0;
    let masaJanjiBayar = 0;
    let mendatang = 0;

    for (const item of items) {
      if (item.category === "OVERDUE") overdue++;
      else if (item.category === "MASA_JANJI_BAYAR") masaJanjiBayar++;
      else mendatang++;
    }

    return {
      ALL: items.length,
      OVERDUE: overdue,
      MASA_JANJI_BAYAR: masaJanjiBayar,
      MENDATANG: mendatang,
    };
  }, [items]);

  const filteredItems = React.useMemo(() => {
    if (activeTab === "ALL") return items;
    return items.filter((item) => item.category === activeTab);
  }, [items, activeTab]);

  return (
    <div className="space-y-4">
      {/* Header Ringkas & Strip 3 KPI Padat */}
      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-xs lg:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sky-600 lg:flex">
              <Clock className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <Clock
              className="h-4 w-4 text-sky-600 lg:hidden"
              strokeWidth={1.75}
            />
            <div>
              <h1 className="text-sm font-semibold text-slate-900 lg:text-base">
                Pemantauan Janji Bayar & Overdue
              </h1>
              <p className="mt-0.5 text-xs text-slate-600">
                Daftar prioritas tindak lanjut janji bayar wilayah kerja{" "}
                <span className="font-semibold text-slate-800">
                  {petugasNama}
                </span>{" "}
                per tanggal acuan{" "}
                <span className="font-mono font-semibold text-slate-800 tabular-nums">
                  {formatTanggalDateOnlyId(`${todayIso}T00:00:00.000Z`)}
                </span>
                .
              </p>
            </div>
          </div>

          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700 tabular-nums">
            @{petugasUsername}
          </span>
        </div>

        {/* Strip 3 KPI Padat (grid-cols-3 gap-3 di Mobile & Desktop) */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div
            className={cn(
              "rounded-md border p-3 lg:p-4",
              counts.OVERDUE > 0
                ? "border-red-200 bg-red-50"
                : "border-slate-200 bg-slate-50"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wide text-slate-600 uppercase lg:text-[11px]">
                Overdue
              </span>
              <AlertOctagon
                className={cn(
                  "h-3.5 w-3.5 lg:h-4 lg:w-4",
                  counts.OVERDUE > 0 ? "text-red-700" : "text-slate-500"
                )}
                strokeWidth={1.75}
              />
            </div>
            <p
              className={cn(
                "mt-1 text-base font-bold tabular-nums lg:text-xl",
                counts.OVERDUE > 0 ? "text-red-700" : "text-slate-900"
              )}
            >
              {counts.OVERDUE.toLocaleString("id-ID")}
            </p>
            <p className="mt-0.5 hidden text-[11px] text-slate-600 lg:block">
              Melewati jatuh tempo
            </p>
          </div>

          <div
            className={cn(
              "rounded-md border p-3 lg:p-4",
              counts.MASA_JANJI_BAYAR > 0
                ? "border-amber-200 bg-amber-50"
                : "border-slate-200 bg-slate-50"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wide text-slate-600 uppercase lg:text-[11px]">
                Masa Janji
              </span>
              <Clock
                className={cn(
                  "h-3.5 w-3.5 lg:h-4 lg:w-4",
                  counts.MASA_JANJI_BAYAR > 0
                    ? "text-amber-700"
                    : "text-slate-500"
                )}
                strokeWidth={1.75}
              />
            </div>
            <p
              className={cn(
                "mt-1 text-base font-bold tabular-nums lg:text-xl",
                counts.MASA_JANJI_BAYAR > 0
                  ? "text-amber-800"
                  : "text-slate-900"
              )}
            >
              {counts.MASA_JANJI_BAYAR.toLocaleString("id-ID")}
            </p>
            <p className="mt-0.5 hidden text-[11px] text-slate-600 lg:block">
              Rentang pemantauan aktif
            </p>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 lg:p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wide text-slate-600 uppercase lg:text-[11px]">
                Mendatang
              </span>
              <CalendarClock
                className="h-3.5 w-3.5 text-sky-600 lg:h-4 lg:w-4"
                strokeWidth={1.75}
              />
            </div>
            <p className="mt-1 text-base font-bold text-slate-900 tabular-nums lg:text-xl">
              {counts.MENDATANG.toLocaleString("id-ID")}
            </p>
            <p className="mt-0.5 hidden text-[11px] text-slate-600 lg:block">
              Terjadwal periode berikutnya
            </p>
          </div>
        </div>
      </section>

      {/* Filter Tab Adaptif (Mobile grid min-h-11, Desktop bar horizontal rapi) */}
      <section
        aria-label="Filter Status Pengingat"
        className="rounded-md border border-slate-200 bg-white p-2.5 shadow-xs lg:flex lg:items-center lg:justify-between lg:px-4 lg:py-3"
      >
        <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center">
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const tabCount = counts[tab.key];

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex min-h-11 items-center justify-between gap-2 rounded-md border px-3 text-xs font-semibold transition-colors lg:h-9 lg:min-h-9",
                  isActive
                    ? "border-sky-600 bg-sky-600 text-white shadow-xs"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                <span className="truncate">{tab.label}</span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 font-mono text-[11px] tabular-nums",
                    isActive
                      ? "bg-sky-700 text-white"
                      : "bg-slate-100 text-slate-700"
                  )}
                >
                  {tabCount.toLocaleString("id-ID")}
                </span>
              </button>
            );
          })}
        </div>

        <p className="hidden text-xs text-slate-600 tabular-nums lg:block">
          Menampilkan{" "}
          <strong className="font-semibold text-slate-900">
            {filteredItems.length.toLocaleString("id-ID")}
          </strong>{" "}
          dari{" "}
          <strong className="font-semibold text-slate-900">
            {items.length.toLocaleString("id-ID")}
          </strong>{" "}
          jadwal pengingat
        </p>
      </section>

      {/* Empty States Bersama */}
      {items.length === 0 ? (
        <div className="rounded-md border border-emerald-200 bg-white p-6 text-center shadow-xs lg:p-10">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50">
            <CheckCircle2
              className="h-6 w-6 text-emerald-600"
              strokeWidth={1.75}
            />
          </div>
          <h2 className="mt-3 text-sm font-semibold text-slate-900">
            Tidak Ada Pengingat Janji Bayar Aktif
          </h2>
          <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-slate-600">
            Seluruh jadwal komitmen janji bayar pelanggan di wilayah penugasan
            Anda telah tertangani atau belum terdapat pelanggan yang berstatus
            Overdue maupun Masa Janji Bayar.
          </p>
          <Link
            href="/petugas"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 lg:min-h-9"
          >
            Kembali ke Daftar Tugas
          </Link>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-white p-6 text-center shadow-xs lg:p-10">
          <p className="text-sm font-semibold text-slate-900">
            Tidak Ada Jadwal pada Kategori Ini
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Pilih kategori tab lainnya untuk melihat daftar janji bayar aktif.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-900 hover:bg-slate-50 lg:min-h-9"
          >
            Tampilkan Semua ({items.length.toLocaleString("id-ID")})
          </button>
        </div>
      ) : (
        <>
          {/* Mode Mobile (< lg): Daftar Kartu Pengingat Prioritas */}
          <section
            aria-label="Daftar Kartu Janji Bayar"
            className="block space-y-3 lg:hidden"
          >
            {filteredItems.map((item) => {
              const indicator = getDayIndicator(item, todayIso);
              const rentangShortLabel = item.rentangJanjiBayar
                ? SHORT_RENTANG_LABEL_MAP[item.rentangJanjiBayar]
                : "Rentang Terjadwal";

              return (
                <article
                  key={item.id}
                  className={cn(
                    "rounded-md border border-slate-200 bg-white p-4 shadow-xs",
                    item.category === "OVERDUE" &&
                      "border-l-4 border-l-red-600",
                    item.category === "MASA_JANJI_BAYAR" &&
                      "border-l-4 border-l-amber-500",
                    item.category === "MENDATANG" &&
                      "border-l-4 border-l-sky-600"
                  )}
                >
                  {/* Identitas Pelanggan & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                          {item.idPelanggan}
                        </span>
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700 tabular-nums">
                          {item.periode}
                        </span>
                      </div>
                      <h2 className="mt-1 text-base font-semibold text-slate-900">
                        {item.pelanggan.namaPelanggan}
                      </h2>
                    </div>

                    {item.category === "OVERDUE" ? (
                      <StatusBadge status="OVERDUE" />
                    ) : item.category === "MASA_JANJI_BAYAR" ? (
                      <StatusBadge status="MASA_JANJI_BAYAR" />
                    ) : (
                      <StatusBadge
                        status="DITINDAKLANJUTI"
                        customLabel="Jadwal Mendatang"
                      />
                    )}
                  </div>

                  {/* Alamat */}
                  <div className="mt-2.5 flex items-start gap-2 text-xs text-slate-600">
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
                      strokeWidth={1.75}
                    />
                    <span className="leading-relaxed">
                      {item.pelanggan.alamat}
                    </span>
                  </div>

                  {/* Tarif/Daya & Nominal */}
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 tabular-nums">
                      <Zap
                        className="h-4 w-4 shrink-0 text-sky-600"
                        strokeWidth={1.75}
                      />
                      <span>
                        {item.pelanggan.tarif} /{" "}
                        {formatDaya(item.pelanggan.daya)} •{" "}
                        {item.jumlahLembar.toLocaleString("id-ID")} Lbr
                      </span>
                    </div>
                    <span className="text-base font-bold text-slate-900 tabular-nums">
                      {formatRupiah(item.nilaiTagihan)}
                    </span>
                  </div>

                  {/* Kotak Informasi Rentang Janji Bayar */}
                  <div
                    className={cn(
                      "mt-3 rounded-md border p-3 text-xs",
                      indicator.tone === "danger" &&
                        "border-red-200 bg-red-50 text-red-900",
                      indicator.tone === "warning" &&
                        "border-amber-200 bg-amber-50 text-amber-900",
                      indicator.tone === "neutral" &&
                        "border-slate-200 bg-slate-50 text-slate-800"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <CalendarClock
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            indicator.tone === "danger" && "text-red-700",
                            indicator.tone === "warning" && "text-amber-700",
                            indicator.tone === "neutral" && "text-sky-700"
                          )}
                          strokeWidth={1.75}
                        />
                        <span>Rentang: {rentangShortLabel}</span>
                      </span>
                      {item.tanggalMulaiRentang && item.tanggalJatuhTempo && (
                        <span className="font-mono text-[11px] font-medium tabular-nums">
                          {formatTanggalDateOnlyId(item.tanggalMulaiRentang)}{" "}
                          s.d. {formatTanggalDateOnlyId(item.tanggalJatuhTempo)}
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        "mt-1.5 font-semibold tabular-nums",
                        indicator.tone === "danger" && "text-red-800",
                        indicator.tone === "warning" && "text-amber-900",
                        indicator.tone === "neutral" && "text-slate-700"
                      )}
                    >
                      {indicator.text}
                    </p>
                  </div>

                  {/* Catatan Kendala Kunjungan Terakhir */}
                  {item.catatanKendala && (
                    <div className="mt-2.5 flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      <FileText
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500"
                        strokeWidth={1.75}
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800">
                          Catatan Kendala Terakhir:{" "}
                        </span>
                        <span className="leading-relaxed">
                          {item.catatanKendala}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Tombol Aksi Penuh */}
                  <div className="mt-3">
                    <Link
                      href={`/petugas/piutang/${item.id}`}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
                    >
                      <span>Tindak Lanjuti Kunjungan</span>
                      <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>

          {/* Mode Desktop (>= lg): Tabel Prioritas Janji Bayar ber-Sticky Header */}
          <section
            aria-label="Tabel Prioritas Janji Bayar"
            className="hidden overflow-hidden rounded-md border border-slate-200 bg-white shadow-xs lg:block"
          >
            <div className="max-h-[640px] overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">ID Pelanggan</th>
                    <th className="px-4 py-3">Nama & Alamat Pelanggan</th>
                    <th className="px-4 py-3 text-right">Nilai Tagihan (Rp)</th>
                    <th className="px-4 py-3">Rentang & Jatuh Tempo</th>
                    <th className="px-4 py-3">Keterangan Waktu & Kendala</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredItems.map((item) => {
                    const indicator = getDayIndicator(item, todayIso);
                    const rentangShortLabel = item.rentangJanjiBayar
                      ? SHORT_RENTANG_LABEL_MAP[item.rentangJanjiBayar]
                      : "Rentang Terjadwal";

                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "hover:bg-slate-50/80",
                          item.category === "OVERDUE" &&
                            "bg-red-50/20 hover:bg-red-50/40"
                        )}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.category === "OVERDUE" ? (
                            <StatusBadge status="OVERDUE" />
                          ) : item.category === "MASA_JANJI_BAYAR" ? (
                            <StatusBadge status="MASA_JANJI_BAYAR" />
                          ) : (
                            <StatusBadge
                              status="DITINDAKLANJUTI"
                              customLabel="Jadwal Mendatang"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-mono font-semibold text-slate-900 tabular-nums">
                            {item.idPelanggan}
                          </p>
                          <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
                            Periode {item.periode}
                          </p>
                        </td>
                        <td className="max-w-xs px-4 py-3">
                          <p className="font-semibold text-slate-900">
                            {item.pelanggan.namaPelanggan}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                            {item.pelanggan.alamat}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-600 tabular-nums">
                            {item.pelanggan.tarif} /{" "}
                            {formatDaya(item.pelanggan.daya)} •{" "}
                            {item.jumlahLembar.toLocaleString("id-ID")} Lbr
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-slate-900 tabular-nums">
                          {formatRupiah(item.nilaiTagihan)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-semibold text-slate-800">
                            {rentangShortLabel}
                          </p>
                          {item.tanggalMulaiRentang &&
                          item.tanggalJatuhTempo ? (
                            <p className="mt-0.5 font-mono text-[11px] text-slate-600 tabular-nums">
                              {formatTanggalDateOnlyId(
                                item.tanggalMulaiRentang
                              )}{" "}
                              s.d.{" "}
                              {formatTanggalDateOnlyId(item.tanggalJatuhTempo)}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              -
                            </p>
                          )}
                        </td>
                        <td className="max-w-sm px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                              indicator.tone === "danger" &&
                                "border-red-200 bg-red-50 text-red-700",
                              indicator.tone === "warning" &&
                                "border-amber-200 bg-amber-50 text-amber-800",
                              indicator.tone === "neutral" &&
                                "border-slate-200 bg-slate-50 text-slate-700"
                            )}
                          >
                            {indicator.text}
                          </span>
                          {item.catatanKendala && (
                            <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">
                              <span className="font-semibold text-slate-700">
                                Kendala:{" "}
                              </span>
                              {item.catatanKendala}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Link
                            href={`/petugas/piutang/${item.id}`}
                            className="inline-flex h-8 items-center gap-1 rounded-md bg-sky-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                          >
                            <span>Tindak Lanjuti</span>
                            <ChevronRight
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                            />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
