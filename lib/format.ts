const idNumberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
});

const wibDateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Mengembalikan format mata uang Rupiah formal Indonesia (contoh: "Rp 91.720.701")
 * tanpa desimal ",00" dan dengan satu spasi setelah "Rp".
 */
export function formatRupiah(value: number | bigint | string): string {
  if (typeof value === "bigint") {
    const isNegative = value < BigInt(0);
    const absVal = isNegative ? -value : value;
    return `${isNegative ? "-Rp " : "Rp "}${idNumberFormatter.format(absVal)}`;
  }

  let numericValue: number;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed)) {
      const bigVal = BigInt(trimmed);
      const isNegative = bigVal < BigInt(0);
      const absVal = isNegative ? -bigVal : bigVal;
      return `${isNegative ? "-Rp " : "Rp "}${idNumberFormatter.format(absVal)}`;
    }
    numericValue = Number(trimmed);
  } else {
    numericValue = value;
  }

  if (!Number.isFinite(numericValue)) {
    return "Rp 0";
  }

  const rounded = Math.round(numericValue);
  const isNegative = rounded < 0;
  const absVal = Math.abs(rounded);
  return `${isNegative ? "-Rp " : "Rp "}${idNumberFormatter.format(absVal)}`;
}

/**
 * Mengembalikan format daya listrik pelanggan (contoh: "900 VA" atau "1.300 VA").
 */
export function formatDaya(daya: number): string {
  if (!Number.isFinite(daya)) {
    return "0 VA";
  }
  return `${idNumberFormatter.format(Math.round(daya))} VA`;
}

/**
 * Mengembalikan format tanggal dan jam zona waktu Asia/Jakarta (WIB).
 */
export function formatTanggalWib(date: Date | string): string {
  const parsedDate = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }
  return `${wibDateTimeFormatter.format(parsedDate).replace(/\./g, ":")} WIB`;
}

/**
 * Mengubah seluruh nilai BigInt di dalam objek/array menjadi string atau number
 * secara aman agar dapat dikirim ke Client Components atau JSON Response.
 */
export function serializeBigInt<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "bigint") {
    const asNumber = Number(data);
    return (
      Number.isSafeInteger(asNumber) ? asNumber : data.toString()
    ) as unknown as T;
  }

  if (data instanceof Date) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => serializeBigInt(item)) as unknown as T;
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>).map(
      ([key, value]) => [key, serializeBigInt(value)]
    );
    return Object.fromEntries(entries) as T;
  }

  return data;
}
