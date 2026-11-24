import { Prisma, StatusRekonsiliasi } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Users,
  Wallet,
} from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { formatRupiah } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { evaluateActiveReminders } from "@/lib/reminder-evaluator";
import { EvaluateRemindersButton } from "@/components/admin/evaluate-reminders-button";
import {
  AdminPiutangClient,
  type PiutangAdminRow,
} from "@/components/admin/piutang-client";
import { TambahPiutangDialog } from "@/components/admin/tambah-piutang-dialog";
import { ExportPiutangButton } from "@/components/shared/export-piutang-button";
import { ReminderPriorityBanner } from "@/components/shared/reminder-priority-banner";

const PAGE_SIZE = 20;

const VALID_STATUS_SET = new Set<string>([
  "UNASSIGNED",
  "BELUM_TERTAGIH",
  "MASA_JANJI_BAYAR",
  "OVERDUE",
  "DITINDAKLANJUTI",
  "KLAIM_LAPANGAN",
  "LUNAS_RESMI",
]);

export default async function AdminPiutangPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    periode?: string;
    petugas?: string;
    status?: string;
    page?: string;
  }>;
}) {
  await requireRole(["ADMIN"]);

  try {
    await evaluateActiveReminders({ source: "PAGE_LOAD" });
  } catch (error) {
    console.error(
      "[AdminPiutangPage] Gagal mengevaluasi pengingat otomatis:",
      error
    );
  }

  const resolved = await searchParams;
  const q = resolved.q?.trim() || "";
  const periode = resolved.periode?.trim() || "ALL";
  const petugas = resolved.petugas?.trim() || "ALL";
  const status =
    resolved.status && VALID_STATUS_SET.has(resolved.status)
      ? resolved.status
      : "ALL";
  const currentPage = Math.max(
    1,
    Number.parseInt(resolved.page ?? "1", 10) || 1
  );

  const andConditions: Prisma.PiutangWhereInput[] = [];

  if (periode !== "ALL") {
    andConditions.push({ periode });
  }

  if (petugas === "UNASSIGNED") {
    andConditions.push({ idPetugas: null });
  } else if (petugas !== "ALL") {
    const parsedPetugasId = Number.parseInt(petugas, 10);
    if (Number.isFinite(parsedPetugasId) && parsedPetugasId > 0) {
      andConditions.push({ idPetugas: parsedPetugasId });
    }
  }

  if (status !== "ALL") {
    andConditions.push({
      statusRekonsiliasi: status as StatusRekonsiliasi,
    });
  }

  if (q) {
    andConditions.push({
      OR: [
        { idPelanggan: { contains: q } },
        { pelanggan: { namaPelanggan: { contains: q } } },
      ],
    });
  }

  const whereClause: Prisma.PiutangWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [
    totalFilteredCount,
    paginatedRows,
    kpiAggregate,
    statusGroupCounts,
    daftarPetugas,
    distinctPeriodeRows,
    globalOverdueAggregate,
    globalMasaJanjiBayarCount,
  ] = await Promise.all([
    prisma.piutang.count({ where: whereClause }),
    prisma.piutang.findMany({
      where: whereClause,
      orderBy: [{ periode: "desc" }, { nilaiTagihan: "desc" }],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
      _count: { id: true },
      _sum: {
        nilaiTagihan: true,
        jumlahLembar: true,
      },
    }),
    prisma.piutang.groupBy({
      by: ["statusRekonsiliasi"],
      where: whereClause,
      _count: { id: true },
    }),
    prisma.pengguna.findMany({
      where: { peran: "PETUGAS" },
      orderBy: [{ isActive: "desc" }, { nama: "asc" }],
      select: {
        id: true,
        username: true,
        nama: true,
        isActive: true,
      },
    }),
    prisma.piutang.findMany({
      distinct: ["periode"],
      orderBy: { periode: "desc" },
      select: { periode: true },
    }),
    prisma.piutang.aggregate({
      where: { statusRekonsiliasi: "OVERDUE" },
      _count: { id: true },
      _sum: { nilaiTagihan: true },
    }),
    prisma.piutang.count({
      where: { statusRekonsiliasi: "MASA_JANJI_BAYAR" },
    }),
  ]);

  const globalOverdueCount = globalOverdueAggregate._count.id;
  const globalOverdueNominal =
    globalOverdueAggregate._sum.nilaiTagihan ?? BigInt(0);

  const statusCountMap = new Map<StatusRekonsiliasi, number>();
  for (const grp of statusGroupCounts) {
    statusCountMap.set(grp.statusRekonsiliasi, grp._count.id);
  }

  const totalPelanggan = kpiAggregate._count.id;
  const totalTagihan = kpiAggregate._sum.nilaiTagihan ?? BigInt(0);
  const totalLembar = kpiAggregate._sum.jumlahLembar ?? 0;
  const belumTertagihCount = statusCountMap.get("BELUM_TERTAGIH") ?? 0;
  const klaimLapanganCount = statusCountMap.get("KLAIM_LAPANGAN") ?? 0;
  const lunasResmiCount = statusCountMap.get("LUNAS_RESMI") ?? 0;
  const overdueAnomaliCount =
    (statusCountMap.get("OVERDUE") ?? 0) +
    (statusCountMap.get("UNASSIGNED") ?? 0);

  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / PAGE_SIZE));

  const items: PiutangAdminRow[] = paginatedRows.map((row) => ({
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

  const periodeList = distinctPeriodeRows.map((r) => r.periode);
  const activePetugasOptions = daftarPetugas
    .filter((p) => p.isActive)
    .map(({ id, nama, username }) => ({ id, nama, username }));

  return (
    <div className="space-y-5">
      {/* Header Halaman */}
      <div className="flex flex-col justify-between gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-xs lg:flex-row lg:items-center">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sky-600">
            <FileSpreadsheet className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Manajemen Operasional
            </p>
            <h1 className="mt-0.5 text-lg font-semibold text-slate-900">
              Data Piutang & Penugasan Petugas
            </h1>
            <p className="mt-0.5 text-xs text-slate-600">
              Pemantauan daftar piutang pelanggan, status rekonsiliasi TUL
              III-09, dan redistribusi beban penugasan petugas lapangan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <TambahPiutangDialog
            petugasList={activePetugasOptions}
            defaultPeriode={periode !== "ALL" ? periode : undefined}
          />
          <ExportPiutangButton
            periode={periode}
            petugas={petugas}
            status={status}
            q={q}
          />
          <EvaluateRemindersButton />
        </div>
      </div>

      {/* Banner Peringatan Prioritas Overdue & Masa Janji Bayar */}
      <ReminderPriorityBanner
        variant="admin"
        overdueCount={globalOverdueCount}
        masaJanjiBayarCount={globalMasaJanjiBayarCount}
        overdueNominal={globalOverdueNominal}
        ctaHref={
          globalOverdueCount > 0
            ? "/admin/piutang?status=OVERDUE"
            : "/admin/piutang?status=MASA_JANJI_BAYAR"
        }
        ctaLabel={
          globalOverdueCount > 0
            ? "Tinjau Piutang Overdue"
            : "Tinjau Masa Janji Bayar"
        }
      />

      {/* Baris KPI Padat (6 Kartu) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-md border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              Total Pelanggan
            </span>
            <Users className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
          </div>
          <p className="mt-1.5 text-base font-semibold text-slate-900 tabular-nums">
            {totalPelanggan.toLocaleString("id-ID")}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
            {totalLembar.toLocaleString("id-ID")} lembar tagihan
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              Total Tagihan
            </span>
            <Wallet className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
          </div>
          <p className="mt-1.5 text-base font-semibold text-slate-900 tabular-nums">
            {formatRupiah(totalTagihan)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Akumulasi sesuai filter
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              Belum Tertagih
            </span>
            <FileSpreadsheet
              className="h-4 w-4 text-slate-600"
              strokeWidth={1.75}
            />
          </div>
          <p className="mt-1.5 text-base font-semibold text-slate-900 tabular-nums">
            {belumTertagihCount.toLocaleString("id-ID")}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Menunggu kunjungan
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              Klaim Lapangan
            </span>
            <Clock className="h-4 w-4 text-amber-600" strokeWidth={1.75} />
          </div>
          <p className="mt-1.5 text-base font-semibold text-amber-800 tabular-nums">
            {klaimLapanganCount.toLocaleString("id-ID")}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Menunggu verifikasi Excel
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              Lunas Resmi
            </span>
            <CheckCircle2
              className="h-4 w-4 text-emerald-600"
              strokeWidth={1.75}
            />
          </div>
          <p className="mt-1.5 text-base font-semibold text-emerald-700 tabular-nums">
            {lunasResmiCount.toLocaleString("id-ID")}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Terekonsiliasi sistem
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              Overdue / Anomali
            </span>
            <AlertTriangle
              className="h-4 w-4 text-red-600"
              strokeWidth={1.75}
            />
          </div>
          <p className="mt-1.5 text-base font-semibold text-red-700 tabular-nums">
            {overdueAnomaliCount.toLocaleString("id-ID")}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
            {statusCountMap.get("OVERDUE") ?? 0} Overdue •{" "}
            {statusCountMap.get("UNASSIGNED") ?? 0} Unassigned
          </p>
        </div>
      </div>

      {/* Tabel, Filter, Load Balancing, dan Pagination */}
      <AdminPiutangClient
        items={items}
        petugasList={daftarPetugas}
        periodeList={periodeList}
        filters={{
          q,
          periode,
          petugas,
          status,
        }}
        pagination={{
          currentPage,
          totalPages,
          totalCount: totalFilteredCount,
          pageSize: PAGE_SIZE,
        }}
      />
    </div>
  );
}
