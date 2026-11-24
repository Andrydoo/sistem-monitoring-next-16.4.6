import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { StatusRekonsiliasi } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth-guard";
import {
  extractAndValidateHeaders,
  getRowCellByHeader,
  isWorksheetRowEmpty,
  parseIdPelangganCell,
  parsePeriodeCell,
  parseRupiahBigInt,
  parseSafeInteger,
  PIUTANG_REQUIRED_HEADERS,
  readCellString,
  validateExcelUploadFile,
} from "@/lib/excel-helpers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export interface ImportRowError {
  row: number;
  reason: string;
}

export async function POST(request: Request) {
  const authCheck = await requireApiRole(["ADMIN"]);
  if (authCheck.response) {
    return authCheck.response;
  }

  const { session } = authCheck;

  try {
    const formData = await request.formData();
    const rawFile = formData.get("file");

    const fileValidation = validateExcelUploadFile(rawFile);
    if (!fileValidation.valid) {
      return NextResponse.json(
        { error: fileValidation.error },
        { status: 400 }
      );
    }

    const { file } = fileValidation;
    const arrayBuffer = await file.arrayBuffer();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json(
        { error: "Berkas Excel tidak memiliki lembar kerja (worksheet)." },
        { status: 400 }
      );
    }

    const headerCheck = extractAndValidateHeaders(
      worksheet,
      PIUTANG_REQUIRED_HEADERS
    );

    if (!headerCheck.valid) {
      return NextResponse.json(
        {
          error: `Struktur header Excel Piutang tidak lengkap. Kolom wajib yang kurang: ${headerCheck.missingHeaders.join(", ")}`,
          missingHeaders: headerCheck.missingHeaders,
        },
        { status: 400 }
      );
    }

    const { headerMap } = headerCheck;

    // Ambil seluruh petugas aktif untuk pencocokan username_petugas
    const daftarPetugasAktif = await prisma.pengguna.findMany({
      where: {
        peran: "PETUGAS",
        isActive: true,
      },
      select: {
        id: true,
        username: true,
      },
    });

    const activePetugasMap = new Map<string, number>();
    for (const petugas of daftarPetugasAktif) {
      activePetugasMap.set(petugas.username.trim().toLowerCase(), petugas.id);
    }

    let totalRows = 0;
    let processedRows = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let anomaliCount = 0;
    let autoLunasCount = 0;
    const errors: ImportRowError[] = [];

    // Peta periode -> Set<idPelanggan> yang valid di dalam file Excel terbaru
    const validPelangganByPeriode = new Map<string, Set<string>>();

    const rowCount = worksheet.rowCount;

    for (let rowNumber = 2; rowNumber <= rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      if (isWorksheetRowEmpty(row, headerMap, PIUTANG_REQUIRED_HEADERS)) {
        continue;
      }

      totalRows++;

      const periode = parsePeriodeCell(
        getRowCellByHeader(row, headerMap, "periode")
      );
      const idPelanggan = parseIdPelangganCell(
        getRowCellByHeader(row, headerMap, "id_pelanggan")
      );
      const namaPelanggan = readCellString(
        getRowCellByHeader(row, headerMap, "nama_pelanggan")
      )
        .trim()
        .slice(0, 150);
      const tarif = readCellString(getRowCellByHeader(row, headerMap, "tarif"))
        .trim()
        .toUpperCase()
        .slice(0, 10);
      const daya = parseSafeInteger(
        getRowCellByHeader(row, headerMap, "daya"),
        { min: 1 }
      );
      const alamatRaw = readCellString(
        getRowCellByHeader(row, headerMap, "alamat")
      ).trim();
      const jumlahLembar = parseSafeInteger(
        getRowCellByHeader(row, headerMap, "jumlah_lembar"),
        { min: 1 }
      );
      const kodeUnitRaw = readCellString(
        getRowCellByHeader(row, headerMap, "kode_unit")
      )
        .trim()
        .slice(0, 10);
      const usernamePetugasRaw = readCellString(
        getRowCellByHeader(row, headerMap, "username_petugas")
      ).trim();
      const nilaiTagihan = parseRupiahBigInt(
        getRowCellByHeader(row, headerMap, "nilai_tagihan")
      );

      // Validasi format dasar wajib
      const rowValidationErrors: string[] = [];
      if (!periode) {
        rowValidationErrors.push("Format 'periode' wajib YYYY-MM");
      }
      if (!idPelanggan) {
        rowValidationErrors.push(
          "Format 'id_pelanggan' wajib berupa deret angka valid"
        );
      }
      if (!namaPelanggan) {
        rowValidationErrors.push("Kolom 'nama_pelanggan' tidak boleh kosong");
      }
      if (!tarif) {
        rowValidationErrors.push("Kolom 'tarif' tidak boleh kosong");
      }
      if (daya === null) {
        rowValidationErrors.push("Kolom 'daya' wajib berupa angka bulat > 0");
      }
      if (jumlahLembar === null) {
        rowValidationErrors.push(
          "Kolom 'jumlah_lembar' wajib berupa angka bulat >= 1"
        );
      }
      if (nilaiTagihan === null || nilaiTagihan <= BigInt(0)) {
        rowValidationErrors.push(
          "Kolom 'nilai_tagihan' wajib berupa nominal Rupiah > 0"
        );
      }

      if (
        rowValidationErrors.length > 0 ||
        !periode ||
        !idPelanggan ||
        daya === null ||
        jumlahLembar === null ||
        nilaiTagihan === null
      ) {
        errors.push({
          row: rowNumber,
          reason: rowValidationErrors.join("; "),
        });
        continue;
      }

      const alamat = alamatRaw || "-";
      const kodeUnit = kodeUnitRaw || null;
      const matchedPetugasId = usernamePetugasRaw
        ? (activePetugasMap.get(usernamePetugasRaw.toLowerCase()) ?? null)
        : null;

      // Daftarkan pelanggan valid pada periode terkait untuk deteksi auto-lunas
      let pelangganSet = validPelangganByPeriode.get(periode);
      if (!pelangganSet) {
        pelangganSet = new Set<string>();
        validPelangganByPeriode.set(periode, pelangganSet);
      }
      pelangganSet.add(idPelanggan);

      // Cek apakah baris masuk karantina anomali (UNASSIGNED)
      const isAnomali =
        !usernamePetugasRaw || matchedPetugasId === null || !kodeUnit;

      // 1. Upsert Master Pelanggan
      await prisma.pelanggan.upsert({
        where: { idPelanggan },
        update: {
          namaPelanggan,
          alamat,
          tarif,
          daya,
          kodeUnit,
        },
        create: {
          idPelanggan,
          namaPelanggan,
          alamat,
          tarif,
          daya,
          kodeUnit,
        },
      });

      // 2. Cek eksistensi Piutang berdasarkan (idPelanggan, periode)
      const existingPiutang = await prisma.piutang.findUnique({
        where: {
          unik_pelanggan_periode: {
            idPelanggan,
            periode,
          },
        },
        select: {
          id: true,
          statusRekonsiliasi: true,
        },
      });

      if (isAnomali) {
        // Karantina Anomali: idPetugas = null, statusRekonsiliasi = "UNASSIGNED"
        if (!existingPiutang) {
          await prisma.piutang.create({
            data: {
              idPelanggan,
              periode,
              idPetugas: null,
              jumlahLembar,
              nilaiTagihan,
              statusRekonsiliasi: "UNASSIGNED",
            },
          });
          insertedCount++;
        } else {
          await prisma.piutang.update({
            where: { id: existingPiutang.id },
            data: {
              idPetugas: null,
              jumlahLembar,
              nilaiTagihan,
              statusRekonsiliasi: "UNASSIGNED",
            },
          });
          updatedCount++;
        }
        anomaliCount++;
      } else {
        // Baris Valid Lengkap
        if (!existingPiutang) {
          await prisma.piutang.create({
            data: {
              idPelanggan,
              periode,
              idPetugas: matchedPetugasId,
              jumlahLembar,
              nilaiTagihan,
              statusRekonsiliasi: "BELUM_TERTAGIH",
            },
          });
          insertedCount++;
        } else {
          // Pertahankan status proses lapangan jika sudah berjalan
          const prevStatus = existingPiutang.statusRekonsiliasi;
          const nextStatus: StatusRekonsiliasi =
            prevStatus === "UNASSIGNED" || prevStatus === "LUNAS_RESMI"
              ? "BELUM_TERTAGIH"
              : prevStatus;

          await prisma.piutang.update({
            where: { id: existingPiutang.id },
            data: {
              idPetugas: matchedPetugasId,
              jumlahLembar,
              nilaiTagihan,
              statusRekonsiliasi: nextStatus,
            },
          });
          updatedCount++;
        }
      }

      processedRows++;
    }

    // 3. Verifikasi Lunas Resmi Otomatis saat Impor Ulang pada periode yang sama
    for (const [periode, idPelangganSet] of validPelangganByPeriode.entries()) {
      if (idPelangganSet.size === 0) {
        continue;
      }

      const daftarPiutangLunas = await prisma.piutang.findMany({
        where: {
          periode,
          idPelanggan: {
            notIn: Array.from(idPelangganSet),
          },
          statusRekonsiliasi: {
            not: "LUNAS_RESMI",
          },
        },
        select: {
          id: true,
        },
      });

      if (daftarPiutangLunas.length > 0) {
        const lunasIds = daftarPiutangLunas.map((item) => item.id);

        await prisma.$transaction([
          prisma.piutang.updateMany({
            where: {
              id: { in: lunasIds },
            },
            data: {
              statusRekonsiliasi: "LUNAS_RESMI",
            },
          }),
          prisma.pengingat.updateMany({
            where: {
              statusPengingat: {
                in: ["AKTIF", "OVERDUE"],
              },
              penagihan: {
                idPiutang: {
                  in: lunasIds,
                },
              },
            },
            data: {
              statusPengingat: "SELESAI",
            },
          }),
        ]);

        autoLunasCount += lunasIds.length;
      }
    }

    const periodeList = Array.from(validPelangganByPeriode.keys()).sort();

    // 4. Catat AuditLog
    await createAuditLog({
      idPengguna: session.user.id,
      entitas: "IMPOR_PIUTANG",
      idRekaman: periodeList.length > 0 ? periodeList.join(",") : "TANPA_PERIODE",
      aksi: "IMPORT_EXCEL",
      nilaiBaru: {
        fileName: file.name,
        periodeList,
        totalRows,
        processedRows,
        insertedCount,
        updatedCount,
        anomaliCount,
        autoLunasCount,
        errorCount: errors.length,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/impor");
    revalidatePath("/admin/anomali");
    revalidatePath("/admin/piutang");
    revalidatePath("/admin/pengguna");
    revalidatePath("/pimpinan");
    revalidatePath("/pimpinan/piutang");
    revalidatePath("/petugas");

    return NextResponse.json({
      totalRows,
      processedRows,
      insertedCount,
      updatedCount,
      anomaliCount,
      autoLunasCount,
      periodeList,
      errors,
    });
  } catch (error) {
    console.error("[ImportPiutang] Gagal memproses berkas Excel:", error);
    return NextResponse.json(
      {
        error:
          "Terjadi kesalahan saat membaca atau memproses berkas Excel Piutang. Pastikan berkas .xlsx tidak rusak.",
      },
      { status: 500 }
    );
  }
}
