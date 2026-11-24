import type ExcelJS from "exceljs";

export const MAX_EXCEL_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const PERIODE_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const PIUTANG_REQUIRED_HEADERS = [
  "no",
  "periode",
  "id_pelanggan",
  "nama_pelanggan",
  "tarif",
  "daya",
  "alamat",
  "jumlah_lembar",
  "kode_unit",
  "username_petugas",
  "nama_petugas",
  "nilai_tagihan",
] as const;

export const KINERJA_REQUIRED_HEADERS = [
  "no",
  "periode",
  "username_petugas",
  "nama_petugas",
  "saldo_akhir_periode",
  "saldo_akhir_bulan",
  "rp_pelunasan_pln_mobile",
  "kali_transaksi_pln_mobile",
  "perolehan_migrasi_prabayar",
  "perolehan_promo_tematik",
  "pelunasan_saldo_prr",
] as const;

export type PiutangHeaderKey = (typeof PIUTANG_REQUIRED_HEADERS)[number];
export type KinerjaHeaderKey = (typeof KINERJA_REQUIRED_HEADERS)[number];

/**
 * Mengekstrak nilai primitif dari sel ExcelJS yang mungkin berupa
 * RichText, Formula, Hyperlink, Number, String, atau Date.
 */
export function extractCellPrimitive(
  cellValue: ExcelJS.CellValue | unknown
): string | number | boolean | Date | null {
  if (cellValue === null || cellValue === undefined) {
    return null;
  }

  if (
    typeof cellValue === "string" ||
    typeof cellValue === "number" ||
    typeof cellValue === "boolean"
  ) {
    return cellValue;
  }

  if (cellValue instanceof Date) {
    return Number.isNaN(cellValue.getTime()) ? null : cellValue;
  }

  if (typeof cellValue === "object") {
    const obj = cellValue as Record<string, unknown>;

    // Tipe RichText: { richText: [{ text: "..." }] }
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part) =>
          typeof part === "object" && part !== null && "text" in part
            ? String((part as { text: unknown }).text ?? "")
            : ""
        )
        .join("");
    }

    // Tipe Formula / SharedFormula: { formula: "...", result: ... }
    if ("result" in obj) {
      return extractCellPrimitive(obj.result);
    }

    // Tipe Hyperlink: { text: ..., hyperlink: "..." }
    if ("text" in obj && obj.text !== undefined) {
      return extractCellPrimitive(obj.text);
    }

    // Tipe Error sel Excel: { error: "#VALUE!" }
    if ("error" in obj) {
      return null;
    }
  }

  return String(cellValue);
}

/**
 * Membaca nilai sel Excel menjadi string bersih (di-trim).
 */
