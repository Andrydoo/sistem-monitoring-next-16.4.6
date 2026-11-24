import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface CreateAuditLogParams {
  idPengguna: number;
  entitas: string;
  idRekaman: string | number;
  aksi: string;
  nilaiLama?: unknown;
  nilaiBaru?: unknown;
  tx?: Prisma.TransactionClient;
}

/**
 * Mengonversi nilai sembarang (termasuk BigInt, Prisma.Decimal, dan Date)
 * menjadi struktur JSON-safe untuk disimpan ke kolom JSON MySQL via Prisma.
 */
export function serializeAuditPayload(
  value: unknown
): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (
    Prisma.Decimal.isDecimal(value) ||
    (typeof value === "object" &&
      value !== null &&
      "d" in value &&
      "e" in value &&
      "s" in value &&
      typeof (value as { toString?: unknown }).toString === "function")
  ) {
    return String(value);
  }

  if (
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeAuditPayload(item));
  }

  if (typeof value === "object") {
    const result: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) {
        result[key] = serializeAuditPayload(val);
      }
    }
    return result as Prisma.InputJsonObject;
  }

  return String(value);
}

/**
 * Mencatat aktivitas perubahan data / autentikasi ke tabel `audit_log`.
 * Mendukung eksekusi di dalam `prisma.$transaction` melalui parameter `tx`
 * dan menangani error secara aman tanpa menjatuhkan alur utama di luar transaksi.
 */
export async function createAuditLog(
  params: CreateAuditLogParams,
  txClient?: Prisma.TransactionClient
): Promise<void> {
  const db = txClient ?? params.tx ?? prisma;

  const serializedOld =
    params.nilaiLama === undefined || params.nilaiLama === null
      ? Prisma.JsonNull
      : (serializeAuditPayload(params.nilaiLama) ?? Prisma.JsonNull);

  const serializedNew =
    params.nilaiBaru === undefined || params.nilaiBaru === null
      ? Prisma.JsonNull
      : (serializeAuditPayload(params.nilaiBaru) ?? Prisma.JsonNull);

  try {
    await db.auditLog.create({
      data: {
        idPengguna: params.idPengguna,
        entitas: params.entitas.slice(0, 50),
        idRekaman: String(params.idRekaman).slice(0, 50),
        aksi: params.aksi.slice(0, 30),
        nilaiLama: serializedOld,
        nilaiBaru: serializedNew,
      },
    });
  } catch (error) {
    console.error(
      `[AuditLog] Gagal mencatat audit (${params.entitas}:${params.idRekaman} - ${params.aksi}):`,
      error
    );
  }
}
