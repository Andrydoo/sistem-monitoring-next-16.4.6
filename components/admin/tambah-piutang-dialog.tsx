"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  Plus,
  Search,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPiutangManualAction,
  lookupPelangganAction,
} from "@/app/admin/actions";
import { formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface TambahPiutangDialogProps {
  petugasList: Array<{ id: number; nama: string; username: string }>;
  defaultPeriode?: string;
}

const UNASSIGNED_PETUGAS_VALUE = "__UNASSIGNED__";
const PERIODE_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const TARIF_PLN_OPTIONS = [
  "R1",
  "R1M",
  "R2",
  "R3",
  "B1",
  "B2",
  "I1",
  "S2",
] as const;

const DAYA_PLN_OPTIONS = [
  450, 900, 1300, 2200, 3500, 4400, 5500, 6600, 7700, 10600, 13200, 16500,
  23000, 33000,
] as const;

function resolveInitialPeriode(defaultPeriode?: string): string {
  if (defaultPeriode && PERIODE_REGEX.test(defaultPeriode.trim())) {
    return defaultPeriode.trim();
  }

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());

    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    if (year && month) {
      const candidate = `${year}-${month}`;
      if (PERIODE_REGEX.test(candidate)) {
        return candidate;
      }
    }
  } catch {
    // Fallback ke periode standar
  }

  return "2026-09";
}