export function readCellString(cellValue: ExcelJS.CellValue | unknown): string {
  const primitive = extractCellPrimitive(cellValue);
  if (primitive === null || primitive === undefined) {
    return "";
  }

  if (primitive instanceof Date) {
    const year = primitive.getUTCFullYear();
    const month = String(primitive.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  if (typeof primitive === "number") {
    return Number.isFinite(primitive) ? String(primitive) : "";
  }

  return String(primitive).trim();
}

/**
 * Menormalisasi teks header kolom Excel menjadi format snake_case lowercase.
 * Contoh: " Nama Pelanggan " -> "nama_pelanggan", "ID-Pelanggan" -> "id_pelanggan"
 */
export function normalizeExcelHeader(
  rawHeader: ExcelJS.CellValue | unknown
): string {
  const str = readCellString(rawHeader);
  return str
    .trim()
    .toLowerCase()
    .replace(/[\s\-/]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Memvalidasi apakah string periode sesuai dengan format wajib YYYY-MM.
 */
export function isValidPeriode(periode: string): boolean {
  return PERIODE_REGEX.test(periode.trim());
}

/**
 * Membaca dan memvalidasi nilai periode dari sel Excel (harus YYYY-MM).
 */
export function parsePeriodeCell(
  cellValue: ExcelJS.CellValue | unknown
): string | null {
  const str = readCellString(cellValue).trim();
  if (!str) {
    return null;
  }
  return isValidPeriode(str) ? str : null;
}

/**
 * Membaca dan memvalidasi ID Pelanggan (string digit bersih).
 */
export function parseIdPelangganCell(
  cellValue: ExcelJS.CellValue | unknown
): string | null {
  const primitive = extractCellPrimitive(cellValue);
  if (primitive === null) {
    return null;
  }

  let rawStr: string;
  if (typeof primitive === "number") {
    if (!Number.isFinite(primitive)) {
      return null;
    }
    rawStr = Math.trunc(primitive).toString();
  } else {
    rawStr = String(primitive)
      .trim()
      .replace(/^'+/, "")
      .replace(/\s+/g, "");
  }

  if (!/^\d{6,20}$/.test(rawStr)) {
    return null;
  }

  return rawStr;
}

/**
 * Mengonversi nilai sel Excel (nominal Rupiah) menjadi BigInt secara aman.
 * Membersihkan "Rp", titik pemisah ribuan, spasi, dan desimal (,00).
 * Mengembalikan null jika nilai kosong, negatif, atau bukan angka valid.
 */
export function parseRupiahBigInt(
  cellValue: ExcelJS.CellValue | unknown
): bigint | null {
  const primitive = extractCellPrimitive(cellValue);
  if (primitive === null || primitive === undefined) {
    return null;
  }

  if (typeof primitive === "number") {
    if (!Number.isFinite(primitive) || primitive < 0) {
      return null;
    }
    return BigInt(Math.round(primitive));
  }

  if (typeof primitive === "string") {
    const trimmed = primitive.trim();
    if (!trimmed) {
      return null;
    }

    // Jika nilai berupa "-" pada Excel akuntansi (melambangkan Rp 0)
    if (trimmed === "-" || /^rp\s*-$/i.test(trimmed)) {
      return BigInt(0);
    }

    // Bersihkan awalan Rp / IDR dan spasi
    let cleaned = trimmed.replace(/^(rp|idr)\.?\s*/i, "").trim();

    // Hilangkan bagian desimal ",00" di akhir bila menggunakan format Indonesia
    if (/,\d{1,2}$/.test(cleaned)) {
      cleaned = cleaned.replace(/,\d{1,2}$/, "");
    } else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(cleaned)) {
      // Format US: 1,234,567.00
      cleaned = cleaned.replace(/\.\d{1,2}$/, "");
    }

    // Bersihkan titik, koma pemisah ribuan, serta spasi
    cleaned = cleaned.replace(/[.,\s]/g, "");

    if (!/^\d+$/.test(cleaned)) {
      return null;
    }

    try {
      return BigInt(cleaned);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Mengonversi nilai sel Excel menjadi bilangan bulat (integer) non-negatif secara aman.
 * Cocok untuk kolom daya, jumlah_lembar, kali_transaksi_pln_mobile, dsb.
 */
export function parseSafeInteger(
  cellValue: ExcelJS.CellValue | unknown,
  options?: { min?: number }
): number | null {
  const minVal = options?.min ?? 0;
  const primitive = extractCellPrimitive(cellValue);
  if (primitive === null || primitive === undefined) {
    return null;
  }

  if (typeof primitive === "number") {
    if (!Number.isFinite(primitive)) {
      return null;
    }
    const rounded = Math.round(primitive);
    return rounded >= minVal ? rounded : null;
  }

  if (typeof primitive === "string") {
    const trimmed = primitive.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed === "-") {
      return minVal <= 0 ? 0 : null;
    }

    // Bersihkan akhiran satuan seperti "VA" atau "Lembar" serta titik pemisah ribuan
    let cleaned = trimmed.replace(/\b(va|lbr|lembar|kali)\b/gi, "").trim();
    if (/,\d{1,2}$/.test(cleaned)) {
      cleaned = cleaned.replace(/,\d{1,2}$/, "");
    }
    cleaned = cleaned.replace(/[.,\s]/g, "");

    if (!/^-?\d+$/.test(cleaned)) {
      return null;
    }

    const parsed = Number.parseInt(cleaned, 10);
    if (!Number.isSafeInteger(parsed) || parsed < minVal) {
      return null;
    }
    return parsed;
  }

  return null;
}

/**
 * Memvalidasi file unggahan Excel (.xlsx dan ukuran maksimal 10 MB).
 */
export function validateExcelUploadFile(
  file: unknown
): { valid: true; file: File } | { valid: false; error: string } {
  if (!file || !(file instanceof File)) {
    return {
      valid: false,
      error: "Berkas Excel tidak ditemukan pada permintaan unggah.",
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: "Berkas Excel yang diunggah kosong (0 byte).",
    };
  }

  if (file.size > MAX_EXCEL_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: "Ukuran berkas melebihi batas maksimal 10 MB.",
    };
  }

  const fileName = file.name.trim().toLowerCase();
  if (!fileName.endsWith(".xlsx")) {
    return {
      valid: false,
      error: "Format berkas tidak didukung. Wajib menggunakan ekstensi .xlsx.",
    };
  }

  return { valid: true, file };
}

/**
 * Memetakan baris pertama (baris 1) worksheet ExcelJS menjadi peta posisi kolom
 * dan memeriksa kelengkapan seluruh header wajib.
 */
export function extractAndValidateHeaders(
  worksheet: ExcelJS.Worksheet,
  requiredHeaders: readonly string[]
): {
  valid: boolean;
  headerMap: Map<string, number>;
  missingHeaders: string[];
} {
  const headerMap = new Map<string, number>();
  const headerRow = worksheet.getRow(1);

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const normalized = normalizeExcelHeader(cell.value);
    if (normalized && !headerMap.has(normalized)) {
      headerMap.set(normalized, colNumber);
    }
  });

  const missingHeaders = requiredHeaders.filter(
    (reqHeader) => !headerMap.has(reqHeader)
  );

  return {
    valid: missingHeaders.length === 0,
    headerMap,
    missingHeaders,
  };
}

/**
 * Membaca nilai sel pada baris tertentu berdasarkan nama header yang sudah dinormalisasi.
 */
export function getRowCellByHeader(
  row: ExcelJS.Row,
  headerMap: Map<string, number>,
  headerKey: string
): ExcelJS.CellValue {
  const colNumber = headerMap.get(headerKey);
  if (!colNumber) {
    return null;
  }
  return row.getCell(colNumber).value;
}

/**
 * Mengecek apakah seluruh kolom data pada sebuah baris Excel kosong.
 */
export function isWorksheetRowEmpty(
  row: ExcelJS.Row,
  headerMap: Map<string, number>,
  keysToCheck: readonly string[]
): boolean {
  for (const key of keysToCheck) {
    if (key === "no") {
      continue;
    }
    const val = readCellString(getRowCellByHeader(row, headerMap, key));
    if (val !== "") {
      return false;
    }
  }
  return true;
}
