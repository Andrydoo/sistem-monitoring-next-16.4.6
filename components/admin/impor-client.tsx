"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  KINERJA_REQUIRED_HEADERS,
  PIUTANG_REQUIRED_HEADERS,
} from "@/lib/excel-helpers";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface ImportSummaryResult {
  totalRows: number;
  processedRows: number;
  insertedCount: number;
  updatedCount: number;
  anomaliCount: number;
  autoLunasCount: number;
  periodeList?: string[];
  errors: Array<{ row: number; reason: string }>;
}

function ImportTabPanel({
  type,
  title,
  subtitle,
  requiredHeaders,
  businessRules,
}: {
  type: "piutang" | "kinerja";
  title: string;
  subtitle: string;
  requiredHeaders: readonly string[];
  businessRules: Array<{ title: string; description: string }>;
}) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [missingHeaders, setMissingHeaders] = React.useState<string[]>([]);
  const [result, setResult] = React.useState<ImportSummaryResult | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setErrorMessage(null);
    setMissingHeaders([]);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setErrorMessage("Format berkas harus berekstensi .xlsx.");
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Ukuran berkas melebihi batas maksimal 10 MB.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleUploadSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Silakan pilih berkas .xlsx terlebih dahulu.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setMissingHeaders([]);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const endpoint =
        type === "piutang"
          ? "/api/admin/import/piutang"
          : "/api/admin/import/kinerja";

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(
          data.error ?? "Gagal memproses berkas Excel yang diunggah."
        );
        if (Array.isArray(data.missingHeaders)) {
          setMissingHeaders(data.missingHeaders);
        }
        toast.error(data.error ?? "Impor Excel gagal diproses.");
        return;
      }

      setResult(data as ImportSummaryResult);
      toast.success(
        `Impor ${type === "piutang" ? "Data Piutang" : "Indikator Kinerja"} selesai (${data.processedRows}/${data.totalRows} baris diproses).`
      );
      router.refresh();
    } catch {
      setErrorMessage(
        "Terjadi gangguan jaringan saat mengirim berkas ke server."
      );
      toast.error("Gagal menghubungi server.");
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const kb = Math.max(1, Math.round(bytes / 1024));
    return `${kb.toLocaleString("id-ID")} KB`;
  };

  return (
    <div className="space-y-5">
      {/* Kartu Aturan Bisnis & Unduh Templat */}
      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-9 shrink-0 rounded-md border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-100"
          >
            <a href={`/api/admin/templates/${type}`} download>
              <Download className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
              <span>Unduh Templat .xlsx</span>
            </a>
          </Button>
        </div>

        {/* Ringkasan Aturan Bisnis */}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {businessRules.map((rule) => (
            <div
              key={rule.title}
              className="rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-center gap-2">
                <Info
                  className="h-4 w-4 shrink-0 text-sky-600"
                  strokeWidth={1.75}
                />
                <p className="text-xs font-semibold text-slate-900">
                  {rule.title}
                </p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                {rule.description}
              </p>
            </div>
          ))}
        </div>

        {/* Daftar Kolom Wajib */}
        <div className="mt-4">
          <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            Spesifikasi Header Kolom Wajib (
            <span className="tabular-nums">{requiredHeaders.length}</span>{" "}
            Kolom)
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {requiredHeaders.map((header, idx) => (
              <span
                key={header}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-700 tabular-nums"
              >
                <span className="text-slate-400">{idx + 1}.</span>
                <span>{header}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Form Unggah File Excel */}
      <form
        onSubmit={handleUploadSubmit}
        className="rounded-md border border-slate-200 bg-white p-5 shadow-xs"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Unggah Berkas Kerja Excel (.xlsx)
            </h3>
            <p className="text-xs text-slate-500">
              Batas ukuran berkas maksimal 10 MB. Baris pertama wajib memuat
              seluruh nama header kolom.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-sky-600 shadow-xs">
              <FileSpreadsheet className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-800">
              Pilih berkas Excel (.xlsx) dari komputer Anda
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Pastikan format periode menggunakan standar YYYY-MM (contoh:
              2026-09)
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
              className="mt-4 block w-full max-w-md cursor-pointer rounded-md border border-slate-300 bg-white text-xs text-slate-700 file:mr-3 file:cursor-pointer file:rounded-none file:border-0 file:border-r file:border-slate-200 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-800 hover:file:bg-slate-200"
            />

            {selectedFile && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700">
                <CheckCircle2
                  className="h-3.5 w-3.5 text-emerald-600"
                  strokeWidth={1.75}
                />
                <span className="font-medium text-slate-900">
                  {selectedFile.name}
                </span>
                <span className="font-mono text-slate-500 tabular-nums">
                  ({formatFileSize(selectedFile.size)})
                </span>
              </div>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
            <div className="flex items-start gap-2.5">
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-red-700"
                strokeWidth={1.75}
              />
              <div className="space-y-1">
                <p className="font-semibold text-red-900">
                  Validasi Berkas Gagal
                </p>
                <p>{errorMessage}</p>
                {missingHeaders.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {missingHeaders.map((col) => (
                      <span
                        key={col}
                        className="rounded-md border border-red-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-red-700"
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
          {selectedFile && !isUploading && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedFile(null);
                setErrorMessage(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              className="h-9 rounded-md border-slate-300 text-xs font-medium text-slate-700"
            >
              Reset Pilihan
            </Button>
          )}
          <Button
            type="submit"
            disabled={!selectedFile || isUploading}
            className="h-9 rounded-md bg-sky-600 px-4 text-xs font-semibold text-white hover:bg-sky-700"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                <span>Memproses Berkas Excel...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" strokeWidth={1.75} />
                <span>Proses Impor Data</span>
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Panel Laporan Hasil Impor */}
      {result && (
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <CheckCircle2
                className="h-5 w-5 text-emerald-600"
                strokeWidth={1.75}
              />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Laporan Hasil Eksekusi Impor
                </h3>
                <p className="text-xs text-slate-500">
                  Periode Terdeteksi:{" "}
                  <span className="font-mono font-semibold text-slate-800 tabular-nums">
                    {result.periodeList && result.periodeList.length > 0
                      ? result.periodeList.join(", ")
                      : "-"}
                  </span>
                </p>
              </div>
            </div>

            {type === "piutang" && result.anomaliCount > 0 && (
              <Button
                asChild
                size="sm"
                className="h-9 rounded-md bg-red-600 px-3.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                <Link href="/admin/anomali">
                  <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
                  <span>
                    Buka Antrean Anomali ({result.anomaliCount} Baris)
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                </Link>
              </Button>
            )}
          </div>

          {/* Grid Metrik Hasil Impor */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Total Baris
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                {result.totalRows.toLocaleString("id-ID")}
              </p>
              <p className="text-[11px] text-slate-500">
                Baris data tidak kosong
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Berhasil Diproses
              </p>
              <p className="mt-1 text-lg font-semibold text-emerald-700 tabular-nums">
                {result.processedRows.toLocaleString("id-ID")}
              </p>
              <p className="text-[11px] text-slate-500 tabular-nums">
                {result.errors.length} baris gagal format
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Baru / Diperbarui
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                {result.insertedCount.toLocaleString("id-ID")} /{" "}
                {result.updatedCount.toLocaleString("id-ID")}
              </p>
              <p className="text-[11px] text-slate-500">
                Insert baru / Update upsert
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Masuk Antrean Anomali
              </p>
              <p
                className={`mt-1 text-lg font-semibold tabular-nums ${
                  result.anomaliCount > 0 ? "text-red-700" : "text-slate-900"
                }`}
              >
                {result.anomaliCount.toLocaleString("id-ID")}
              </p>
              <p className="text-[11px] text-slate-500">
                Karantina status UNASSIGNED
              </p>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Otomatis Lunas Resmi
              </p>
              <p className="mt-1 text-lg font-semibold text-emerald-700 tabular-nums">
                {result.autoLunasCount.toLocaleString("id-ID")}
              </p>
              <p className="text-[11px] text-slate-500">
                Rekonsiliasi saldo periode sama
              </p>
            </div>
          </div>

          {/* Tabel Error Baris jika ada */}
          {result.errors.length > 0 && (
            <div className="mt-5 rounded-md border border-red-200 bg-white">
              <div className="flex items-center justify-between border-b border-red-200 bg-red-50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertCircle
                    className="h-4 w-4 text-red-700"
                    strokeWidth={1.75}
                  />
                  <span className="text-xs font-semibold text-red-900">
                    Daftar Baris Gagal Validasi (Impor Parsial)
                  </span>
                </div>
                <span className="font-mono text-xs font-semibold text-red-800 tabular-nums">
                  {result.errors.length} Baris Dilewati
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
                      <th className="w-28 px-4 py-2.5">Nomor Baris</th>
                      <th className="px-4 py-2.5">Keterangan Kendala</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {result.errors.map((err, index) => (
                      <tr
                        key={`${err.row}-${index}`}
                        className="hover:bg-slate-50"
                      >
                        <td className="px-4 py-2 font-mono font-semibold text-red-700 tabular-nums">
                          Baris #{err.row}
                        </td>
                        <td className="px-4 py-2 text-slate-700">
                          {err.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminImporClient() {
  return (
    <Tabs defaultValue="piutang" className="w-full space-y-4">
      <TabsList className="h-10 w-full justify-start rounded-md border border-slate-200 bg-white p-1 sm:w-fit">
        <TabsTrigger
          value="piutang"
          className="rounded-md px-4 py-1.5 text-xs font-semibold data-[state=active]:bg-sky-600 data-[state=active]:text-white"
        >
          Impor Data Piutang (12 Kolom)
        </TabsTrigger>
        <TabsTrigger
          value="kinerja"
          className="rounded-md px-4 py-1.5 text-xs font-semibold data-[state=active]:bg-sky-600 data-[state=active]:text-white"
        >
          Impor 7 Indikator Kinerja (11 Kolom)
        </TabsTrigger>
      </TabsList>

      <TabsContent value="piutang">
        <ImportTabPanel
          type="piutang"
          title="Impor Data Piutang Pelanggan TUL III-09 (12 Kolom Wajib)"
          subtitle="Pembaruan daftar tunggakan pelanggan bulanan beserta rekonsiliasi otomatis tiga status."
          requiredHeaders={PIUTANG_REQUIRED_HEADERS}
          businessRules={[
            {
              title: "1. Upsert (id_pelanggan + periode)",
              description:
                "Memperbarui jumlah lembar dan nilai tagihan pelanggan tanpa menghapus progres penagihan lapangan yang sedang berjalan.",
            },
            {
              title: "2. Karantina Anomali (UNASSIGNED)",
              description:
                "Baris dengan username_petugas kosong/tidak terdaftar atau kode_unit kosong otomatis dikarantina ke Antrean Koreksi Admin.",
            },
            {
              title: "3. Deteksi Otomatis LUNAS_RESMI",
              description:
                "Saat impor ulang pada periode sama, pelanggan yang tidak lagi muncul di Excel terbaru otomatis ditandai Lunas Resmi & pengingatnya diselesaikan.",
            },
          ]}
        />
      </TabsContent>

      <TabsContent value="kinerja">
        <ImportTabPanel
          type="kinerja"
          title="Impor Rekap 7 Indikator Kinerja Petugas (11 Kolom Wajib)"
          subtitle="Sinkronisasi capaian saldo akhir, transaksi PLN Mobile, migrasi prabayar, promo tematik, dan PRR."
          requiredHeaders={KINERJA_REQUIRED_HEADERS}
          businessRules={[
            {
              title: "1. Kunci Unik (id_petugas + periode)",
              description:
                "Menggunakan mekanisme upsert per petugas per periode YYYY-MM sehingga aman dijalankan berulang kali untuk pembaruan data.",
            },
            {
              title: "2. Pencocokan Username Petugas",
              description:
                "Kolom username_petugas wajib merujuk pada akun pengguna berstatus peran PETUGAS di basis data ULP Kraksaan.",
            },
            {
              title: "3. Konversi Rupiah & Integer Aman",
              description:
                "Mendukung sel numerik murni, rumus Excel, maupun teks nominal berformat Rupiah untuk ke-7 indikator kinerja.",
            },
          ]}
        />
      </TabsContent>
    </Tabs>
  );
}
