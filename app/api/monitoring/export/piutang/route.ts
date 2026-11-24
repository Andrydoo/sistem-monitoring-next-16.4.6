import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import type {
  BentukPenyelesaian,
  KategoriPelanggan,
  Prisma,
  StatusRekonsiliasi,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth-guard";
import { formatTanggalWib } from "@/lib/format";
import { RENTANG_JANJI_BAYAR_LABEL_MAP } from "@/lib/janji-bayar";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const VALID_STATUS_SET = new Set<string>([
  "UNASSIGNED",
  "BELUM_TERTAGIH",
  "MASA_JANJI_BAYAR",
  "OVERDUE",
  "DITINDAKLANJUTI",
  "KLAIM_LAPANGAN",
  "LUNAS_RESMI",
]);

const KATEGORI_LABEL_MAP: Record<KategoriPelanggan, string> = {
  KENDALI_PETUGAS: "Kendali Petugas",
  DI_LUAR_KENDALI_PETUGAS: "Di Luar Kendali Petugas",
};

const PENYELESAIAN_LABEL_MAP: Record<BentukPenyelesaian, string> = {
  LUNAS_ONLINE: "Lunas Online",
  TITIP_LUNAS: "Titip Lunas",
  DIPUTUS: "Diputus",
  JANJI_BAYAR: "Janji Bayar",
};

const STATUS_REKONSILIASI_LABEL_MAP: Record<StatusRekonsiliasi, string> = {
  UNASSIGNED: "Belum Dipetakan (Unassigned)",
  BELUM_TERTAGIH: "Belum Tertagih",
  MASA_JANJI_BAYAR: "Masa Janji Bayar",
  OVERDUE: "Overdue",
  DITINDAKLANJUTI: "Ditindaklanjuti",
  KLAIM_LAPANGAN: "Klaim Lapangan",
  LUNAS_RESMI: "Lunas Resmi",
};

const EXPORT_COLUMNS: ReadonlyArray<{
  header: string;
  key: string;
  width: number;
}> = [
  { header: "No", key: "no", width: 7 },
  { header: "Periode", key: "periode", width: 12 },
  { header: "ID Pelanggan", key: "idPelanggan", width: 18 },
  { header: "Nama Pelanggan", key: "namaPelanggan", width: 28 },
  { header: "Tarif", key: "tarif", width: 10 },
  { header: "Daya (VA)", key: "daya", width: 14 },
  { header: "Alamat", key: "alamat", width: 44 },
  { header: "Jumlah Lembar", key: "jumlahLembar", width: 16 },
  { header: "Kode Unit", key: "kodeUnit", width: 13 },
  { header: "Nama Petugas", key: "namaPetugas", width: 22 },
  { header: "Nilai Tagihan (Rp)", key: "nilaiTagihan", width: 22 },
  { header: "Kategori Pelanggan", key: "kategoriPelanggan", width: 25 },
  { header: "Catatan Kendala Lapangan", key: "catatanKendala", width: 38 },
  { header: "Bentuk Penyelesaian", key: "bentukPenyelesaian", width: 22 },
  { header: "Rentang Janji Bayar", key: "rentangJanjiBayar", width: 34 },
  { header: "Status Rekonsiliasi", key: "statusRekonsiliasi", width: 28 },
  { header: "Status Evidence", key: "statusEvidence", width: 28 },
  { header: "URL Evidence Privat", key: "urlEvidence", width: 48 },
  { header: "Koordinat GPS (Lat, Long)", key: "koordinatGps", width: 28 },
  { header: "Alasan Kendala GPS", key: "alasanKendalaGps", width: 32 },
  { header: "Waktu Update Terakhir", key: "waktuUpdateTerakhir", width: 24 },
];

const THIN_SLATE_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF1E293B" } },
  left: { style: "thin", color: { argb: "FF1E293B" } },
  bottom: { style: "medium", color: { argb: "FF0284C7" } },
  right: { style: "thin", color: { argb: "FF1E293B" } },
};

function getWibDateSlug(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  const day = parts.find((p) => p.type === "day")?.value ?? "00";
  return `${year}${month}${day}`;
}

function sanitizeFileSlug(value: string): string {
  return value.replace(/[^0-9A-Za-z_-]/g, "_");
}

