"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { StatusRekonsiliasi } from "@prisma/client";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { reassignPetugasAction } from "@/app/admin/actions";
import { formatDaya, formatRupiah, formatTanggalWib } from "@/lib/format";
import { PiutangDetailDialog } from "@/components/shared/piutang-detail-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PiutangAdminRow {
  id: number;
  idPelanggan: string;
  periode: string;
  jumlahLembar: number;
  nilaiTagihan: string;
  statusRekonsiliasi: StatusRekonsiliasi;
  updatedAt: string;
  idPetugas: number | null;
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
}

export interface PetugasChoice {
  id: number;
  username: string;
  nama: string;
  isActive: boolean;
}

export interface AdminPiutangClientProps {
  items: PiutangAdminRow[];
  petugasList: PetugasChoice[];
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

export function AdminPiutangClient({
  items,
  petugasList,
  periodeList,
  filters,
  pagination,
}: AdminPiutangClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const activePetugasList = React.useMemo(
    () => petugasList.filter((p) => p.isActive),
    [petugasList]
  );

  // Filter form state
  const [qInput, setQInput] = React.useState(filters.q);
  const [periodeInput, setPeriodeInput] = React.useState(filters.periode);
  const [petugasInput, setPetugasInput] = React.useState(filters.petugas);
  const [statusInput, setStatusInput] = React.useState(filters.status);

  // Multi-select state
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);

  // Dialog Load Balancing (Pindah Petugas)
  const [dialogTargetIds, setDialogTargetIds] = React.useState<number[]>([]);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [targetPetugasId, setTargetPetugasId] = React.useState<string>(
    activePetugasList[0] ? String(activePetugasList[0].id) : ""
  );
  const [isSubmittingReassign, setIsSubmittingReassign] = React.useState(false);

  // Dialog Inspeksi Detail & Evidence Privat
  const [detailPiutangId, setDetailPiutangId] = React.useState<number | null>(
    null
  );
  const [isDetailDialogOpen, setIsDetailDialogOpen] = React.useState(false);

  const openDetailDialog = (piutangId: number) => {
    setDetailPiutangId(piutangId);
    setIsDetailDialogOpen(true);
  };

  const validSelectedIds = React.useMemo(() => {
    const validIdSet = new Set(items.map((item) => item.id));
    return selectedIds.filter((id) => validIdSet.has(id));
  }, [items, selectedIds]);

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

  const allSelected =
    items.length > 0 && validSelectedIds.length === items.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((item) => item.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const openBulkReassignDialog = () => {
    if (validSelectedIds.length === 0) return;
    setDialogTargetIds(validSelectedIds);
    if (activePetugasList[0] && !targetPetugasId) {
      setTargetPetugasId(String(activePetugasList[0].id));
    }
    setIsDialogOpen(true);
  };

  const openSingleReassignDialog = (row: PiutangAdminRow) => {
    setDialogTargetIds([row.id]);
    const otherPetugas =
      activePetugasList.find((p) => p.id !== row.idPetugas) ??
      activePetugasList[0];
    if (otherPetugas) {
      setTargetPetugasId(String(otherPetugas.id));
    }
    setIsDialogOpen(true);
  };

  const dialogTargetRows = React.useMemo(
    () => items.filter((item) => dialogTargetIds.includes(item.id)),
    [items, dialogTargetIds]
  );

  const selectedRowsTotalBigInt = React.useMemo(() => {
    return items
      .filter((item) => validSelectedIds.includes(item.id))
      .reduce((acc, item) => acc + BigInt(item.nilaiTagihan), BigInt(0));
  }, [items, validSelectedIds]);

  const dialogRowsTotalBigInt = React.useMemo(() => {
    return dialogTargetRows.reduce(
      (acc, item) => acc + BigInt(item.nilaiTagihan),
      BigInt(0)
    );
  }, [dialogTargetRows]);

  const handleConfirmReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dialogTargetIds.length === 0) return;

    const parsedPetugasId = Number.parseInt(targetPetugasId, 10);
    if (!Number.isFinite(parsedPetugasId) || parsedPetugasId <= 0) {
      toast.error("Pilih petugas lapangan tujuan.");
      return;
    }

    setIsSubmittingReassign(true);
    try {
      const res = await reassignPetugasAction({
        piutangIds: dialogTargetIds,
        targetPetugasId: parsedPetugasId,
      });

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setIsDialogOpen(false);
      setSelectedIds((prev) =>
        prev.filter((id) => !dialogTargetIds.includes(id))
      );
      setDialogTargetIds([]);
      router.refresh();
    } catch {
      toast.error("Gagal memindahkan penugasan petugas.");
    } finally {
      setIsSubmittingReassign(false);
    }
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
      {/* Toolbar Filter via URL searchParams */}
      <form
        onSubmit={handleFilterSubmit}
        className="rounded-md border border-slate-200 bg-white p-4 shadow-xs"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div className="space-y-1.5 lg:col-span-4">
            <Label
              htmlFor="filter-q-piutang"
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
                id="filter-q-piutang"
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
              htmlFor="filter-periode-piutang"
              className="text-xs font-semibold text-slate-700"
            >
              Periode
            </Label>
            <select
              id="filter-periode-piutang"
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
              htmlFor="filter-petugas-piutang"
              className="text-xs font-semibold text-slate-700"
            >
              Petugas Lapangan
            </Label>
            <select
              id="filter-petugas-piutang"
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
              htmlFor="filter-status-piutang"
              className="text-xs font-semibold text-slate-700"
            >
              Status Rekonsiliasi
            </Label>
            <select
              id="filter-status-piutang"
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

