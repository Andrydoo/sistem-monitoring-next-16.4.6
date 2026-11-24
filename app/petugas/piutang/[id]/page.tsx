import Link from "next/link";
import { ArrowLeft, FileWarning, ShieldAlert } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  FormKunjunganClient,
  type PiutangDetailData,
} from "@/components/petugas/form-kunjungan-client";

export default async function PetugasPiutangDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["PETUGAS"]);
  const { id } = await params;

  if (!/^\d+$/.test(id.trim())) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-800">
            <FileWarning className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Data Piutang Tidak Valid (404)
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Parameter ID piutang pada tautan tidak valid. Silakan kembali ke
              daftar tugas penagihan.
            </p>
          </div>
        </div>
        <Link
          href="/petugas"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          <span>Kembali ke Daftar Tugas</span>
        </Link>
      </div>
    );
  }

  const piutangId = Number.parseInt(id, 10);
  const piutang = await prisma.piutang.findUnique({
    where: { id: piutangId },
    include: {
      pelanggan: {
        select: {
          idPelanggan: true,
          namaPelanggan: true,
          alamat: true,
          tarif: true,
          daya: true,
          kodeUnit: true,
        },
      },
      riwayatPenagihan: {
        orderBy: [{ waktuInput: "desc" }, { id: "desc" }],
        include: {
          daftarEvidence: {
            orderBy: { uploadedAt: "asc" },
            select: {
              id: true,
              jenisEvidence: true,
              fileSizeKb: true,
              uploadedAt: true,
            },
          },
          pengingat: {
            select: {
              id: true,
              tanggalMulaiRentang: true,
              tanggalJatuhTempo: true,
              statusPengingat: true,
            },
          },
        },
      },
    },
  });

  if (!piutang) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-800">
            <FileWarning className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Data Piutang Tidak Ditemukan (404)
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Data piutang yang Anda cari tidak tersedia atau telah dihapus oleh
              administrator.
            </p>
          </div>
        </div>
        <Link
          href="/petugas"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          <span>Kembali ke Daftar Tugas</span>
        </Link>
      </div>
    );
  }

  // Isolasi RBAC Halaman: JANGAN kirim atau tampilkan data pelanggan milik petugas lain
  if (piutang.idPetugas !== session.user.id) {
    return (
      <div className="rounded-md border border-red-200 bg-white p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700">
            <ShieldAlert className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Akses Ditolak (403)
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Anda tidak memiliki otorisasi untuk mengakses atau menginput
              kunjungan pada data piutang ini karena bukan merupakan penugasan
              akun Anda.
            </p>
          </div>
        </div>
        <Link
          href="/petugas"
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-700"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          <span>Kembali ke Daftar Tugas</span>
        </Link>
      </div>
    );
  }

  const serializedPiutang: PiutangDetailData = {
    id: piutang.id,
    idPelanggan: piutang.idPelanggan,
    periode: piutang.periode,
    jumlahLembar: piutang.jumlahLembar,
    nilaiTagihan: piutang.nilaiTagihan.toString(),
    statusRekonsiliasi: piutang.statusRekonsiliasi,
    pelanggan: piutang.pelanggan,
    riwayatPenagihan: piutang.riwayatPenagihan.map((visit) => ({
      id: visit.id,
      kategoriPelanggan: visit.kategoriPelanggan,
      catatanKendala: visit.catatanKendala,
      bentukPenyelesaian: visit.bentukPenyelesaian,
      rentangJanjiBayar: visit.rentangJanjiBayar,
      latitude: visit.latitude ? visit.latitude.toString() : null,
      longitude: visit.longitude ? visit.longitude.toString() : null,
      alasanKendalaGps: visit.alasanKendalaGps,
      waktuInput: visit.waktuInput.toISOString(),
      updatedAt: visit.updatedAt.toISOString(),
      daftarEvidence: visit.daftarEvidence.map((ev) => ({
        id: ev.id,
        jenisEvidence: ev.jenisEvidence,
        fileSizeKb: ev.fileSizeKb,
        uploadedAt: ev.uploadedAt.toISOString(),
      })),
      pengingat: visit.pengingat
        ? {
            id: visit.pengingat.id,
            tanggalMulaiRentang:
              visit.pengingat.tanggalMulaiRentang.toISOString(),
            tanggalJatuhTempo: visit.pengingat.tanggalJatuhTempo.toISOString(),
            statusPengingat: visit.pengingat.statusPengingat,
          }
        : null,
    })),
  };

  return (
    <FormKunjunganClient
      piutang={serializedPiutang}
      initialNowIso={new Date().toISOString()}
    />
  );
}
