"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { StatusRekonsiliasi } from "@prisma/client";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Search,
  X,
} from "lucide-react";
import { formatDaya, formatRupiah, formatTanggalWib } from "@/lib/format";
import { ExportPiutangButton } from "@/components/shared/export-piutang-button";
import { PiutangDetailDialog } from "@/components/shared/piutang-detail-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PiutangPimpinanRow {
  id: number;
  idPelanggan: string;
  periode: string;
  jumlahLembar: number;
  nilaiTagihan: string;
  statusRekonsiliasi: StatusRekonsiliasi;
  updatedAt: string;
  pelanggan: {
    namaPelanggan: string;
    alamat: string;
    tarif: string;
    daya: number;
    kodeUnit: string | null;
  };
  petugas: {
    id: number;
    username: string;
    nama: string;
  } | null;
  jumlahKunjungan: number;
}

export interface PimpinanPetugasOption {
  id: number;
  username: string;
  nama: string;
  isActive: boolean;
}

export interface PimpinanPiutangClientProps {
  items: PiutangPimpinanRow[];
  petugasList: PimpinanPetugasOption[];
  periodeList: string[];
  filters: {
    q: string;
    periode: string;
    petugas: string;
    status: string;
  };
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
  };
}

const STATUS_OPTIONS: Array<{ value: StatusRekonsiliasi; label: string }> = [
  { value: "BELUM_TERTAGIH", label: "Belum Tertagih" },
  { value: "MASA_JANJI_BAYAR", label: "Masa Janji Bayar" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "DITINDAKLANJUTI", label: "Ditindaklanjuti" },
  { value: "KLAIM_LAPANGAN", label: "Klaim Lapangan" },
  { value: "LUNAS_RESMI", label: "Lunas Resmi" },
  { value: "UNASSIGNED", label: "Belum Dipetakan (Unassigned)" },
];

