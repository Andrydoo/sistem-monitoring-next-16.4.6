import type { RentangJanjiBayar } from "@prisma/client";

export interface RentangTanggalJanjiBayar {
  tanggalMulaiRentang: Date;
  tanggalJatuhTempo: Date;
}

export interface EvaluasiStatusJanjiBayarResult {
  statusPiutang: "DITINDAKLANJUTI" | "MASA_JANJI_BAYAR" | "OVERDUE";
  statusPengingat: "AKTIF" | "OVERDUE";
}

export const RENTANG_JANJI_BAYAR_OPTIONS: ReadonlyArray<{
  value: RentangJanjiBayar;
  label: string;
  shortLabel: string;
}> = [
  { value: "TGL_1_5", label: "Tanggal 1 s.d. 5", shortLabel: "Tgl 1–5" },
  { value: "TGL_6_10", label: "Tanggal 6 s.d. 10", shortLabel: "Tgl 6–10" },
  { value: "TGL_11_15", label: "Tanggal 11 s.d. 15", shortLabel: "Tgl 11–15" },
  { value: "TGL_16_20", label: "Tanggal 16 s.d. 20", shortLabel: "Tgl 16–20" },
  {
    value: "DI_ATAS_20",
    label: "Di Atas Tanggal 20 (21 s.d. Akhir Bulan)",
    shortLabel: "Di Atas Tgl 20",
  },
];

export const RENTANG_JANJI_BAYAR_LABEL_MAP: Record<RentangJanjiBayar, string> = {
  TGL_1_5: "Tanggal 1 s.d. 5",
  TGL_6_10: "Tanggal 6 s.d. 10",
  TGL_11_15: "Tanggal 11 s.d. 15",
  TGL_16_20: "Tanggal 16 s.d. 20",
  DI_ATAS_20: "Di Atas Tanggal 20 (21 s.d. Akhir Bulan)",
};

const WIB_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const UTC_DATE_DISPLAY_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/**
 * Menormalkan objek Date apa pun ke tengah malam UTC (`YYYY-MM-DDT00:00:00.000Z`)
 * berdasarkan komponen tanggal UTC-nya agar konsisten dengan kolom `@db.Date` MySQL.
 */
function normalizeToUtcDateOnly(date: Date): Date {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal referensi tidak valid.");
  }
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
}

/**
 * Mengembalikan tanggal hari ini berdasarkan zona waktu `Asia/Jakarta` (WIB)
 * dalam bentuk UTC midnight `YYYY-MM-DDT00:00:00.000Z` agar konsisten saat
 * dibandingkan dengan kolom `@db.Date` MySQL.
 */
export function getWibTodayDateOnly(): Date {
  const parts = WIB_DATE_PARTS_FORMATTER.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error("Gagal menentukan tanggal WIB saat ini.");
  }

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Menghitung tanggal mulai rentang dan tanggal jatuh tempo (UTC midnight)
 * dari periode `YYYY-MM` dan enum `RentangJanjiBayar`.
 */
export function hitungRentangTanggalJanjiBayar(
  periode: string,
  rentang: RentangJanjiBayar
): RentangTanggalJanjiBayar {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periode.trim());
  if (!match) {
    throw new Error(
      `Format periode '${periode}' tidak valid. Wajib berformat YYYY-MM.`
    );
  }

  const tahun = Number.parseInt(match[1], 10);
  const bulan = Number.parseInt(match[2], 10);
  const lastDayOfMonth = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();

  let startDay: number;
  let endDay: number;

  switch (rentang) {
    case "TGL_1_5":
      startDay = 1;
      endDay = 5;
      break;
    case "TGL_6_10":
      startDay = 6;
      endDay = 10;
      break;
    case "TGL_11_15":
      startDay = 11;
      endDay = 15;
      break;
    case "TGL_16_20":
      startDay = 16;
      endDay = 20;
      break;
    case "DI_ATAS_20":
      startDay = 21;
      endDay = lastDayOfMonth;
      break;
    default: {
      const exhaustiveCheck: never = rentang;
      throw new Error(`Rentang janji bayar tidak dikenal: ${String(exhaustiveCheck)}`);
    }
  }

  return {
    tanggalMulaiRentang: new Date(Date.UTC(tahun, bulan - 1, startDay, 0, 0, 0, 0)),
    tanggalJatuhTempo: new Date(Date.UTC(tahun, bulan - 1, endDay, 0, 0, 0, 0)),
  };
}

/**
 * Mengevaluasi status piutang dan status pengingat berdasarkan rentang tanggal janji bayar
 * terhadap `referenceDate` (default: tanggal hari ini WIB).
 */
export function evaluasiStatusJanjiBayar(
  tanggalMulaiRentang: Date,
  tanggalJatuhTempo: Date,
  referenceDate?: Date
): EvaluasiStatusJanjiBayarResult {
  const todayMs = normalizeToUtcDateOnly(
    referenceDate ?? getWibTodayDateOnly()
  ).getTime();
  const mulaiMs = normalizeToUtcDateOnly(tanggalMulaiRentang).getTime();
  const jatuhTempoMs = normalizeToUtcDateOnly(tanggalJatuhTempo).getTime();

  if (todayMs > jatuhTempoMs) {
    return {
      statusPiutang: "OVERDUE",
      statusPengingat: "OVERDUE",
    };
  }

  if (todayMs >= mulaiMs && todayMs <= jatuhTempoMs) {
    return {
      statusPiutang: "MASA_JANJI_BAYAR",
      statusPengingat: "AKTIF",
    };
  }

  return {
    statusPiutang: "DITINDAKLANJUTI",
    statusPengingat: "AKTIF",
  };
}

/**
 * Memformat tanggal `@db.Date` (UTC midnight) ke tampilan tanggal Indonesia ringkas.
 */
export function formatTanggalDateOnlyId(date: Date | string): string {
  const parsed = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return UTC_DATE_DISPLAY_FORMATTER.format(parsed);
}
