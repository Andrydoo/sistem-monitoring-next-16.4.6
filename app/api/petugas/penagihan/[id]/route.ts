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

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 jam

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireApiRole(["PETUGAS"]);
  if (authCheck.response) {
    return authCheck.response;
  }

  const { session } = authCheck;
  const { id } = await context.params;

  if (!/^\d+$/.test(id.trim())) {
    return NextResponse.json(
      { error: "ID Kunjungan tidak valid." },
      { status: 400 }
    );
  }

  const penagihanId = Number.parseInt(id, 10);
  if (!Number.isSafeInteger(penagihanId) || penagihanId <= 0) {
    return NextResponse.json(
      { error: "ID Kunjungan tidak valid." },
      { status: 400 }
    );
  }

  const existingPenagihan = await prisma.penagihan.findUnique({
    where: { id: penagihanId },
    include: {
      piutang: {
        select: {
          id: true,
          idPetugas: true,
          periode: true,
          statusRekonsiliasi: true,
        },
      },
      daftarEvidence: {
        select: {
          id: true,
          jenisEvidence: true,
          filePath: true,
          fileSizeKb: true,
        },
      },
      pengingat: true,
    },
  });

  if (!existingPenagihan) {
    return NextResponse.json(
      { error: "Data kunjungan penagihan tidak ditemukan." },
      { status: 404 }
    );
  }

  // Isolasi RBAC: harus milik petugas bersangkutan dan piutang masih ditugaskan kepadanya
  if (
    existingPenagihan.idPetugas !== session.user.id ||
    existingPenagihan.piutang.idPetugas !== session.user.id
  ) {
    return NextResponse.json(
      { error: "Akses ditolak. Kunjungan ini bukan milik Anda." },
      { status: 403 }
    );
  }

  // Validasi batas edit ketat 24 jam sejak waktuInput
  const elapsedMs = Date.now() - existingPenagihan.waktuInput.getTime();
  if (elapsedMs > EDIT_WINDOW_MS) {
    return NextResponse.json(
      { error: "Batas waktu edit 24 jam sejak waktu input telah terlewati." },
      { status: 403 }
    );
  }

  if (
    existingPenagihan.piutang.statusRekonsiliasi === "LUNAS_RESMI" ||
    existingPenagihan.piutang.statusRekonsiliasi === "UNASSIGNED"
  ) {
    return NextResponse.json(
      {
        error: `Piutang berstatus '${existingPenagihan.piutang.statusRekonsiliasi}' tidak dapat diubah lagi.`,
      },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Format payload harus berupa multipart/form-data yang valid." },
      { status: 400 }
    );
  }

  const parsed = await parseAndValidatePenagihanFormData(formData, {
    existingEvidence: existingPenagihan.daftarEvidence,
  });

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
    removeEvidenceIds,
  } = parsed.data;

  const removeIdSet = new Set(removeEvidenceIds);
  const evidencesToRemove = existingPenagihan.daftarEvidence.filter((ev) =>
    removeIdSet.has(ev.id)
  );

  const savedNewFiles: Array<{
    relativePath: string;
    fileSizeKb: number;
    jenisEvidence: JenisEvidence;
  }> = [];

  try {
    for (const photo of uploadedPhotos) {
      const saved = await savePrivateEvidenceFile({
        file: photo.file,
        periode: existingPenagihan.piutang.periode,
        idPiutang: existingPenagihan.idPiutang,
        jenisEvidence: photo.jenisEvidence,
        validated: photo.validated,
      });

      savedNewFiles.push({
        relativePath: saved.relativePath,
        fileSizeKb: saved.fileSizeKb,
        jenisEvidence: photo.jenisEvidence,
      });
    }

    const txResult = await prisma.$transaction(async (tx) => {
      if (evidencesToRemove.length > 0) {
        await tx.evidence.deleteMany({
          where: {
            idPenagihan: existingPenagihan.id,
            id: { in: evidencesToRemove.map((ev) => ev.id) },
          },
        });
      }

      if (savedNewFiles.length > 0) {
        await Promise.all(
          savedNewFiles.map((fileItem) =>
            tx.evidence.create({
              data: {
                idPenagihan: existingPenagihan.id,
                jenisEvidence: fileItem.jenisEvidence,
                filePath: fileItem.relativePath,
                fileSizeKb: fileItem.fileSizeKb,
              },
            })
          )
        );
      }

      const updatedPenagihan = await tx.penagihan.update({
        where: { id: existingPenagihan.id },
        data: {
          kategoriPelanggan,
          catatanKendala,
          bentukPenyelesaian,
          rentangJanjiBayar,
          latitude,
          longitude,
          alasanKendalaGps,
        },
        include: {
          daftarEvidence: {
            orderBy: { uploadedAt: "asc" },
          },
        },
      });

      // Cek apakah kunjungan ini merupakan kunjungan paling mutakhir pada piutang terkait
      const latestVisit = await tx.penagihan.findFirst({
        where: { idPiutang: existingPenagihan.idPiutang },
        orderBy: [{ waktuInput: "desc" }, { id: "desc" }],
        select: { id: true },
      });

      const isLatestVisit = latestVisit?.id === existingPenagihan.id;
      let statusRekonsiliasiBaru: StatusRekonsiliasi =
        existingPenagihan.piutang.statusRekonsiliasi;
      let syncedPengingat: {
        id: number;
        tanggalMulaiRentang: Date;
        tanggalJatuhTempo: Date;
        statusPengingat: string;
      } | null = null;

      if (isLatestVisit) {
        if (bentukPenyelesaian === "JANJI_BAYAR") {
          await tx.pengingat.updateMany({
            where: {
              idPenagihan: { not: existingPenagihan.id },
              penagihan: { idPiutang: existingPenagihan.idPiutang },
              statusPengingat: { in: ["AKTIF", "OVERDUE"] },
            },
            data: { statusPengingat: "SELESAI" },
          });

          const { tanggalMulaiRentang, tanggalJatuhTempo } =
            hitungRentangTanggalJanjiBayar(
              existingPenagihan.piutang.periode,
              rentangJanjiBayar!
            );
          const evaluasi = evaluasiStatusJanjiBayar(
            tanggalMulaiRentang,
            tanggalJatuhTempo
          );

          syncedPengingat = await tx.pengingat.upsert({
            where: { idPenagihan: existingPenagihan.id },
            update: {
              tanggalMulaiRentang,
              tanggalJatuhTempo,
              statusPengingat: evaluasi.statusPengingat,
            },
            create: {
              idPenagihan: existingPenagihan.id,
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
        } else {
          await tx.pengingat.updateMany({
            where: {
              penagihan: { idPiutang: existingPenagihan.idPiutang },
              statusPengingat: { in: ["AKTIF", "OVERDUE"] },
            },
            data: { statusPengingat: "SELESAI" },
          });

          statusRekonsiliasiBaru =
            bentukPenyelesaian === "DIPUTUS"
              ? "DITINDAKLANJUTI"
              : "KLAIM_LAPANGAN";
        }

        await tx.piutang.update({
          where: { id: existingPenagihan.idPiutang },
          data: {
            statusRekonsiliasi: statusRekonsiliasiBaru,
          },
        });
      } else if (
        bentukPenyelesaian !== "JANJI_BAYAR" &&
        existingPenagihan.pengingat &&
        existingPenagihan.pengingat.statusPengingat !== "SELESAI"
      ) {
        await tx.pengingat.update({
          where: { id: existingPenagihan.pengingat.id },
          data: { statusPengingat: "SELESAI" },
        });
      }

      await createAuditLog(
        {
          idPengguna: session.user.id,
          entitas: "PENAGIHAN",
          idRekaman: String(existingPenagihan.id),
          aksi: "UPDATE_KUNJUNGAN",
          nilaiLama: {
            idPiutang: existingPenagihan.idPiutang,
            kategoriPelanggan: existingPenagihan.kategoriPelanggan,
            catatanKendala: existingPenagihan.catatanKendala,
            bentukPenyelesaian: existingPenagihan.bentukPenyelesaian,
            rentangJanjiBayar: existingPenagihan.rentangJanjiBayar,
            latitude: existingPenagihan.latitude,
            longitude: existingPenagihan.longitude,
            alasanKendalaGps: existingPenagihan.alasanKendalaGps,
            statusRekonsiliasi: existingPenagihan.piutang.statusRekonsiliasi,
            evidenceCount: existingPenagihan.daftarEvidence.length,
          },
          nilaiBaru: {
            idPiutang: existingPenagihan.idPiutang,
            kategoriPelanggan,
            catatanKendala,
            bentukPenyelesaian,
            rentangJanjiBayar,
            hasGps,
            alasanKendalaGps,
            isLatestVisit,
            statusRekonsiliasiBaru,
            evidenceCount: updatedPenagihan.daftarEvidence.length,
          },
        },
        tx
      );

      return {
        updatedPenagihan,
        syncedPengingat,
        statusRekonsiliasiBaru,
        isLatestVisit,
      };
    });

    // Hapus berkas lama yang dilepas setelah transaksi database sukses
    for (const removed of evidencesToRemove) {
      await deletePrivateEvidenceFile(removed.filePath).catch((cleanupErr) => {
        console.error(
          `[PenagihanPATCH] Gagal membersihkan berkas lama (${removed.filePath}):`,
          cleanupErr
        );
      });
    }

    revalidatePath("/petugas");
    revalidatePath(`/petugas/piutang/${existingPenagihan.idPiutang}`);
    revalidatePath("/petugas/pengingat");
    revalidatePath("/admin");
    revalidatePath("/admin/piutang");
    revalidatePath("/pimpinan");
    revalidatePath("/pimpinan/piutang");

    return NextResponse.json(
      serializeBigInt({
        message: "Perubahan laporan kunjungan berhasil disimpan.",
        isLatestVisit: txResult.isLatestVisit,
        statusRekonsiliasi: txResult.statusRekonsiliasiBaru,
        penagihan: {
          id: txResult.updatedPenagihan.id,
          idPiutang: txResult.updatedPenagihan.idPiutang,
          idPetugas: txResult.updatedPenagihan.idPetugas,
          kategoriPelanggan: txResult.updatedPenagihan.kategoriPelanggan,
          catatanKendala: txResult.updatedPenagihan.catatanKendala,
          bentukPenyelesaian: txResult.updatedPenagihan.bentukPenyelesaian,
          rentangJanjiBayar: txResult.updatedPenagihan.rentangJanjiBayar,
          latitude: txResult.updatedPenagihan.latitude?.toString() ?? null,
          longitude: txResult.updatedPenagihan.longitude?.toString() ?? null,
          alasanKendalaGps: txResult.updatedPenagihan.alasanKendalaGps,
          waktuInput: txResult.updatedPenagihan.waktuInput.toISOString(),
          daftarEvidence: txResult.updatedPenagihan.daftarEvidence.map((ev) => ({
            id: ev.id,
            jenisEvidence: ev.jenisEvidence,
            fileSizeKb: ev.fileSizeKb,
            uploadedAt: ev.uploadedAt.toISOString(),
          })),
          pengingat: txResult.syncedPengingat
            ? {
                id: txResult.syncedPengingat.id,
                tanggalMulaiRentang:
                  txResult.syncedPengingat.tanggalMulaiRentang.toISOString(),
                tanggalJatuhTempo:
                  txResult.syncedPengingat.tanggalJatuhTempo.toISOString(),
                statusPengingat: txResult.syncedPengingat.statusPengingat,
              }
            : null,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    // Rollback berkas baru bila transaksi gagal
    for (const fileItem of savedNewFiles) {
      await deletePrivateEvidenceFile(fileItem.relativePath).catch((cleanupErr) => {
        console.error(
          `[PenagihanPATCH] Gagal menghapus berkas rollback (${fileItem.relativePath}):`,
          cleanupErr
        );
      });
    }

    if (error instanceof EvidenceValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[PenagihanPATCH] Gagal memperbarui laporan kunjungan:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server saat memperbarui laporan kunjungan." },
      { status: 500 }
    );
  }
}
