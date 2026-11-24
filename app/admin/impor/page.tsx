import { History, Upload } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { formatTanggalWib } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { AdminImporClient } from "@/components/admin/impor-client";

interface AuditImportPayload {
  fileName?: string;
  periodeList?: string[];
  totalRows?: number;
  processedRows?: number;
  insertedCount?: number;
  updatedCount?: number;
  anomaliCount?: number;
  autoLunasCount?: number;
  errorCount?: number;
}

export default async function AdminImporPage() {
  await requireRole(["ADMIN"]);

  const [pelangganCount, piutangCount, kinerjaCount, riwayatImpor] =
    await Promise.all([
      prisma.pelanggan.count(),
      prisma.piutang.count(),
      prisma.kinerjaPetugas.count(),
      prisma.auditLog.findMany({
        where: {
          entitas: {
            in: ["IMPOR_PIUTANG", "IMPOR_KINERJA"],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        include: {
          pengguna: {
            select: {
              nama: true,
              username: true,
            },
          },
        },
      }),
    ]);

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col justify-between gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sky-600">
            <Upload className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Integrasi Berkas TUL III-09 & Indikator Kinerja
            </p>
            <h1 className="mt-0.5 text-lg font-semibold text-slate-900">
              Impor Data Excel & Rekonsiliasi Saldo Piutang
            </h1>
            <p className="mt-0.5 text-xs text-slate-600">
              Unggah berkas kerja Excel (.xlsx) untuk pembaruan saldo piutang
              pelanggan, karantina anomali, dan evaluasi 7 indikator kinerja
              petugas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700">
            Master Pelanggan:{" "}
            <span className="font-semibold text-slate-900 tabular-nums">
              {pelangganCount.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700">
            Rekaman Piutang:{" "}
            <span className="font-semibold text-slate-900 tabular-nums">
              {piutangCount.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700">
            Rekap Kinerja:{" "}
            <span className="font-semibold text-slate-900 tabular-nums">
              {kinerjaCount.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Impor Piutang & Kinerja */}
      <AdminImporClient />

      {/* Tabel Riwayat Impor Terakhir (10 AuditLog Terakhir) */}
      <div className="rounded-md border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <History className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Riwayat Impor Terakhir
              </h2>
              <p className="text-xs text-slate-500">
                10 catatan audit terakhir dari proses impor Excel Piutang dan
                Kinerja Petugas
              </p>
            </div>
          </div>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 tabular-nums">
            {riwayatImpor.length} Log Tercatat
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
                <th className="px-4 py-3">Waktu Eksekusi</th>
                <th className="px-4 py-3">Jenis Impor</th>
                <th className="px-4 py-3">Nama Berkas</th>
                <th className="px-4 py-3">Periode</th>
                <th className="px-4 py-3 text-right">Diproses / Total</th>
                <th className="px-4 py-3 text-right">Baru / Update</th>
                <th className="px-4 py-3 text-right">Anomali</th>
                <th className="px-4 py-3 text-right">Auto-Lunas</th>
                <th className="px-4 py-3 text-right">Error</th>
                <th className="px-4 py-3">Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {riwayatImpor.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center text-xs text-slate-500"
                  >
                    Belum ada riwayat aktivitas impor Excel yang tercatat di
                    log audit.
                  </td>
                </tr>
              ) : (
                riwayatImpor.map((log) => {
                  const payload = (log.nilaiBaru ?? {}) as AuditImportPayload;
                  const isPiutang = log.entitas === "IMPOR_PIUTANG";

                  return (
                    <tr key={String(log.id)} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 tabular-nums">
                        {formatTanggalWib(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                            isPiutang
                              ? "border-sky-200 bg-sky-50 text-sky-700"
                              : "border-slate-300 bg-slate-100 text-slate-800"
                          }`}
                        >
                          {isPiutang ? "PIUTANG (12 KOL)" : "KINERJA (11 KOL)"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {payload.fileName ?? "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 tabular-nums">
                        {Array.isArray(payload.periodeList) &&
                        payload.periodeList.length > 0
                          ? payload.periodeList.join(", ")
                          : log.idRekaman}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800 tabular-nums">
                        {payload.processedRows ?? 0} / {payload.totalRows ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                        {payload.insertedCount ?? 0} /{" "}
                        {payload.updatedCount ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        <span
                          className={
                            (payload.anomaliCount ?? 0) > 0
                              ? "text-red-700"
                              : "text-slate-500"
                          }
                        >
                          {payload.anomaliCount ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700 tabular-nums">
                        {payload.autoLunasCount ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span
                          className={
                            (payload.errorCount ?? 0) > 0
                              ? "font-semibold text-amber-800"
                              : "text-slate-500"
                          }
                        >
                          {payload.errorCount ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {log.pengguna.nama}{" "}
                        <span className="font-mono text-slate-500 tabular-nums">
                          (@{log.pengguna.username})
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
