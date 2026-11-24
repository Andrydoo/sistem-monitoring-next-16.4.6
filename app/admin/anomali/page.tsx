import { Prisma } from "@prisma/client";
import { AlertTriangle, FileSpreadsheet, Users } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { formatRupiah } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  AdminAnomaliClient,
  type AnomaliRowItem,
} from "@/components/admin/anomali-client";

export default async function AdminAnomaliPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; q?: string }>;
}) {
  await requireRole(["ADMIN"]);

  const resolvedParams = await searchParams;
  const activePeriode = resolvedParams.periode?.trim() || "ALL";
  const activeQuery = resolvedParams.q?.trim() || "";

  const baseAnomaliConditions: Prisma.PiutangWhereInput[] = [
    { statusRekonsiliasi: "UNASSIGNED" },
    { idPetugas: null },
    { pelanggan: { kodeUnit: null } },
    { pelanggan: { kodeUnit: "" } },
  ];

  const andFilters: Prisma.PiutangWhereInput[] = [
    { OR: baseAnomaliConditions },
  ];

  if (activePeriode !== "ALL") {
    andFilters.push({ periode: activePeriode });
  }

  if (activeQuery) {
    andFilters.push({
      OR: [
        { idPelanggan: { contains: activeQuery } },
        { pelanggan: { namaPelanggan: { contains: activeQuery } } },
      ],
    });
  }

  const whereClause: Prisma.PiutangWhereInput = {
    AND: andFilters,
  };

  const [
    daftarAnomaliRaw,
    anomaliAggregate,
    daftarPetugasAktif,
    distinctPeriodeRows,
  ] = await Promise.all([
    prisma.piutang.findMany({
      where: whereClause,
      orderBy: [{ periode: "desc" }, { nilaiTagihan: "desc" }],
      include: {
        pelanggan: {
          select: {
            namaPelanggan: true,
            alamat: true,
            tarif: true,
            daya: true,
            kodeUnit: true,
          },
        },
        petugas: {
          select: {
            id: true,
            username: true,
            nama: true,
          },
        },
      },
    }),
    prisma.piutang.aggregate({
      where: whereClause,
      _sum: {
        nilaiTagihan: true,
        jumlahLembar: true,
      },
      _count: {
        id: true,
      },
    }),
    prisma.pengguna.findMany({
      where: {
        peran: "PETUGAS",
        isActive: true,
      },
      orderBy: { nama: "asc" },
      select: {
        id: true,
        username: true,
        nama: true,
        kodeUnit: true,
      },
    }),
    prisma.piutang.findMany({
      distinct: ["periode"],
      orderBy: { periode: "desc" },
      select: { periode: true },
    }),
  ]);

  const items: AnomaliRowItem[] = daftarAnomaliRaw.map((row) => ({
    id: row.id,
    idPelanggan: row.idPelanggan,
    periode: row.periode,
    jumlahLembar: row.jumlahLembar,
    nilaiTagihan: row.nilaiTagihan.toString(),
    statusRekonsiliasi: row.statusRekonsiliasi,
    updatedAt: row.updatedAt.toISOString(),
    idPetugas: row.idPetugas,
    pelanggan: row.pelanggan,
    petugas: row.petugas,
  }));

  const totalBarisAnomali = anomaliAggregate._count.id;
  const totalNominalTertahan =
    anomaliAggregate._sum.nilaiTagihan ?? BigInt(0);
  const totalLembarTertahan = anomaliAggregate._sum.jumlahLembar ?? 0;
  const periodeList = distinctPeriodeRows.map((r) => r.periode);

  return (
    <div className="space-y-5">
      {/* Header Halaman */}
      <div className="flex flex-col justify-between gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700">
            <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Pengendalian Kualitas Data Impor
            </p>
            <h1 className="mt-0.5 text-lg font-semibold text-slate-900">
              Antrean Koreksi Admin (Karantina Anomali)
            </h1>
            <p className="mt-0.5 text-xs text-slate-600">
              Daftar piutang dengan status Belum Dipetakan (Unassigned), tanpa
              petugas lapangan, atau kode unit belum terisi.
            </p>
          </div>
        </div>
      </div>

      {/* Ringkasan KPI Anomali */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Jumlah Baris Unassigned
            </span>
            <AlertTriangle
              className="h-4 w-4 text-red-600"
              strokeWidth={1.75}
            />
          </div>
          <p className="mt-2 text-lg font-semibold text-red-700 tabular-nums">
            {totalBarisAnomali.toLocaleString("id-ID")} Pelanggan
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {totalLembarTertahan.toLocaleString("id-ID")} lembar tunggakan
            tertahan
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Total Nominal Tagihan Tertahan
            </span>
            <FileSpreadsheet
              className="h-4 w-4 text-sky-600"
              strokeWidth={1.75}
            />
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900 tabular-nums">
            {formatRupiah(totalNominalTertahan)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Menunggu distribusi penugasan lapangan
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Ketersediaan Petugas Aktif
            </span>
            <Users className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900 tabular-nums">
            {daftarPetugasAktif.length} Personel
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Siap menerima pemetaan satuan & massal
          </p>
        </div>
      </div>

      {/* Komponen Interaktif Tabel & Pemetaan */}
      <AdminAnomaliClient
        items={items}
        petugasList={daftarPetugasAktif}
        periodeList={periodeList}
        activePeriode={activePeriode}
        activeQuery={activeQuery}
      />
    </div>
  );
}
