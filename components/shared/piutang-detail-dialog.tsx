"use client";

import * as React from "react";
import {
  AlertCircle,
  CalendarClock,
  ExternalLink,
  History,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Navigation,
  UserCheck,
  Zap,
} from "lucide-react";
import type { PiutangMonitoringDetail } from "@/lib/dashboard-queries";
import { formatDaya, formatRupiah, formatTanggalWib } from "@/lib/format";
import {
  formatTanggalDateOnlyId,
  RENTANG_JANJI_BAYAR_LABEL_MAP,
} from "@/lib/janji-bayar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface PiutangDetailDialogProps {
  piutangId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EvidenceLightboxState {
  url: string;
  jenisEvidence: string;
  subtitle: string;
}

const KATEGORI_LABEL_MAP: Record<string, string> = {
  KENDALI_PETUGAS: "Kendali Petugas",
  DI_LUAR_KENDALI_PETUGAS: "Di Luar Kendali Petugas",
};

export function PiutangDetailDialog({
  piutangId,
  open,
  onOpenChange,
}: PiutangDetailDialogProps) {
  const [detail, setDetail] = React.useState<PiutangMonitoringDetail | null>(
    null
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [lightbox, setLightbox] = React.useState<EvidenceLightboxState | null>(
    null
  );

  React.useEffect(() => {
    if (!open || piutangId === null) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function fetchDetail() {
      setIsLoading(true);
      setErrorMessage(null);
      setDetail(null);

      try {
        const response = await fetch(`/api/monitoring/piutang/${piutangId}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json()) as {
          data?: PiutangMonitoringDetail;
          error?: string;
        };

        if (!active) return;

        if (!response.ok || !payload.data) {
          setErrorMessage(
            payload.error ?? "Gagal memuat detail piutang pelanggan."
          );
          return;
        }

        setDetail(payload.data);
      } catch (error) {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setErrorMessage(
          "Terjadi gangguan jaringan saat memuat detail piutang."
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void fetchDetail();

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, piutangId]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setLightbox(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-md border-slate-200 bg-white p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-left">
            <div className="flex flex-wrap items-center gap-2 pr-6">
              <DialogTitle className="text-base font-semibold text-slate-900">
                Inspeksi Detail Piutang & Bukti Lapangan
              </DialogTitle>
              {detail && <StatusBadge status={detail.statusRekonsiliasi} />}
            </div>
            <DialogDescription className="text-xs text-slate-600">
              {detail ? (
                <>
                  ID Pelanggan{" "}
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {detail.idPelanggan}
                  </span>{" "}
                  • Periode{" "}
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {detail.periode}
                  </span>{" "}
                  • Mode Inspeksi Read-Only
                </>
              ) : (
                "Riwayat multi-kunjungan penagihan, verifikasi GPS, dan foto evidence privat."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {isLoading && (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-xs text-slate-600">
                <Loader2
                  className="h-5 w-5 animate-spin text-sky-600"
                  strokeWidth={1.75}
                />
                <span>Memuat data piutang dan riwayat kunjungan...</span>
              </div>
            )}

            {!isLoading && errorMessage && (
              <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                  strokeWidth={1.75}
                />
                <div>
                  <p className="font-semibold">Gagal Memuat Data</p>
                  <p className="mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            {!isLoading && detail && (
              <>
                {/* Ringkasan Identitas Pelanggan & Tagihan */}
                <section className="rounded-md border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Zap
                        className="h-4 w-4 text-sky-600"
                        strokeWidth={1.75}
                      />
                      <h3 className="text-xs font-semibold tracking-wider text-slate-700 uppercase">
                        Ringkasan Pelanggan & Piutang
                      </h3>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      Diperbarui: {formatTanggalWib(detail.updatedAt)}
                    </span>
                  </div>

                  <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">
                        ID Pelanggan (12 Digit)
                      </p>
                      <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                        {detail.pelanggan.idPelanggan}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-500">
                        Nama Pelanggan
                      </p>
                      <p className="mt-0.5 font-semibold text-slate-900">
                        {detail.pelanggan.namaPelanggan}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-500">
                        Tarif / Daya • Kode Unit
                      </p>
                      <p className="mt-0.5 font-medium text-slate-900 tabular-nums">
                        {detail.pelanggan.tarif} /{" "}
                        {formatDaya(detail.pelanggan.daya)} • Unit{" "}
                        <span className="font-mono">
                          {detail.pelanggan.kodeUnit ?? "-"}
                        </span>
                      </p>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-3">
                      <p className="text-[11px] font-medium text-slate-500">
                        Alamat Pelanggan
                      </p>
                      <p className="mt-0.5 text-slate-800">
                        {detail.pelanggan.alamat}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-500">
                        Periode & Lembar
                      </p>
                      <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                        {detail.periode} • {detail.jumlahLembar} Lembar
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-500">
                        Nilai Tagihan Piutang
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">
                        {formatRupiah(detail.nilaiTagihan)}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-slate-500">
                        Petugas Penanggung Jawab
                      </p>
                      {detail.petugas ? (
                        <p className="mt-0.5 font-medium text-slate-900">
                          {detail.petugas.nama}{" "}
                          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                            (@{detail.petugas.username})
                          </span>
                        </p>
                      ) : (
                        <p className="mt-0.5 font-semibold text-red-700">
                          Belum Dipetakan (Unassigned)
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                {/* Timeline Riwayat Multi-Kunjungan Lapangan */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <History
                        className="h-4 w-4 text-sky-600"
                        strokeWidth={1.75}
                      />
                      <h3 className="text-xs font-semibold tracking-wider text-slate-700 uppercase">
                        Riwayat Multi-Kunjungan Lapangan
                      </h3>
                    </div>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 tabular-nums">
                      {detail.riwayatPenagihan.length} Kunjungan
                    </span>
                  </div>

                  {detail.riwayatPenagihan.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
                      Belum ada laporan kunjungan lapangan yang tercatat untuk
                      rekaman piutang ini.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {detail.riwayatPenagihan.map((visit, index) => {
                        const visitNumber =
                          detail.riwayatPenagihan.length - index;
                        const hasGps =
                          visit.latitude !== null && visit.longitude !== null;

                        return (
                          <article
                            key={visit.id}
                            className="space-y-3 rounded-md border border-slate-200 bg-white p-4 shadow-xs"
                          >
                            {/* Header Kunjungan */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800 tabular-nums">
                                  Kunjungan #{visitNumber}
                                </span>
                                <StatusBadge
                                  status={visit.bentukPenyelesaian}
                                />
                                <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                  {KATEGORI_LABEL_MAP[
                                    visit.kategoriPelanggan
                                  ] ?? visit.kategoriPelanggan}
                                </span>
                              </div>

                              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                                {formatTanggalWib(visit.waktuInput)}
                              </span>
                            </div>

                            {/* Penginput & Catatan Kendala */}
                            <div className="grid gap-3 text-xs sm:grid-cols-2">
                              <div className="flex items-start gap-2">
                                <UserCheck
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500"
                                  strokeWidth={1.75}
                                />
                                <div>
                                  <p className="text-[11px] text-slate-500">
                                    Petugas Penginput
                                  </p>
                                  <p className="font-medium text-slate-900">
                                    {visit.petugas.nama}{" "}
                                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                                      (@{visit.petugas.username})
                                    </span>
                                  </p>
                                </div>
                              </div>

                              <div>
                                <p className="text-[11px] text-slate-500">
                                  Catatan Kendala / Hasil Lapangan
                                </p>
                                <p className="mt-0.5 leading-relaxed text-slate-800">
                                  {visit.catatanKendala?.trim() || "-"}
                                </p>
                              </div>
                            </div>

                            {/* Rentang Janji Bayar & Pengingat */}
                            {(visit.rentangJanjiBayar || visit.pengingat) && (
                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs">
                                <div className="flex items-center gap-2 text-amber-950">
                                  <CalendarClock
                                    className="h-4 w-4 shrink-0 text-amber-700"
                                    strokeWidth={1.75}
                                  />
                                  <div>
                                    <span className="font-semibold">
                                      Janji Bayar:{" "}
                                    </span>
                                    <span>
                                      {visit.rentangJanjiBayar
                                        ? RENTANG_JANJI_BAYAR_LABEL_MAP[
                                            visit.rentangJanjiBayar
                                          ]
                                        : "-"}
                                    </span>
                                    {visit.pengingat && (
                                      <span className="ml-2 font-mono text-[11px] text-amber-800 tabular-nums">
                                        (
                                        {formatTanggalDateOnlyId(
                                          visit.pengingat.tanggalMulaiRentang
                                        )}{" "}
                                        –{" "}
                                        {formatTanggalDateOnlyId(
                                          visit.pengingat.tanggalJatuhTempo
                                        )}
                                        )
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {visit.pengingat && (
                                  <StatusBadge
                                    status={visit.pengingat.statusPengingat}
                                  />
                                )}
                              </div>
                            )}

                            {/* Koordinat GPS / Fallback Alasan GPS */}
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                              {hasGps ? (
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 text-slate-700">
                                    <Navigation
                                      className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                                      strokeWidth={1.75}
                                    />
                                    <span>Koordinat GPS Terkunci:</span>
                                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                                      {visit.latitude}, {visit.longitude}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2 text-amber-900">
                                  <MapPin
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
                                    strokeWidth={1.75}
                                  />
                                  <div>
                                    <span className="font-semibold">
                                      Kendala GPS (Fallback):{" "}
                                    </span>
                                    <span className="text-slate-700">
                                      {visit.alasanKendalaGps?.trim() || "-"}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Galeri Foto Evidence Privat */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                <ImageIcon
                                  className="h-3.5 w-3.5 text-sky-600"
                                  strokeWidth={1.75}
                                />
                                <span>
                                  Foto Evidence Privat (
                                  {visit.daftarEvidence.length})
                                </span>
                              </div>

                              {visit.daftarEvidence.length === 0 ? (
                                <p className="text-[11px] text-slate-500">
                                  Tidak ada lampiran foto evidence pada
                                  kunjungan ini.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                  {visit.daftarEvidence.map((ev) => {
                                    const evidenceUrl = `/api/evidence/${ev.id}`;
                                    const subtitle = `${ev.fileSizeKb ?? 0} KB • Diunggah ${formatTanggalWib(ev.uploadedAt)}`;

                                    return (
                                      <div
                                        key={ev.id}
                                        className="overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setLightbox({
                                              url: evidenceUrl,
                                              jenisEvidence: ev.jenisEvidence,
                                              subtitle,
                                            })
                                          }
                                          className="block w-full cursor-pointer overflow-hidden bg-slate-100 text-left focus:outline-none"
                                        >
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={evidenceUrl}
                                            alt={`Foto Evidence ${ev.jenisEvidence} #${ev.id}`}
                                            className="h-36 w-full object-cover transition-opacity hover:opacity-90"
                                          />
                                        </button>

                                        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2 text-[11px]">
                                          <div className="min-w-0">
                                            <p className="font-semibold text-slate-900">
                                              {ev.jenisEvidence}
                                            </p>
                                            <p className="truncate font-mono text-[10px] text-slate-500 tabular-nums">
                                              {ev.fileSizeKb ?? "-"} KB •{" "}
                                              {formatTanggalWib(ev.uploadedAt)}
                                            </p>
                                          </div>

                                          <div className="flex shrink-0 items-center gap-1.5">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() =>
                                                setLightbox({
                                                  url: evidenceUrl,
                                                  jenisEvidence:
                                                    ev.jenisEvidence,
                                                  subtitle,
                                                })
                                              }
                                              className="h-7 rounded-md border-slate-300 px-2 text-[11px] font-medium text-slate-700"
                                            >
                                              Perbesar
                                            </Button>
                                            <a
                                              href={evidenceUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              aria-label={`Buka foto evidence ${ev.jenisEvidence} ukuran penuh di tab baru`}
                                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                                            >
                                              <ExternalLink
                                                className="h-3.5 w-3.5"
                                                strokeWidth={1.75}
                                              />
                                            </a>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-5 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              className="h-8 rounded-md border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700"
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Pratinjau Foto Ukuran Penuh */}
      <Dialog
        open={lightbox !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setLightbox(null);
        }}
      >
        <DialogContent className="rounded-md border-slate-200 bg-white p-4 sm:max-w-2xl">
          <DialogHeader className="text-left">
            <DialogTitle className="text-sm font-semibold text-slate-900">
              Foto Evidence {lightbox?.jenisEvidence ?? ""}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-slate-500 tabular-nums">
              {lightbox?.subtitle ?? ""}
            </DialogDescription>
          </DialogHeader>

          {lightbox && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lightbox.url}
                  alt={`Pratinjau Penuh ${lightbox.jenisEvidence}`}
                  className="max-h-[70vh] w-full object-contain"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <a
                  href={lightbox.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Buka di Tab Baru</span>
                </a>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLightbox(null)}
                  className="h-8 rounded-md border-slate-300 px-3 text-xs font-semibold text-slate-700"
                >
                  Tutup Pratinjau
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
