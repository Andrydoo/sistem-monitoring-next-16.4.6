"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { StatusRekonsiliasi } from "@prisma/client";
import {
  CheckCircle2,
  Filter,
  Loader2,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  bulkResolveAnomaliAction,
  resolveAnomaliAction,
} from "@/app/admin/actions";
import { formatDaya, formatRupiah, formatTanggalWib } from "@/lib/format";
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

export interface AnomaliRowItem {
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

export interface PetugasOption {
  id: number;
  username: string;
  nama: string;
  kodeUnit: string | null;
}

export interface AdminAnomaliClientProps {
  items: AnomaliRowItem[];
  petugasList: PetugasOption[];
  periodeList: string[];
  activePeriode: string;
  activeQuery: string;
}

export function AdminAnomaliClient({
  items,
  petugasList,
  periodeList,
  activePeriode,
  activeQuery,
}: AdminAnomaliClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [periodeFilter, setPeriodeFilter] = React.useState(activePeriode);
  const [searchQuery, setSearchQuery] = React.useState(activeQuery);

  // State pemilihan massal
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [bulkPetugasId, setBulkPetugasId] = React.useState<string>(
    petugasList[0] ? String(petugasList[0].id) : ""
  );
  const [bulkKodeUnit, setBulkKodeUnit] = React.useState<string>("51304");
  const [isBulkSubmitting, setIsBulkSubmitting] = React.useState(false);

  // State Dialog Pemetaan Satuan
  const [singleTarget, setSingleTarget] =
    React.useState<AnomaliRowItem | null>(null);
  const [singlePetugasId, setSinglePetugasId] = React.useState<string>(
    petugasList[0] ? String(petugasList[0].id) : ""
  );
  const [singleKodeUnit, setSingleKodeUnit] = React.useState<string>("51304");
  const [isSingleSubmitting, setIsSingleSubmitting] = React.useState(false);

  // Derivasi ID terpilih yang masih valid pada daftar item saat ini
  const validSelectedIds = React.useMemo(() => {
    const validIdSet = new Set(items.map((item) => item.id));
    return selectedIds.filter((id) => validIdSet.has(id));
  }, [items, selectedIds]);

  const applyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams();
    if (periodeFilter && periodeFilter !== "ALL") {
      params.set("periode", periodeFilter);
    }
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const resetFilter = () => {
    setPeriodeFilter("ALL");
    setSearchQuery("");
    router.push(pathname);
  };

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

  const handleBulkSubmit = async () => {
    if (validSelectedIds.length === 0) {
      toast.error("Pilih minimal 1 baris anomali terlebih dahulu.");
      return;
    }
    const parsedPetugasId = Number.parseInt(bulkPetugasId, 10);
    if (!Number.isFinite(parsedPetugasId) || parsedPetugasId <= 0) {
      toast.error("Silakan pilih petugas tujuan.");
      return;
    }

    setIsBulkSubmitting(true);
    try {
      const res = await bulkResolveAnomaliAction({
        piutangIds: validSelectedIds,
        idPetugas: parsedPetugasId,
        kodeUnit: bulkKodeUnit.trim() || "51304",
      });

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setSelectedIds([]);
      router.refresh();
    } catch {
      toast.error("Gagal memproses pemetaan massal.");
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const openSingleDialog = (item: AnomaliRowItem) => {
    setSingleTarget(item);
    setSinglePetugasId(
      item.idPetugas
        ? String(item.idPetugas)
        : petugasList[0]
          ? String(petugasList[0].id)
          : ""
    );
    setSingleKodeUnit(item.pelanggan.kodeUnit?.trim() || "51304");
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleTarget) return;

    const parsedPetugasId = Number.parseInt(singlePetugasId, 10);
    if (!Number.isFinite(parsedPetugasId) || parsedPetugasId <= 0) {
      toast.error("Silakan pilih petugas lapangan tujuan.");
      return;
    }

    setIsSingleSubmitting(true);
    try {
      const res = await resolveAnomaliAction({
        piutangId: singleTarget.id,
        idPetugas: parsedPetugasId,
        kodeUnit: singleKodeUnit.trim() || "51304",
      });

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setSingleTarget(null);
      router.refresh();
    } catch {
      toast.error("Gagal memetakan baris anomali.");
    } finally {
      setIsSingleSubmitting(false);
    }
  };

  const getAnomalyReasonText = (item: AnomaliRowItem): string => {
    const noPetugas = !item.idPetugas || !item.petugas;
    const noUnit = !item.pelanggan.kodeUnit;
    if (noPetugas && noUnit) {
      return "Petugas & Kode Unit Kosong";
    }
    if (noPetugas) {
      return "Petugas Belum Dipetakan";
    }
    if (noUnit) {
      return "Kode Unit Kosong";
    }
    return "Status Karantina Unassigned";
  };

  return (
    <div className="space-y-4">
      {/* Toolbar Filter Periode & Pencarian */}
      <form
        onSubmit={applyFilter}
        className="flex flex-col justify-between gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-xs lg:flex-row lg:items-end"
      >
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="filter-periode-anomali"
              className="text-xs font-semibold text-slate-700"
            >
              Filter Periode Tagihan
            </Label>
            <select
              id="filter-periode-anomali"
              value={periodeFilter}
              onChange={(e) => setPeriodeFilter(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 tabular-nums focus:border-sky-600 focus:outline-none"
            >
              <option value="ALL">Semua Periode</option>
              {periodeList.map((p) => (
                <option key={p} value={p}>
                  Periode {p}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 sm:col-span-1 lg:col-span-2">
            <Label
              htmlFor="search-anomali"
              className="text-xs font-semibold text-slate-700"
            >
              Cari ID Pelanggan / Nama Pelanggan
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400"
                strokeWidth={1.75}
              />
              <Input
                id="search-anomali"
                type="text"
                placeholder="Masukkan 12 digit ID Pelanggan atau nama..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 rounded-md border-slate-300 pl-9 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            size="sm"
            className="h-9 rounded-md bg-sky-600 px-3.5 text-xs font-semibold text-white hover:bg-sky-700"
          >
            <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Terapkan Filter</span>
          </Button>
          {(activePeriode !== "ALL" || activeQuery !== "") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetFilter}
              className="h-9 rounded-md border-slate-300 text-xs font-medium text-slate-700"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </form>

      {/* Toolbar Pemetaan Massal */}
      {items.length > 0 && (
        <div className="flex flex-col justify-between gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-6 items-center rounded-md border border-slate-300 bg-slate-100 px-2.5 font-mono text-xs font-semibold text-slate-900 tabular-nums">
              {validSelectedIds.length} Terpilih
            </span>
            <p className="text-xs text-slate-600">
              Pemetaan Massal: pilih baris di tabel lalu tetapkan Petugas
              Lapangan dan Kode Unit ULP.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <label
                htmlFor="bulk-petugas-select"
                className="text-xs font-semibold whitespace-nowrap text-slate-700"
              >
                Petugas Tujuan:
              </label>
              <select
                id="bulk-petugas-select"
                value={bulkPetugasId}
                onChange={(e) => setBulkPetugasId(e.target.value)}
                className="h-9 min-w-[200px] rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              >
                {petugasList.length === 0 ? (
                  <option value="">Tidak ada petugas aktif</option>
                ) : (
                  petugasList.map((ptg) => (
                    <option key={ptg.id} value={ptg.id}>
                      {ptg.nama} (@{ptg.username})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="bulk-kode-unit"
                className="text-xs font-semibold whitespace-nowrap text-slate-700"
              >
                Kode Unit:
              </label>
              <Input
                id="bulk-kode-unit"
                type="text"
                value={bulkKodeUnit}
                onChange={(e) => setBulkKodeUnit(e.target.value)}
                maxLength={10}
                className="h-9 w-24 rounded-md border-slate-300 font-mono text-xs tabular-nums"
              />
            </div>

            <Button
              type="button"
              size="sm"
              disabled={
                validSelectedIds.length === 0 ||
                isBulkSubmitting ||
                petugasList.length === 0
              }
              onClick={handleBulkSubmit}
              className="h-9 rounded-md bg-sky-600 px-3.5 text-xs font-semibold text-white hover:bg-sky-700"
            >
              {isBulkSubmitting ? (
                <>
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <UserCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Terapkan ke Terpilih ({validSelectedIds.length})</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Tabel Karantina Anomali atau State Kosong Formal */}
      {items.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-white p-10 text-center shadow-xs">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-900">
            Antrean Karantina Anomali Bersih
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            Tidak ditemukan rekaman piutang berstatus Unassigned, tanpa kode
            unit, atau tanpa penugasan petugas lapangan pada kriteria filter saat
            ini.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-slate-200 bg-white shadow-xs">
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua baris anomali"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600"
                    />
                  </th>
                  <th className="px-4 py-3">ID Pelanggan</th>
                  <th className="px-4 py-3">Nama & Alamat</th>
                  <th className="px-4 py-3">Periode</th>
                  <th className="px-4 py-3">Tarif / Daya</th>
                  <th className="px-4 py-3">Kode Unit</th>
                  <th className="px-4 py-3 text-right">Lbr</th>
                  <th className="px-4 py-3 text-right">Nilai Tagihan</th>
                  <th className="px-4 py-3">Indikasi Anomali</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Update Terakhir</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item) => {
                  const isChecked = validSelectedIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={
                        isChecked
                          ? "bg-sky-50/60 hover:bg-sky-50"
                          : "hover:bg-slate-50/80"
                      }
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Pilih pelanggan ${item.idPelanggan}`}
                          checked={isChecked}
                          onChange={() => toggleSelectOne(item.id)}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900 tabular-nums">
                        {item.idPelanggan}
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {item.pelanggan.namaPelanggan}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                          {item.pelanggan.alamat}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 tabular-nums">
                        {item.periode}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700 tabular-nums">
                        <span className="font-semibold text-slate-900">
                          {item.pelanggan.tarif}
                        </span>{" "}
                        / {formatDaya(item.pelanggan.daya)}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums">
                        {item.pelanggan.kodeUnit ? (
                          <span className="font-medium text-slate-800">
                            {item.pelanggan.kodeUnit}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            KOSONG
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800 tabular-nums">
                        {item.jumlahLembar}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-slate-900 tabular-nums">
                        {formatRupiah(item.nilaiTagihan)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-red-700">
                          {getAnomalyReasonText(item)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.statusRekonsiliasi} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 tabular-nums">
                        {formatTanggalWib(item.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openSingleDialog(item)}
                          className="h-8 rounded-md border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                        >
                          <UserCheck
                            className="h-3.5 w-3.5 text-sky-600"
                            strokeWidth={1.75}
                          />
                          <span>Petakan</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog Pemetaan Satuan */}
      <Dialog
        open={Boolean(singleTarget)}
        onOpenChange={(open) => {
          if (!open) setSingleTarget(null);
        }}
      >
        <DialogContent className="rounded-md border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-900">
              Pemetaan Anomali Piutang Pelanggan
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Tetapkan petugas lapangan aktif dan kode unit untuk melepaskan
              status karantina menjadi Belum Tertagih.
            </DialogDescription>
          </DialogHeader>

          {singleTarget && (
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ID Pelanggan:</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {singleTarget.idPelanggan}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-500">Nama Pelanggan:</span>
                  <span className="font-semibold text-slate-900">
                    {singleTarget.pelanggan.namaPelanggan}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-500">Periode / Tagihan:</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {singleTarget.periode} •{" "}
                    {formatRupiah(singleTarget.nilaiTagihan)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="single-petugas"
                  className="text-xs font-semibold text-slate-700"
                >
                  Pilih Petugas Lapangan Aktif
                </Label>
                <select
                  id="single-petugas"
                  value={singlePetugasId}
                  onChange={(e) => setSinglePetugasId(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                >
                  {petugasList.map((ptg) => (
                    <option key={ptg.id} value={ptg.id}>
                      {ptg.nama} (@{ptg.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="single-kode-unit"
                  className="text-xs font-semibold text-slate-700"
                >
                  Kode Unit Layanan Pelanggan
                </Label>
                <Input
                  id="single-kode-unit"
                  type="text"
                  value={singleKodeUnit}
                  onChange={(e) => setSingleKodeUnit(e.target.value)}
                  maxLength={10}
                  required
                  className="h-9 rounded-md border-slate-300 font-mono text-xs tabular-nums"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSingleTarget(null)}
                  className="h-9 rounded-md border-slate-300 text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSingleSubmitting || petugasList.length === 0}
                  className="h-9 rounded-md bg-sky-600 px-4 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  {isSingleSubmitting ? (
                    <>
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        strokeWidth={1.75}
                      />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                      <span>Simpan Pemetaan</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