export function TambahPiutangDialog({
  petugasList,
  defaultPeriode,
}: TambahPiutangDialogProps) {
  const router = useRouter();
  const initialPeriode = React.useMemo(
    () => resolveInitialPeriode(defaultPeriode),
    [defaultPeriode]
  );

  const [open, setOpen] = React.useState(false);

  // Bagian 1 — Identitas Pelanggan
  const [idPelanggan, setIdPelanggan] = React.useState("");
  const [namaPelanggan, setNamaPelanggan] = React.useState("");
  const [tarif, setTarif] = React.useState("");
  const [daya, setDaya] = React.useState("");
  const [kodeUnit, setKodeUnit] = React.useState("51304");
  const [alamat, setAlamat] = React.useState("");

  // Bagian 2 — Rincian Tagihan & Penugasan
  const [periode, setPeriode] = React.useState(initialPeriode);
  const [jumlahLembar, setJumlahLembar] = React.useState("1");
  const [nilaiTagihan, setNilaiTagihan] = React.useState("");
  const [idPetugas, setIdPetugas] = React.useState<string>(
    UNASSIGNED_PETUGAS_VALUE
  );

  // Lookup & Submit state
  const [isLookingUp, setIsLookingUp] = React.useState(false);
  const [lookupStatus, setLookupStatus] = React.useState<
    "idle" | "found" | "not_found"
  >("idle");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const resetForm = React.useCallback(() => {
    setIdPelanggan("");
    setNamaPelanggan("");
    setTarif("");
    setDaya("");
    setKodeUnit("51304");
    setAlamat("");
    setPeriode(resolveInitialPeriode(defaultPeriode));
    setJumlahLembar("1");
    setNilaiTagihan("");
    setIdPetugas(UNASSIGNED_PETUGAS_VALUE);
    setLookupStatus("idle");
    setFormError(null);
  }, [defaultPeriode]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setPeriode(resolveInitialPeriode(defaultPeriode));
      setFormError(null);
    } else {
      resetForm();
    }
  };

  const handleIdPelangganChange = (value: string) => {
    const cleaned = value.replace(/[^\d]/g, "").slice(0, 20);
    setIdPelanggan(cleaned);
    if (lookupStatus !== "idle") {
      setLookupStatus("idle");
    }
    if (formError) setFormError(null);
  };

  const handleLookupPelanggan = async () => {
    const cleaned = idPelanggan.replace(/\s+/g, "").trim();
    if (!/^\d{8,20}$/.test(cleaned)) {
      const msg =
        "Masukkan 8 hingga 20 digit ID Pelanggan terlebih dahulu sebelum mengecek data.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    setFormError(null);
    setIsLookingUp(true);
    try {
      const result = await lookupPelangganAction(cleaned);
      if (result.found) {
        setNamaPelanggan(result.pelanggan.namaPelanggan);
        setAlamat(result.pelanggan.alamat);
        setTarif(result.pelanggan.tarif);
        setDaya(String(result.pelanggan.daya));
        setKodeUnit(result.pelanggan.kodeUnit ?? "");
        setLookupStatus("found");
        toast.success("Pelanggan ditemukan — identitas diisi otomatis.");
      } else {
        setLookupStatus("not_found");
        toast.info(
          "ID Pelanggan belum terdaftar. Silakan lengkapi identitas pelanggan baru."
        );
      }
    } catch {
      toast.error("Gagal memeriksa ID Pelanggan ke basis data.");
    } finally {
      setIsLookingUp(false);
    }
  };

  const parsedTagihanPreview = React.useMemo(() => {
    const digits = nilaiTagihan.replace(/[^\d]/g, "");
    if (!digits) {
      return "Rp 0";
    }
    try {
      return formatRupiah(BigInt(digits));
    } catch {
      return "Rp 0";
    }
  }, [nilaiTagihan]);

  const isPetugasUnassigned = idPetugas === UNASSIGNED_PETUGAS_VALUE;
  const isKodeUnitEmpty = kodeUnit.trim().length === 0;
  const willBeUnassigned = isPetugasUnassigned || isKodeUnitEmpty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanedIdpel = idPelanggan.replace(/\s+/g, "").trim();
    if (!/^\d{8,20}$/.test(cleanedIdpel)) {
      setFormError(
        "ID Pelanggan harus berupa 8 hingga 20 digit angka (direkomendasikan 12 digit IDPEL PLN)."
      );
      return;
    }

    if (namaPelanggan.trim().length < 2) {
      setFormError("Nama pelanggan wajib diisi minimal 2 karakter.");
      return;
    }

    if (tarif.trim().length < 1 || tarif.trim().length > 10) {
      setFormError("Golongan tarif wajib diisi (maksimal 10 karakter).");
      return;
    }

    const parsedDaya = Number.parseInt(daya.trim(), 10);
    if (!Number.isInteger(parsedDaya) || parsedDaya <= 0) {
      setFormError("Daya (VA) harus berupa bilangan bulat positif.");
      return;
    }

    if (kodeUnit.trim().length > 10) {
      setFormError("Kode Unit maksimal 10 karakter.");
      return;
    }

    if (alamat.trim().length < 5) {
      setFormError("Alamat lengkap pelanggan minimal 5 karakter.");
      return;
    }

    if (!PERIODE_REGEX.test(periode.trim())) {
      setFormError("Format periode wajib YYYY-MM (contoh: 2026-09).");
      return;
    }

    const parsedLembar = Number.parseInt(jumlahLembar.trim(), 10);
    if (!Number.isInteger(parsedLembar) || parsedLembar < 1) {
      setFormError("Jumlah lembar tagihan minimal 1.");
      return;
    }

    const cleanedTagihan = nilaiTagihan.replace(/[^\d]/g, "");
    if (!cleanedTagihan || BigInt(cleanedTagihan) <= BigInt(0)) {
      setFormError("Nilai tagihan harus lebih besar dari Rp 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createPiutangManualAction({
        idPelanggan: cleanedIdpel,
        namaPelanggan: namaPelanggan.trim(),
        alamat: alamat.trim(),
        tarif: tarif.trim().toUpperCase(),
        daya: parsedDaya,
        kodeUnit: kodeUnit.trim(),
        periode: periode.trim(),
        jumlahLembar: parsedLembar,
        nilaiTagihan: cleanedTagihan,
        idPetugas:
          idPetugas === UNASSIGNED_PETUGAS_VALUE
            ? null
            : Number.parseInt(idPetugas, 10),
      });

      if (!result.success) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success(result.message);
      setOpen(false);
      resetForm();
      router.refresh();
    } catch {
      const msg = "Terjadi kesalahan jaringan saat menyimpan data piutang.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          className="h-9 rounded-md bg-sky-600 px-3.5 text-xs font-semibold text-white hover:bg-sky-700"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          <span>Tambah Data</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-md border-slate-200 bg-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-slate-900">
            Tambah Data Pelanggan & Piutang Manual
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600">
            Input data tunggakan pelanggan baru atau periode tunggakan tambahan
            di luar proses impor Excel TUL III-09.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                strokeWidth={1.75}
              />
              <span>{formError}</span>
            </div>
          )}

          {/* Bagian 1 — Identitas Pelanggan */}
          <section className="space-y-3.5 rounded-md border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
              <UserCheck
                className="h-4 w-4 text-sky-600"
                strokeWidth={1.75}
              />
              <h2 className="text-xs font-semibold tracking-wide text-slate-800 uppercase">
                Bagian 1 — Identitas Pelanggan
              </h2>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="manual-idpel"
                className="text-xs font-semibold text-slate-700"
              >
                ID Pelanggan (12 Digit) <span className="text-red-600">*</span>
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="manual-idpel"
                  type="text"
                  inputMode="numeric"
                  placeholder="Contoh: 513040123456"
                  value={idPelanggan}
                  onChange={(e) => handleIdPelangganChange(e.target.value)}
                  maxLength={20}
                  required
                  className="h-9 flex-1 rounded-md border-slate-300 bg-white font-mono text-xs tabular-nums"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLookupPelanggan}
                  disabled={isLookingUp || idPelanggan.trim().length < 8}
                  className="h-9 shrink-0 rounded-md border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  {isLookingUp ? (
                    <>
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        strokeWidth={1.75}
                      />
                      <span>Memeriksa...</span>
                    </>
                  ) : (
                    <>
                      <Search
                        className="h-3.5 w-3.5 text-sky-600"
                        strokeWidth={1.75}
                      />
                      <span>Cek IDPEL</span>
                    </>
                  )}
                </Button>
              </div>

              {lookupStatus === "found" && (
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-sky-700">
                  <CheckCircle2
                    className="h-3.5 w-3.5 shrink-0 text-sky-600"
                    strokeWidth={1.75}
                  />
                  <span>Pelanggan sudah terdaftar — data diisi otomatis.</span>
                </p>
              )}

              {lookupStatus === "not_found" && (
                <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <Info
                    className="h-3.5 w-3.5 shrink-0 text-slate-500"
                    strokeWidth={1.75}
                  />
                  <span>
                    ID Pelanggan belum ditemukan — akan dicatat sebagai
                    pelanggan baru.
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="manual-nama"
                className="text-xs font-semibold text-slate-700"
              >
                Nama Pelanggan <span className="text-red-600">*</span>
              </Label>
              <Input
                id="manual-nama"
                type="text"
                placeholder="Contoh: BUDI SANTOSO"
                value={namaPelanggan}
                onChange={(e) => {
                  setNamaPelanggan(e.target.value);
                  if (formError) setFormError(null);
                }}
                maxLength={150}
                required
                className="h-9 rounded-md border-slate-300 bg-white text-xs"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="manual-tarif"
                  className="text-xs font-semibold text-slate-700"
                >
                  Tarif <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="manual-tarif"
                  type="text"
                  list="tarif-pln-options"
                  placeholder="Contoh: R1M"
                  value={tarif}
                  onChange={(e) => {
                    setTarif(e.target.value.toUpperCase());
                    if (formError) setFormError(null);
                  }}
                  maxLength={10}
                  required
                  className="h-9 rounded-md border-slate-300 bg-white text-xs uppercase"
                />
                <datalist id="tarif-pln-options">
                  {TARIF_PLN_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="manual-daya"
                  className="text-xs font-semibold text-slate-700"
                >
                  Daya (VA) <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="manual-daya"
                  type="number"
                  inputMode="numeric"
                  list="daya-pln-options"
                  min={1}
                  step={1}
                  placeholder="Contoh: 900"
                  value={daya}
                  onChange={(e) => {
                    setDaya(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  required
                  className="h-9 rounded-md border-slate-300 bg-white text-xs tabular-nums"
                />
                <datalist id="daya-pln-options">
                  {DAYA_PLN_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="manual-kode-unit"
                  className="text-xs font-semibold text-slate-700"
                >
                  Kode Unit
                </Label>
                <Input
                  id="manual-kode-unit"
                  type="text"
                  placeholder="51304"
                  value={kodeUnit}
                  onChange={(e) => {
                    setKodeUnit(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  maxLength={10}
                  className="h-9 rounded-md border-slate-300 bg-white font-mono text-xs tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="manual-alamat"
                className="text-xs font-semibold text-slate-700"
              >
                Alamat Lengkap <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="manual-alamat"
                placeholder="Contoh: Jl. Panglima Sudirman No. 45, Kel. Patokan, Kec. Kraksaan"
                value={alamat}
                onChange={(e) => {
                  setAlamat(e.target.value);
                  if (formError) setFormError(null);
                }}
                rows={2}
                required
                className="min-h-16 rounded-md border-slate-300 bg-white text-xs md:text-xs"
              />
            </div>
          </section>

          {/* Bagian 2 — Rincian Tagihan & Penugasan */}
          <section className="space-y-3.5 rounded-md border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
              <FileText
                className="h-4 w-4 text-sky-600"
                strokeWidth={1.75}
              />
              <h2 className="text-xs font-semibold tracking-wide text-slate-800 uppercase">
                Bagian 2 — Rincian Tagihan & Penugasan
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="manual-periode"
                  className="text-xs font-semibold text-slate-700"
                >
                  Periode (YYYY-MM) <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="manual-periode"
                  type="text"
                  placeholder="2026-09"
                  value={periode}
                  onChange={(e) => {
                    setPeriode(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  maxLength={7}
                  required
                  className="h-9 rounded-md border-slate-300 bg-white font-mono text-xs tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="manual-lembar"
                  className="text-xs font-semibold text-slate-700"
                >
                  Jumlah Lembar <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="manual-lembar"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={jumlahLembar}
                  onChange={(e) => {
                    setJumlahLembar(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  required
                  className="h-9 rounded-md border-slate-300 bg-white text-xs tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="manual-tagihan"
                  className="text-xs font-semibold text-slate-700"
                >
                  Nilai Tagihan (Rp) <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="manual-tagihan"
                  type="text"
                  inputMode="numeric"
                  placeholder="Contoh: 450000"
                  value={nilaiTagihan}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/[^\d]/g, "");
                    setNilaiTagihan(digitsOnly);
                    if (formError) setFormError(null);
                  }}
                  required
                  className="h-9 rounded-md border-slate-300 bg-white text-xs tabular-nums"
                />
                <p className="text-[11px] font-medium text-slate-600 tabular-nums">
                  Pratinjau:{" "}
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {parsedTagihanPreview}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="manual-petugas"
                className="text-xs font-semibold text-slate-700"
              >
                Petugas Penagihan
              </Label>
              <Select
                value={idPetugas}
                onValueChange={(value) => {
                  setIdPetugas(value);
                  if (formError) setFormError(null);
                }}
              >
                <SelectTrigger
                  id="manual-petugas"
                  className="h-9 w-full rounded-md border-slate-300 bg-white text-xs text-slate-900"
                >
                  <SelectValue placeholder="-- Belum Ditentukan (Masuk Anomali UNASSIGNED) --" />
                </SelectTrigger>
                <SelectContent className="rounded-md border-slate-200 bg-white">
                  <SelectItem
                    value={UNASSIGNED_PETUGAS_VALUE}
                    className="text-xs"
                  >
                    -- Belum Ditentukan (Masuk Anomali UNASSIGNED) --
                  </SelectItem>
                  {petugasList.map((ptg) => (
                    <SelectItem
                      key={ptg.id}
                      value={String(ptg.id)}
                      className="text-xs"
                    >
                      {ptg.nama} (@{ptg.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {willBeUnassigned && (
              <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                  strokeWidth={1.75}
                />
                <div className="space-y-0.5">
                  <p className="font-semibold text-amber-900">
                    Peringatan Status Rekonsiliasi: UNASSIGNED
                  </p>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    {isKodeUnitEmpty && isPetugasUnassigned
                      ? "Kode Unit kosong dan Petugas Penagihan belum ditentukan."
                      : isKodeUnitEmpty
                        ? "Kode Unit dikosongkan."
                        : "Petugas Penagihan belum ditentukan."}{" "}
                    Data piutang akan disimpan dengan status{" "}
                    <span className="font-mono font-semibold">UNASSIGNED</span>{" "}
                    dan masuk otomatis ke Antrean Koreksi Admin untuk pemetaan
                    lebih lanjut.
                  </p>
                </div>
              </div>
            )}
          </section>

          <DialogFooter className="gap-2 border-t border-slate-200 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="h-9 rounded-md border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-9 rounded-md bg-sky-600 px-4 text-xs font-semibold text-white hover:bg-sky-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Simpan Data Piutang</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