export async function GET(req: NextRequest) {
  const authCheck = await requireApiRole(["ADMIN", "PIMPINAN"]);
  if (authCheck.response) {
    return authCheck.response;
  }

  const { session } = authCheck;

  try {
    const searchParams = req.nextUrl.searchParams;
    const rawPeriode = searchParams.get("periode")?.trim() || "";
    const rawPetugas = searchParams.get("petugas")?.trim() || "";
    const rawStatus = searchParams.get("status")?.trim().toUpperCase() || "";
    const rawQ = searchParams.get("q")?.trim() || "";

    const effectivePeriode =
      rawPeriode && rawPeriode.toUpperCase() !== "ALL" ? rawPeriode : "";
    const effectiveStatus =
      rawStatus && rawStatus !== "ALL" && VALID_STATUS_SET.has(rawStatus)
        ? (rawStatus as StatusRekonsiliasi)
        : "";

    const andConditions: Prisma.PiutangWhereInput[] = [];

    if (effectivePeriode) {
      andConditions.push({ periode: effectivePeriode });
    }

    if (rawPetugas.toUpperCase() === "UNASSIGNED") {
      andConditions.push({ idPetugas: null });
    } else if (rawPetugas && rawPetugas.toUpperCase() !== "ALL") {
      if (/^\d+$/.test(rawPetugas)) {
        const parsedPetugasId = Number.parseInt(rawPetugas, 10);
        if (Number.isSafeInteger(parsedPetugasId) && parsedPetugasId > 0) {
          andConditions.push({ idPetugas: parsedPetugasId });
        }
      }
    }

    if (effectiveStatus) {
      andConditions.push({ statusRekonsiliasi: effectiveStatus });
    }

    if (rawQ) {
      andConditions.push({
        OR: [
          { idPelanggan: { contains: rawQ } },
          { pelanggan: { namaPelanggan: { contains: rawQ } } },
          { pelanggan: { alamat: { contains: rawQ } } },
        ],
      });
    }

    const whereClause: Prisma.PiutangWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const rows = await prisma.piutang.findMany({
      where: whereClause,
      orderBy: [
        { periode: "desc" },
        { statusRekonsiliasi: "asc" },
        { nilaiTagihan: "desc" },
      ],
      include: {
        pelanggan: true,
        petugas: {
          select: {
            nama: true,
            username: true,
          },
        },
        riwayatPenagihan: {
          orderBy: [{ waktuInput: "desc" }, { id: "desc" }],
          take: 1,
          include: {
            daftarEvidence: {
              orderBy: { uploadedAt: "desc" },
            },
          },
        },
      },
    });

    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL?.trim() || req.nextUrl.origin
    ).replace(/\/+$/, "");

    const workbook = new ExcelJS.Workbook();
    workbook.creator =
      "Sistem Monitoring Penagihan Piutang PT PLN (Persero) ULP Kraksaan";
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet("Laporan Detail Piutang", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    worksheet.columns = EXPORT_COLUMNS.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width,
    }));

    worksheet.autoFilter = "A1:U1";

    // Styling Baris Header Korporat PT PLN (Deep Navy Slate)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" },
      };
      cell.font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
      cell.border = HEADER_BORDER;
    });
    headerRow.commit();

    // Pemetaan 21 Kolom Data Piutang
    for (let index = 0; index < rows.length; index++) {
      const p = rows[index];
      const latest = p.riwayatPenagihan[0] ?? null;
      const evidences = latest?.daftarEvidence ?? [];

      const kategoriLabel = latest
        ? (KATEGORI_LABEL_MAP[latest.kategoriPelanggan] ??
          latest.kategoriPelanggan)
        : "-";

      const catatanKendala = latest?.catatanKendala?.trim() || "-";

      const bentukPenyelesaianLabel = latest
        ? (PENYELESAIAN_LABEL_MAP[latest.bentukPenyelesaian] ??
          latest.bentukPenyelesaian)
        : "-";

      const rentangJanjiBayarLabel = latest?.rentangJanjiBayar
        ? (RENTANG_JANJI_BAYAR_LABEL_MAP[latest.rentangJanjiBayar] ??
          latest.rentangJanjiBayar)
        : "-";

      const statusRekonsiliasiLabel =
        STATUS_REKONSILIASI_LABEL_MAP[p.statusRekonsiliasi] ??
        p.statusRekonsiliasi;

      const uniqueJenisEvidence = Array.from(
        new Set(evidences.map((ev) => ev.jenisEvidence))
      );
      const statusEvidence =
        uniqueJenisEvidence.length > 0
          ? `Ada (${uniqueJenisEvidence.join(", ")})`
          : "Belum Ada";

      const urlEvidence =
        evidences.length > 0
          ? evidences.map((ev) => `${baseUrl}/api/evidence/${ev.id}`).join(" | ")
          : "-";

      const koordinatGps =
        latest?.latitude != null && latest?.longitude != null
          ? `${Number(latest.latitude).toFixed(7)}, ${Number(latest.longitude).toFixed(7)}`
          : "-";

      const alasanKendalaGps = latest?.alasanKendalaGps?.trim() || "-";

      const latestTimestamp =
        latest && latest.waktuInput.getTime() > p.updatedAt.getTime()
          ? latest.waktuInput
          : p.updatedAt;
      const waktuUpdateTerakhir = formatTanggalWib(latestTimestamp);

      const dataRow = worksheet.addRow({
        no: index + 1,
        periode: String(p.periode),
        idPelanggan: String(p.idPelanggan),
        namaPelanggan: p.pelanggan.namaPelanggan,
        tarif: p.pelanggan.tarif,
        daya: Number(p.pelanggan.daya),
        alamat: p.pelanggan.alamat,
        jumlahLembar: Number(p.jumlahLembar),
        kodeUnit: p.pelanggan.kodeUnit ? String(p.pelanggan.kodeUnit) : "-",
        namaPetugas: p.petugas?.nama || "Belum Dipetakan",
        nilaiTagihan: Number(p.nilaiTagihan),
        kategoriPelanggan: kategoriLabel,
        catatanKendala,
        bentukPenyelesaian: bentukPenyelesaianLabel,
        rentangJanjiBayar: rentangJanjiBayarLabel,
        statusRekonsiliasi: statusRekonsiliasiLabel,
        statusEvidence,
        urlEvidence,
        koordinatGps,
        alasanKendalaGps,
        waktuUpdateTerakhir,
      });

      const isStriped = index % 2 === 1;

      dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = {
          name: "Calibri",
          size: 10,
          color: { argb: "FF0F172A" },
        };
        cell.border = THIN_SLATE_BORDER;

        if (isStriped) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        }

        // Pengaturan perataan dan format angka/teks per kolom
        if (
          colNumber === 1 ||
          colNumber === 6 ||
          colNumber === 8 ||
          colNumber === 11
        ) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
        } else if (colNumber === 2 || colNumber === 5 || colNumber === 9) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else {
          cell.alignment = {
            vertical: "middle",
            horizontal: "left",
            wrapText:
              colNumber === 7 ||
              colNumber === 13 ||
              colNumber === 18 ||
              colNumber === 20,
          };
        }
      });

      // Format eksplisit teks & akuntansi agar ID Pelanggan tidak menjadi notasi ilmiah
      dataRow.getCell(2).numFmt = "@";
      dataRow.getCell(3).numFmt = "@";
      dataRow.getCell(6).numFmt = "#,##0";
      dataRow.getCell(8).numFmt = "#,##0";
      dataRow.getCell(9).numFmt = "@";
      dataRow.getCell(11).numFmt = '"Rp "#,##0';

      dataRow.commit();
    }

    const excelBuffer = await workbook.xlsx.writeBuffer();

    await createAuditLog({
      idPengguna: session.user.id,
      entitas: "EKSPOR_PIUTANG",
      idRekaman: effectivePeriode || "SEMUA",
      aksi: "EXPORT_EXCEL",
      nilaiBaru: {
        peran: session.user.peran,
        filters: {
          periode: effectivePeriode || "ALL",
          petugas: rawPetugas || "ALL",
          status: effectiveStatus || "ALL",
          q: rawQ,
        },
        rowCount: rows.length,
      },
    });

    const periodeSlug = effectivePeriode
      ? sanitizeFileSlug(effectivePeriode)
      : "SEMUA";
    const tanggalSlug = getWibDateSlug(new Date());
    const fileName = `Laporan_Detail_Piutang_ULP_Kraksaan_${periodeSlug}_${tanggalSlug}.xlsx`;

    return new NextResponse(Buffer.from(excelBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[ExportPiutangGET] Gagal mengekspor laporan Excel:", error);
    return NextResponse.json(
      {
        error:
          "Terjadi kesalahan server saat menyusun berkas Excel Laporan Detail Piutang.",
      },
      { status: 500 }
    );
  }
}