export function PimpinanPiutangClient({
  items,
  petugasList,
  periodeList,
  filters,
  pagination,
}: PimpinanPiutangClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [qInput, setQInput] = React.useState(filters.q);
  const [periodeInput, setPeriodeInput] = React.useState(filters.periode);
  const [petugasInput, setPetugasInput] = React.useState(filters.petugas);
  const [statusInput, setStatusInput] = React.useState(filters.status);

  // Dialog Inspeksi Detail & Evidence Privat (Strictly Read-Only)
  const [detailPiutangId, setDetailPiutangId] = React.useState<number | null>(
    null
  );
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  const buildUrlWithParams = (
    overrides: Partial<{
      q: string;
      periode: string;
      petugas: string;
      status: string;
      page: number;
    }>
  ): string => {
    const params = new URLSearchParams();
    const nextQ = overrides.q !== undefined ? overrides.q : filters.q;
    const nextPeriode =
      overrides.periode !== undefined ? overrides.periode : filters.periode;
    const nextPetugas =
      overrides.petugas !== undefined ? overrides.petugas : filters.petugas;
    const nextStatus =
      overrides.status !== undefined ? overrides.status : filters.status;
    const nextPage =
      overrides.page !== undefined ? overrides.page : pagination.currentPage;

    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextPeriode && nextPeriode !== "ALL")
      params.set("periode", nextPeriode);
    if (nextPetugas && nextPetugas !== "ALL")
      params.set("petugas", nextPetugas);
    if (nextStatus && nextStatus !== "ALL") params.set("status", nextStatus);
    if (nextPage > 1) params.set("page", String(nextPage));

    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(
      buildUrlWithParams({
        q: qInput,
        periode: periodeInput,
        petugas: petugasInput,
        status: statusInput,
        page: 1,
      })
    );
  };

  const handleResetFilters = () => {
    setQInput("");
    setPeriodeInput("ALL");
    setPetugasInput("ALL");
    setStatusInput("ALL");
    router.push(pathname);
  };

  const hasActiveFilters =
    filters.q !== "" ||
    filters.periode !== "ALL" ||
    filters.petugas !== "ALL" ||
    filters.status !== "ALL";

  const openDetailDialog = (piutangId: number) => {
    setDetailPiutangId(piutangId);
    setIsDetailOpen(true);
  };

  const startRowNumber =
    pagination.totalCount === 0
      ? 0
      : (pagination.currentPage - 1) * pagination.pageSize + 1;
  const endRowNumber = Math.min(
    pagination.currentPage * pagination.pageSize,
    pagination.totalCount
  );

  return (
    <div className="space-y-4">
      {/* Toolbar Filter via URL searchParams (Read-Only) */}
      <form
        onSubmit={handleFilterSubmit}
        className="rounded-md border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div className="space-y-1.5 lg:col-span-4">
            <Label
              htmlFor="pimpinan-filter-q"
              className="text-xs font-semibold text-slate-700"
            >
              Pencarian Pelanggan
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400"
                strokeWidth={1.75}
              />
              <Input
                id="pimpinan-filter-q"
                type="text"
                placeholder="Cari 12 digit ID Pelanggan atau Nama..."
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                className="h-9 rounded-md border-slate-300 pl-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5 lg:col-span-2">
            <Label
              htmlFor="pimpinan-filter-periode"
              className="text-xs font-semibold text-slate-700"
            >
              Periode
            </Label>
            <select
              id="pimpinan-filter-periode"
              value={periodeInput}
              onChange={(e) => setPeriodeInput(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none"
            >
              <option value="ALL">Semua Periode</option>
              {periodeList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 lg:col-span-2">
            <Label
              htmlFor="pimpinan-filter-petugas"
              className="text-xs font-semibold text-slate-700"
            >
              Petugas Lapangan
            </Label>
            <select
              id="pimpinan-filter-petugas"
              value={petugasInput}
              onChange={(e) => setPetugasInput(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
            >
              <option value="ALL">Semua Petugas</option>
              <option value="UNASSIGNED">Belum Dipetakan</option>
              {petugasList.map((ptg) => (
                <option key={ptg.id} value={String(ptg.id)}>
                  {ptg.nama} (@{ptg.username})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 lg:col-span-2">
            <Label
              htmlFor="pimpinan-filter-status"
              className="text-xs font-semibold text-slate-700"
            >
              Status Rekonsiliasi
            </Label>
            <select
              id="pimpinan-filter-status"
              value={statusInput}
              onChange={(e) => setStatusInput(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              {STATUS_OPTIONS.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 lg:col-span-2 lg:justify-end">
            <Button
              type="submit"
              size="sm"
              className="h-9 flex-1 rounded-md bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700 lg:flex-initial"
            >
              <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Filter</span>
            </Button>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 rounded-md border-slate-300 px-2.5 text-xs text-slate-700"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Tabel Operasional Dense Read-Only dengan Sticky Header */}
      <div className="rounded-md border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col justify-between gap-2.5 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">
              Daftar Detail Piutang & Bukti Lapangan
            </span>
            <span className="text-slate-300">•</span>
            <span className="tabular-nums">
              {pagination.totalCount.toLocaleString("id-ID")} rekaman sesuai
              filter aktif
            </span>
          </div>

          <ExportPiutangButton
            periode={filters.periode}
            petugas={filters.petugas}
            status={filters.status}
            q={filters.q}
          />
        </div>

        <div className="max-h-[620px] overflow-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
                <th className="px-4 py-3">ID Pelanggan</th>
                <th className="px-4 py-3">Nama & Alamat</th>
                <th className="px-4 py-3">Tarif / Daya</th>
                <th className="px-4 py-3 text-right">Lbr</th>
                <th className="px-4 py-3 text-right">Nilai Tagihan (Rp)</th>
                <th className="px-4 py-3">Petugas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Update Terakhir</th>
                <th className="px-4 py-3 text-right">Inspeksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-xs text-slate-500"
                  >
                    Tidak ada rekaman piutang yang cocok dengan filter pencarian
                    saat ini.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold text-slate-900 tabular-nums">
                        {row.idPelanggan}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
                        Periode {row.periode} • Unit{" "}
                        {row.pelanggan.kodeUnit ?? "-"}
                      </p>
                    </td>

                    <td className="max-w-xs px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {row.pelanggan.namaPelanggan}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                        {row.pelanggan.alamat}
                      </p>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-700 tabular-nums">
                      <span className="font-semibold text-slate-900">
                        {row.pelanggan.tarif}
                      </span>{" "}
                      / {formatDaya(row.pelanggan.daya)}
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-slate-800 tabular-nums">
                      {row.jumlahLembar}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-slate-900 tabular-nums">
                      {formatRupiah(row.nilaiTagihan)}
                    </td>

                    <td className="px-4 py-3">
                      {row.petugas ? (
                        <div>
                          <p className="font-medium text-slate-900">
                            {row.petugas.nama}
                          </p>
                          <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                            @{row.petugas.username}
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          Belum Dipetakan
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <StatusBadge status={row.statusRekonsiliasi} />
                        <p className="font-mono text-[10px] text-slate-500 tabular-nums">
                          {row.jumlahKunjungan} kunjungan
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 tabular-nums">
                      {formatTanggalWib(row.updatedAt)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openDetailDialog(row.id)}
                        className="h-8 rounded-md border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                      >
                        <Eye
                          className="h-3.5 w-3.5 text-sky-600"
                          strokeWidth={1.75}
                        />
                        <span>Lihat Detail & Evidence</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination Server-Side */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-3.5 text-xs sm:flex-row">
          <p className="text-slate-600 tabular-nums">
            Menampilkan{" "}
            <span className="font-semibold text-slate-900">
              {startRowNumber}–{endRowNumber}
            </span>{" "}
            dari{" "}
            <span className="font-semibold text-slate-900">
              {pagination.totalCount.toLocaleString("id-ID")}
            </span>{" "}
            rekaman piutang
          </p>

          <div className="flex items-center gap-2">
            {pagination.currentPage > 1 ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-md border-slate-300 px-2.5 text-xs"
              >
                <Link
                  href={buildUrlWithParams({
                    page: pagination.currentPage - 1,
                  })}
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Sebelumnya</span>
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className="h-8 rounded-md border-slate-200 px-2.5 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Sebelumnya</span>
              </Button>
            )}

            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-xs font-semibold text-slate-800 tabular-nums">
              Hal. {pagination.currentPage} /{" "}
              {Math.max(1, pagination.totalPages)}
            </span>

            {pagination.currentPage < pagination.totalPages ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-md border-slate-300 px-2.5 text-xs"
              >
                <Link
                  href={buildUrlWithParams({
                    page: pagination.currentPage + 1,
                  })}
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className="h-8 rounded-md border-slate-200 px-2.5 text-xs"
              >
                <span>Berikutnya</span>
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Dialog Inspeksi Detail Piutang & Foto Evidence Privat */}
      <PiutangDetailDialog
        piutangId={detailPiutangId}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}