      {/* Bar Aksi Load Balancing (Muncul saat >= 1 baris dicentang) */}
      {validSelectedIds.length > 0 && (
        <div className="flex flex-col justify-between gap-3 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 shadow-xs sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center rounded-md border border-sky-300 bg-white px-2.5 py-1 font-mono font-semibold text-sky-800 tabular-nums">
              {validSelectedIds.length} Piutang Terpilih
            </span>
            <span className="text-slate-700">
              Total Nilai Terpilih:{" "}
              <strong className="font-semibold text-slate-900 tabular-nums">
                {formatRupiah(selectedRowsTotalBigInt)}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="h-8 rounded-md border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
            >
              Batalkan Pilihan
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={openBulkReassignDialog}
              className="h-8 rounded-md bg-sky-600 px-3.5 text-xs font-semibold text-white hover:bg-sky-700"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>
                Load Balancing / Pindah Petugas ({validSelectedIds.length})
              </span>
            </Button>
          </div>
        </div>
      )}

      {/* Tabel Operasional Dense dengan Sticky Header */}
      <div className="rounded-md border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col justify-between gap-2.5 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">
              Daftar Detail Piutang
            </span>
            <span className="text-slate-300">•</span>
            <span className="tabular-nums">
              {pagination.totalCount.toLocaleString("id-ID")} rekaman sesuai
              filter aktif
            </span>
          </div>

          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
            Halaman {pagination.currentPage} dari{" "}
            {Math.max(1, pagination.totalPages)}
          </span>
        </div>

        <div className="max-h-[620px] overflow-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua piutang di halaman ini"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600"
                  />
                </th>
                <th className="px-4 py-3">ID Pelanggan</th>
                <th className="px-4 py-3">Nama & Alamat</th>
                <th className="px-4 py-3">Tarif / Daya</th>
                <th className="px-4 py-3 text-right">Lbr</th>
                <th className="px-4 py-3 text-right">Nilai Tagihan (Rp)</th>
                <th className="px-4 py-3">Petugas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Update Terakhir</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-xs text-slate-500"
                  >
                    Tidak ada rekaman piutang yang cocok dengan filter pencarian
                    saat ini.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const isChecked = validSelectedIds.includes(row.id);

                  return (
                    <tr
                      key={row.id}
                      className={
                        isChecked
                          ? "bg-sky-50/60 hover:bg-sky-50"
                          : "hover:bg-slate-50/80"
                      }
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Pilih piutang pelanggan ${row.idPelanggan}`}
                          checked={isChecked}
                          onChange={() => toggleSelectOne(row.id)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600"
                        />
                      </td>
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
                        <StatusBadge status={row.statusRekonsiliasi} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 tabular-nums">
                        {formatTanggalWib(row.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openDetailDialog(row.id)}
                            className="h-8 rounded-md border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                          >
                            <Eye
                              className="h-3.5 w-3.5 text-slate-600"
                              strokeWidth={1.75}
                            />
                            <span>Detail</span>
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openSingleReassignDialog(row)}
                            className="h-8 rounded-md border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                          >
                            <ArrowLeftRight
                              className="h-3.5 w-3.5 text-sky-600"
                              strokeWidth={1.75}
                            />
                            <span>Pindah Petugas</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {/* Dialog Konfirmasi Load Balancing (Pindah Petugas) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-md border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-900">
              Konfirmasi Load Balancing Penugasan Petugas
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Pindahkan beban penagihan piutang ke petugas lapangan tujuan.
              Status tindak lanjut lapangan yang sedang berjalan akan tetap
              dipertahankan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmReassign} className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Jumlah Piutang:</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {dialogTargetRows.length} Pelanggan
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-slate-500">Total Nilai Tagihan:</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatRupiah(dialogRowsTotalBigInt)}
                </span>
              </div>
              {dialogTargetRows.length === 1 && dialogTargetRows[0] && (
                <div className="mt-2 border-t border-slate-200 pt-2">
                  <p className="font-semibold text-slate-900">
                    {dialogTargetRows[0].pelanggan.namaPelanggan} (
                    <span className="font-mono tabular-nums">
                      {dialogTargetRows[0].idPelanggan}
                    </span>
                    )
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    Petugas Saat Ini:{" "}
                    <span className="font-medium text-slate-800">
                      {dialogTargetRows[0].petugas
                        ? `${dialogTargetRows[0].petugas.nama} (@${dialogTargetRows[0].petugas.username})`
                        : "Belum Dipetakan"}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="reassign-petugas-target"
                className="text-xs font-semibold text-slate-700"
              >
                Petugas Lapangan Tujuan (Aktif)
              </Label>
              <select
                id="reassign-petugas-target"
                value={targetPetugasId}
                onChange={(e) => setTargetPetugasId(e.target.value)}
                required
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              >
                {activePetugasList.map((ptg) => (
                  <option key={ptg.id} value={ptg.id}>
                    {ptg.nama} (@{ptg.username})
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDialogOpen(false)}
                className="h-9 rounded-md border-slate-300 text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  isSubmittingReassign || activePetugasList.length === 0
                }
                className="h-9 rounded-md bg-sky-600 px-4 text-xs font-semibold text-white hover:bg-sky-700"
              >
                {isSubmittingReassign ? (
                  <>
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      strokeWidth={1.75}
                    />
                    <span>Memindahkan...</span>
                  </>
                ) : (
                  <>
                    <ArrowLeftRight
                      className="h-3.5 w-3.5"
                      strokeWidth={1.75}
                    />
                    <span>Konfirmasi Pindah Petugas</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Inspeksi Detail Piutang & Foto Evidence Privat */}
      <PiutangDetailDialog
        piutangId={detailPiutangId}
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
      />
    </div>
  );
}
