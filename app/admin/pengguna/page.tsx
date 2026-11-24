import { CheckCircle2, Shield, Users } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  AdminPenggunaClient,
  type PenggunaAdminItem,
} from "@/components/admin/pengguna-client";
import { TambahPenggunaDialog } from "@/components/admin/tambah-pengguna-dialog";

export default async function AdminPenggunaPage() {
  const session = await requireRole(["ADMIN"]);

  const [daftarPengguna, bebanPiutangByPetugas] = await Promise.all([
    prisma.pengguna.findMany({
      orderBy: [{ peran: "asc" }, { id: "asc" }],
      select: {
        id: true,
        username: true,
        nama: true,
        peran: true,
        kodeUnit: true,
        isActive: true,
        updatedAt: true,
      },
    }),
    prisma.piutang.groupBy({
      by: ["idPetugas"],
      where: {
        idPetugas: { not: null },
        statusRekonsiliasi: { not: "LUNAS_RESMI" },
      },
      _count: {
        id: true,
      },
      _sum: {
        nilaiTagihan: true,
      },
    }),
  ]);

  const bebanMap = new Map<
    number,
    { count: number; nominal: bigint }
  >();

  for (const row of bebanPiutangByPetugas) {
    if (row.idPetugas !== null) {
      bebanMap.set(row.idPetugas, {
        count: row._count.id,
        nominal: row._sum.nilaiTagihan ?? BigInt(0),
      });
    }
  }

  const users: PenggunaAdminItem[] = daftarPengguna.map((u) => {
    const beban = bebanMap.get(u.id);
    return {
      id: u.id,
      username: u.username,
      nama: u.nama,
      peran: u.peran,
      kodeUnit: u.kodeUnit,
      isActive: u.isActive,
      updatedAt: u.updatedAt.toISOString(),
      bebanPiutangAktifCount: beban?.count ?? 0,
      bebanPiutangAktifNominal: (beban?.nominal ?? BigInt(0)).toString(),
    };
  });

  const totalAktifCount = users.filter((u) => u.isActive).length;
  const totalPetugasAktifCount = users.filter(
    (u) => u.peran === "PETUGAS" && u.isActive
  ).length;

  return (
    <div className="space-y-5">
      {/* Header Halaman */}
      <div className="flex flex-col justify-between gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sky-600">
            <Users className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Otorisasi & Kontrol Akses Berdasarkan Peran
            </p>
            <h1 className="mt-0.5 text-lg font-semibold text-slate-900">
              Manajemen Pengguna & Akses RBAC
            </h1>
            <p className="mt-0.5 text-xs text-slate-600">
              Kelola akun Administrator, Pimpinan Eksekutif, dan Petugas
              Lapangan pada PT PLN (Persero) ULP Kraksaan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <TambahPenggunaDialog />
        </div>
      </div>

      {/* Ringkasan KPI Pengguna */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Total Akun Terdaftar
            </span>
            <Users className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900 tabular-nums">
            {users.length} Pengguna
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Unit Layanan Pelanggan Kraksaan (51304)
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Akun Berstatus Aktif
            </span>
            <CheckCircle2
              className="h-4 w-4 text-emerald-600"
              strokeWidth={1.75}
            />
          </div>
          <p className="mt-2 text-lg font-semibold text-emerald-700 tabular-nums">
            {totalAktifCount} Aktif
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {users.length - totalAktifCount} akun dinonaktifkan
          </p>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Petugas Lapangan Aktif
            </span>
            <Shield className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900 tabular-nums">
            {totalPetugasAktifCount} Personel
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Siap menerima penugasan piutang
          </p>
        </div>
      </div>

      {/* Tabel & Dialog CRUD Pengguna */}
      <AdminPenggunaClient users={users} currentAdminId={session.user.id} />
    </div>
  );
}
