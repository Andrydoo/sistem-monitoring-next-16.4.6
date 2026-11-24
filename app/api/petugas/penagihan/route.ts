import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { JenisEvidence, StatusRekonsiliasi } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth-guard";
import {
  deletePrivateEvidenceFile,
  EvidenceValidationError,
  savePrivateEvidenceFile,
} from "@/lib/evidence-storage";
import { serializeBigInt } from "@/lib/format";
import {
  evaluasiStatusJanjiBayar,
  hitungRentangTanggalJanjiBayar,
} from "@/lib/janji-bayar";
import { parseAndValidatePenagihanFormData } from "@/lib/penagihan-validation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authCheck = await requireApiRole(["PETUGAS"]);
  if (authCheck.response) {
    return authCheck.response;
  }

  const { session } = authCheck;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Format payload harus berupa multipart/form-data yang valid." },
      { status: 400 }
    );
  }

  const rawIdPiutang = formData.get("idPiutang");
  const idPiutangStr = typeof rawIdPiutang === "string" ? rawIdPiutang.trim() : "";
  if (!/^\d+$/.test(idPiutangStr)) {
    return NextResponse.json(
      { error: "ID Piutang tidak valid." },
      { status: 400 }
    );
  }

  const idPiutang = Number.parseInt(idPiutangStr, 10);
  if (!Number.isSafeInteger(idPiutang) || idPiutang <= 0) {
    return NextResponse.json(
      { error: "ID Piutang tidak valid." },
      { status: 400 }
    );
  }

  const piutang = await prisma.piutang.findUnique({
    where: { id: idPiutang },
    select: {
      id: true,
      idPetugas: true,
      periode: true,
      statusRekonsiliasi: true,
    },
  });

  if (!piutang) {
    return NextResponse.json(
      { error: "Data piutang tidak ditemukan." },
      { status: 404 }
    );
  }

  if (piutang.idPetugas !== session.user.id) {
    return NextResponse.json(
      { error: "Akses ditolak. Piutang ini bukan penugasan Anda." },
      { status: 403 }
    );
  }

  if (
    piutang.statusRekonsiliasi === "LUNAS_RESMI" ||
    piutang.statusRekonsiliasi === "UNASSIGNED"
  ) {
    return NextResponse.json(
      {
        error: `Piutang berstatus '${piutang.statusRekonsiliasi}' tidak dapat diinput kunjungan lapangan.`,
      },
      { status: 400 }
    );
  }

  const parsed = await parseAndValidatePenagihanFormData(formData);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const {
    kategoriPelanggan,
    catatanKendala,
    bentukPenyelesaian,
    rentangJanjiBayar,
    latitude,
    longitude,
    hasGps,
    alasanKendalaGps,
    uploadedPhotos,
  } = parsed.data;

  const savedFiles: Array<{
    relativePath: string;
    fileSizeKb: number;
    jenisEvidence: JenisEvidence;
  }> = [];

  try {
    // 1. Simpan berkas foto privat ke ./storage/evidence/{periode}/{id_piutang}/
    for (const photo of uploadedPhotos) {
      const saved = await savePrivateEvidenceFile({
        file: photo.file,
        periode: piutang.periode,
        idPiutang: piutang.id,
        jenisEvidence: photo.jenisEvidence,
        validated: photo.validated,
      });

      savedFiles.push({
        relativePath: saved.relativePath,
        fileSizeKb: saved.fileSizeKb,
        jenisEvidence: photo.jenisEvidence,
      });
    }

    // 2. Jalankan transaksi Prisma secara atomik (TIDAK menyentuh KinerjaPetugas)
    const txResult = await prisma.$transaction(async (tx) => {
      const penagihan = await tx.penagihan.create({
        data: {
          idPiutang: piutang.id,
          idPetugas: session.user.id,
          kategoriPelanggan,
          catatanKendala,
          bentukPenyelesaian,
          rentangJanjiBayar,
          latitude,
          longitude,
          alasanKendalaGps,
          waktuInput: new Date(),
        },
      });

      const createdEvidences = await Promise.all(
        savedFiles.map((fileItem) =>
          tx.evidence.create({
            data: {
              idPenagihan: penagihan.id,
              jenisEvidence: fileItem.jenisEvidence,
              filePath: fileItem.relativePath,
              fileSizeKb: fileItem.fileSizeKb,
            },
          })
        )
      );

      // Tutup pengingat lama pada piutang yang sama
      await tx.pengingat.updateMany({
        where: {
          penagihan: { idPiutang: piutang.id },
          statusPengingat: { in: ["AKTIF", "OVERDUE"] },
        },
        data: {
          statusPengingat: "SELESAI",
        },
      });

      let statusRekonsiliasiBaru: StatusRekonsiliasi;
      let createdPengingat: {
        id: number;
        tanggalMulaiRentang: Date;
        tanggalJatuhTempo: Date;
        statusPengingat: string;
      } | null = null;

      if (
        bentukPenyelesaian === "LUNAS_ONLINE" ||
        bentukPenyelesaian === "TITIP_LUNAS"
      ) {
        statusRekonsiliasiBaru = "KLAIM_LAPANGAN";
      } else if (bentukPenyelesaian === "DIPUTUS") {
        statusRekonsiliasiBaru = "DITINDAKLANJUTI";
      } else {
        // JANJI_BAYAR
        const { tanggalMulaiRentang, tanggalJatuhTempo } =
          hitungRentangTanggalJanjiBayar(piutang.periode, rentangJanjiBayar!);
        const evaluasi = evaluasiStatusJanjiBayar(
          tanggalMulaiRentang,
          tanggalJatuhTempo
        );

        createdPengingat = await tx.pengingat.create({
          data: {
            idPenagihan: penagihan.id,
            tanggalMulaiRentang,
            tanggalJatuhTempo,
            statusPengingat: evaluasi.statusPengingat,
          },
          select: {
            id: true,
            tanggalMulaiRentang: true,
            tanggalJatuhTempo: true,
            statusPengingat: true,
          },
        });

        statusRekonsiliasiBaru = evaluasi.statusPiutang;
      }

      await tx.piutang.update({
        where: { id: piutang.id },
        data: {
          statusRekonsiliasi: statusRekonsiliasiBaru,
        },
      });

      await createAuditLog(
        {
          idPengguna: session.user.id,
          entitas: "PENAGIHAN",
          idRekaman: String(penagihan.id),
          aksi: "CREATE_KUNJUNGAN",
          nilaiLama: {
            statusRekonsiliasi: piutang.statusRekonsiliasi,
          },
          nilaiBaru: {
            idPiutang: piutang.id,
            bentukPenyelesaian,
            kategoriPelanggan,
            statusRekonsiliasiBaru,
            hasGps,
            evidenceCount: savedFiles.length,
          },
        },
        tx
      );

      return {
        penagihan,
        createdEvidences,
        createdPengingat,
        statusRekonsiliasiBaru,
      };
    });

    revalidatePath("/petugas");
    revalidatePath(`/petugas/piutang/${piutang.id}`);
    revalidatePath("/petugas/pengingat");
    revalidatePath("/admin");
    revalidatePath("/admin/piutang");
    revalidatePath("/pimpinan");
    revalidatePath("/pimpinan/piutang");

    return NextResponse.json(
      serializeBigInt({
        message: "Laporan kunjungan penagihan berhasil disimpan.",
        statusRekonsiliasi: txResult.statusRekonsiliasiBaru,
        penagihan: {
          id: txResult.penagihan.id,
          idPiutang: txResult.penagihan.idPiutang,
          idPetugas: txResult.penagihan.idPetugas,
          kategoriPelanggan: txResult.penagihan.kategoriPelanggan,
          catatanKendala: txResult.penagihan.catatanKendala,
          bentukPenyelesaian: txResult.penagihan.bentukPenyelesaian,
          rentangJanjiBayar: txResult.penagihan.rentangJanjiBayar,
          latitude: txResult.penagihan.latitude?.toString() ?? null,
          longitude: txResult.penagihan.longitude?.toString() ?? null,
          alasanKendalaGps: txResult.penagihan.alasanKendalaGps,
          waktuInput: txResult.penagihan.waktuInput.toISOString(),
          daftarEvidence: txResult.createdEvidences.map((ev) => ({
            id: ev.id,
            jenisEvidence: ev.jenisEvidence,
            fileSizeKb: ev.fileSizeKb,
            uploadedAt: ev.uploadedAt.toISOString(),
          })),
          pengingat: txResult.createdPengingat
            ? {
                id: txResult.createdPengingat.id,
                tanggalMulaiRentang:
                  txResult.createdPengingat.tanggalMulaiRentang.toISOString(),
                tanggalJatuhTempo:
                  txResult.createdPengingat.tanggalJatuhTempo.toISOString(),
                statusPengingat: txResult.createdPengingat.statusPengingat,
              }
            : null,
        },
      }),
      { status: 201 }
    );
  } catch (error) {
    // Rollback seluruh berkas foto yang sempat tersimpan ke disk
    for (const fileItem of savedFiles) {
      await deletePrivateEvidenceFile(fileItem.relativePath).catch((cleanupErr) => {
        console.error(
          `[PenagihanPOST] Gagal menghapus berkas rollback (${fileItem.relativePath}):`,
          cleanupErr
        );
      });
    }

    if (error instanceof EvidenceValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[PenagihanPOST] Gagal menyimpan laporan kunjungan:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server saat menyimpan laporan kunjungan." },
      { status: 500 }
    );
  }
}
