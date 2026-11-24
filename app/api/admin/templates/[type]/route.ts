import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-guard";
import {
  KINERJA_REQUIRED_HEADERS,
  PIUTANG_REQUIRED_HEADERS,
} from "@/lib/excel-helpers";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ type: string }> }
) {
  const authCheck = await requireApiRole(["ADMIN"]);
  if (authCheck.response) {
    return authCheck.response;
  }

  const { type } = await context.params;
  const normalizedType = type.trim().toLowerCase();

  if (normalizedType !== "piutang" && normalizedType !== "kinerja") {
    return NextResponse.json(
      {
        error:
          "Tipe templat tidak valid. Gunakan parameter 'piutang' atau 'kinerja'.",
      },
      { status: 400 }
    );
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistem Monitoring Piutang PT PLN (Persero) ULP Kraksaan";
  workbook.created = new Date();

  if (normalizedType === "piutang") {
    const sheet = workbook.addWorksheet("Templat Piutang");

    sheet.columns = PIUTANG_REQUIRED_HEADERS.map((header) => ({
      header,
      key: header,
      width:
        header === "alamat"
          ? 48
          : header === "nama_pelanggan" || header === "nama_petugas"
            ? 24
            : header === "id_pelanggan" || header === "username_petugas"
              ? 18
              : 15,
    }));

    sheet.addRow({
      no: 1,
      periode: "2026-09",
      id_pelanggan: "513040100001",
      nama_pelanggan: "Slamet Riyadi",
      tarif: "R1M",
      daya: 900,
      alamat:
        "Jl. Panglima Sudirman No. 45, Kel. Patokan, Kec. Kraksaan, Kab. Probolinggo",
      jumlah_lembar: 2,
      kode_unit: "51304",
      username_petugas: "ptg_01",
      nama_petugas: "Budi Santoso",
      nilai_tagihan: 485200,
    });

    sheet.addRow({
      no: 2,
      periode: "2026-09",
      id_pelanggan: "513040100004",
      nama_pelanggan: "Ahmad Fauzi",
      tarif: "R1M",
      daya: 900,
      alamat:
        "Dusun Tengah RT 04/RW 02, Desa Besuk Agung, Kec. Besuk, Kab. Probolinggo",
      jumlah_lembar: 3,
      kode_unit: "51304",
      username_petugas: "ptg_02",
      nama_petugas: "Agus Pratama",
      nilai_tagihan: 695400,
    });

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    headerRow.commit();
  } else {
    const sheet = workbook.addWorksheet("Templat Kinerja");

    sheet.columns = KINERJA_REQUIRED_HEADERS.map((header) => ({
      header,
      key: header,
      width:
        header === "no" || header === "periode"
          ? 12
          : header === "username_petugas" || header === "nama_petugas"
            ? 22
            : 26,
    }));

    sheet.addRow({
      no: 1,
      periode: "2026-09",
      username_petugas: "ptg_01",
      nama_petugas: "Budi Santoso",
      saldo_akhir_periode: 48520000,
      saldo_akhir_bulan: 21350000,
      rp_pelunasan_pln_mobile: 18450000,
      kali_transaksi_pln_mobile: 42,
      perolehan_migrasi_prabayar: 7,
      perolehan_promo_tematik: 5,
      pelunasan_saldo_prr: 3250000,
    });

    sheet.addRow({
      no: 2,
      periode: "2026-09",
      username_petugas: "ptg_02",
      nama_petugas: "Agus Pratama",
      saldo_akhir_periode: 43200701,
      saldo_akhir_bulan: 19840500,
      rp_pelunasan_pln_mobile: 15920000,
      kali_transaksi_pln_mobile: 36,
      perolehan_migrasi_prabayar: 5,
      perolehan_promo_tematik: 4,
      pelunasan_saldo_prr: 2800000,
    });

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    headerRow.commit();
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName =
    normalizedType === "piutang"
      ? "templat-impor-piutang-ulp-kraksaan.xlsx"
      : "templat-impor-kinerja-ulp-kraksaan.xlsx";

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
