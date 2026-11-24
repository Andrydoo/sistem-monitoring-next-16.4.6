import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth-guard";
import {
  extractAndValidateHeaders,
  getRowCellByHeader,
  isWorksheetRowEmpty,
  KINERJA_REQUIRED_HEADERS,
  parsePeriodeCell,
  parseRupiahBigInt,
  parseSafeInteger,
  readCellString,
  validateExcelUploadFile,
} from "@/lib/excel-helpers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export interface ImportKinerjaRowError {
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
      KINERJA_REQUIRED_HEADERS
    );

    if (!headerCheck.valid) {
      return NextResponse.json(
        {
          error: `Struktur header Excel Kinerja tidak lengkap. Kolom wajib yang kurang: ${headerCheck.missingHeaders.join(", ")}`,
          missingHeaders: headerCheck.missingHeaders,
        },
        { status: 400 }
      );
    }

    const { headerMap } = headerCheck;

    // Ambil seluruh pengguna dengan peran PETUGAS
    const daftarPetugas = await prisma.pengguna.findMany({
      where: {
        peran: "PETUGAS",
      },
      select: {
        id: true,
        username: true,
      },
    });

    const petugasMap = new Map<string, number>();
    for (const petugas of daftarPetugas) {
      petugasMap.set(petugas.username.trim().toLowerCase(), petugas.id);
    }

    let totalRows = 0;
    let processedRows = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    const errors: ImportKinerjaRowError[] = [];
    const periodeSet = new Set<string>();

    const rowCount = worksheet.rowCount;

    for (let rowNumber = 2; rowNumber <= rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      if (isWorksheetRowEmpty(row, headerMap, KINERJA_REQUIRED_HEADERS)) {
        continue;
      }

      totalRows++;

      const periode = parsePeriodeCell(
        getRowCellByHeader(row, headerMap, "periode")
      );
      const usernamePetugas = readCellString(
        getRowCellByHeader(row, headerMap, "username_petugas")
      ).trim();

      const saldoAkhirPeriode = parseRupiahBigInt(
        getRowCellByHeader(row, headerMap, "saldo_akhir_periode")
      );
      const saldoAkhirBulan = parseRupiahBigInt(
        getRowCellByHeader(row, headerMap, "saldo_akhir_bulan")
      );
      const rpPelunasanPlnMobile = parseRupiahBigInt(
        getRowCellByHeader(row, headerMap, "rp_pelunasan_pln_mobile")
      );
      const kaliTransaksiPlnMobile = parseSafeInteger(
        getRowCellByHeader(row, headerMap, "kali_transaksi_pln_mobile"),
        { min: 0 }
      );
      const perolehanMigrasiPrabayar = parseSafeInteger(
        getRowCellByHeader(row, headerMap, "perolehan_migrasi_prabayar"),
        { min: 0 }
      );
      const perolehanPromoTematik = parseSafeInteger(
        getRowCellByHeader(row, headerMap, "perolehan_promo_tematik"),
        { min: 0 }
      );
      const pelunasanSaldoPrr = parseRupiahBigInt(
        getRowCellByHeader(row, headerMap, "pelunasan_saldo_prr")
      );

      const rowValidationErrors: string[] = [];
      if (!periode) {
        rowValidationErrors.push("Format 'periode' wajib YYYY-MM");
      }
      if (!usernamePetugas) {
        rowValidationErrors.push("Kolom 'username_petugas' tidak boleh kosong");
      }
      if (saldoAkhirPeriode === null) {
        rowValidationErrors.push(
          "Kolom 'saldo_akhir_periode' wajib berupa nominal angka >= 0"
        );
      }
      if (saldoAkhirBulan === null) {
        rowValidationErrors.push(
          "Kolom 'saldo_akhir_bulan' wajib berupa nominal angka >= 0"
        );
      }
      if (rpPelunasanPlnMobile === null) {
        rowValidationErrors.push(
          "Kolom 'rp_pelunasan_pln_mobile' wajib berupa nominal angka >= 0"
        );
      }
      if (kaliTransaksiPlnMobile === null) {
        rowValidationErrors.push(
          "Kolom 'kali_transaksi_pln_mobile' wajib berupa bilangan bulat >= 0"
        );
      }
      if (perolehanMigrasiPrabayar === null) {
        rowValidationErrors.push(
          "Kolom 'perolehan_migrasi_prabayar' wajib berupa bilangan bulat >= 0"
        );
      }
      if (perolehanPromoTematik === null) {
        rowValidationErrors.push(
          "Kolom 'perolehan_promo_tematik' wajib berupa bilangan bulat >= 0"
        );
      }
      if (pelunasanSaldoPrr === null) {
        rowValidationErrors.push(
          "Kolom 'pelunasan_saldo_prr' wajib berupa nominal angka >= 0"
        );
      }

      if (
        rowValidationErrors.length > 0 ||
        !periode ||
        !usernamePetugas ||
        saldoAkhirPeriode === null ||
        saldoAkhirBulan === null ||
        rpPelunasanPlnMobile === null ||
        kaliTransaksiPlnMobile === null ||
        perolehanMigrasiPrabayar === null ||
        perolehanPromoTematik === null ||
        pelunasanSaldoPrr === null
      ) {
        errors.push({
          row: rowNumber,
          reason: rowValidationErrors.join("; "),
        });
        continue;
      }

      const idPetugas = petugasMap.get(usernamePetugas.toLowerCase());
      if (!idPetugas) {
        errors.push({
          row: rowNumber,
          reason: `Petugas dengan username '${usernamePetugas}' (peran PETUGAS) tidak ditemukan di basis data`,
        });
        continue;
      }

      const existingKinerja = await prisma.kinerjaPetugas.findUnique({
        where: {
          unik_kinerja_petugas_periode: {
            idPetugas,
            periode,
          },
        },
        select: { id: true },
      });

      await prisma.kinerjaPetugas.upsert({
        where: {
          unik_kinerja_petugas_periode: {
            idPetugas,
            periode,
          },
        },
        update: {
          saldoAkhirPeriode,
          saldoAkhirBulan,
          rpPelunasanPlnMobile,
          kaliTransaksiPlnMobile,
          perolehanMigrasiPrabayar,
          perolehanPromoTematik,
          pelunasanSaldoPrr,
        },
        create: {
          idPetugas,
          periode,
          saldoAkhirPeriode,
          saldoAkhirBulan,
          rpPelunasanPlnMobile,
          kaliTransaksiPlnMobile,
          perolehanMigrasiPrabayar,
          perolehanPromoTematik,
          pelunasanSaldoPrr,
        },
      });

      if (existingKinerja) {
        updatedCount++;
      } else {
        insertedCount++;
      }

      periodeSet.add(periode);
      processedRows++;
    }

    const periodeList = Array.from(periodeSet).sort();

    await createAuditLog({
      idPengguna: session.user.id,
      entitas: "IMPOR_KINERJA",
      idRekaman: periodeList.length > 0 ? periodeList.join(",") : "TANPA_PERIODE",
      aksi: "IMPORT_EXCEL",
      nilaiBaru: {
        fileName: file.name,
        periodeList,
        totalRows,
        processedRows,
        insertedCount,
        updatedCount,
        errorCount: errors.length,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/impor");
    revalidatePath("/pimpinan");

    return NextResponse.json({
      totalRows,
      processedRows,
      insertedCount,
      updatedCount,
      anomaliCount: 0,
      autoLunasCount: 0,
      periodeList,
      errors,
    });
  } catch (error) {
    console.error("[ImportKinerja] Gagal memproses berkas Excel:", error);
    return NextResponse.json(
      {
        error:
          "Terjadi kesalahan saat membaca atau memproses berkas Excel Kinerja. Pastikan berkas .xlsx tidak rusak.",
      },
      { status: 500 }
    );
  }
}
