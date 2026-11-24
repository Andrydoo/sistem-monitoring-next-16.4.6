import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import type { JenisEvidence } from "@prisma/client";

export const EVIDENCE_ROOT = path.resolve(process.cwd(), "storage", "evidence");
export const MAX_EVIDENCE_BYTES = 300 * 1024; // 300 KB

export type AllowedEvidenceMimeType = "image/jpeg" | "image/png" | "image/webp";

const ALLOWED_MIME_EXTENSION_MAP: Record<AllowedEvidenceMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXTENSION_MIME_MAP: Record<string, AllowedEvidenceMimeType> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const PERIODE_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const SAFE_RELATIVE_PATH_REGEX =
  /^\d{4}-(0[1-9]|1[0-2])\/[1-9]\d*\/[a-z0-9_]+\.(jpg|png|webp)$/;

export class EvidenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceValidationError";
  }
}

export class EvidencePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidencePathError";
  }
}

function getEvidenceRootWithSep(): string {
  return EVIDENCE_ROOT.endsWith(path.sep)
    ? EVIDENCE_ROOT
    : `${EVIDENCE_ROOT}${path.sep}`;
}

/**
 * Mendeteksi format gambar asli berdasarkan magic bytes header file.
 */
export function detectImageMagicMimeType(
  buffer: Buffer
): AllowedEvidenceMimeType | null {
  // JPEG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP pada offset 8..11)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Memvalidasi file upload evidence (ukuran <= 300 KB, MIME valid, dan magic bytes cocok).
 */
export async function validateEvidenceFile(file: File): Promise<{
  buffer: Buffer;
  mimeType: AllowedEvidenceMimeType;
  extension: string;
  fileSizeKb: number;
}> {
  if (!(file instanceof File)) {
    throw new EvidenceValidationError("Berkas evidence tidak valid.");
  }

  if (file.size <= 0) {
    throw new EvidenceValidationError(
      "Berkas foto evidence kosong dan tidak dapat diproses."
    );
  }

  if (file.size > MAX_EVIDENCE_BYTES) {
    const actualKb = Math.ceil(file.size / 1024);
    throw new EvidenceValidationError(
      `Ukuran foto (${actualKb.toLocaleString("id-ID")} KB) melebihi batas maksimal 300 KB.`
    );
  }

  const normalizedMime = file.type.trim().toLowerCase();
  if (
    normalizedMime !== "image/jpeg" &&
    normalizedMime !== "image/png" &&
    normalizedMime !== "image/webp"
  ) {
    throw new EvidenceValidationError(
      "Format foto tidak didukung. Gunakan berkas JPG, PNG, atau WebP."
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length <= 0) {
    throw new EvidenceValidationError(
      "Isi berkas foto kosong dan tidak dapat diproses."
    );
  }

  if (buffer.length > MAX_EVIDENCE_BYTES) {
    const actualKb = Math.ceil(buffer.length / 1024);
    throw new EvidenceValidationError(
      `Ukuran foto (${actualKb.toLocaleString("id-ID")} KB) melebihi batas maksimal 300 KB.`
    );
  }

  const detectedMime = detectImageMagicMimeType(buffer);
  if (!detectedMime || detectedMime !== normalizedMime) {
    throw new EvidenceValidationError(
      "Header biner berkas tidak cocok dengan format gambar JPG/PNG/WebP yang valid."
    );
  }

  return {
    buffer,
    mimeType: detectedMime,
    extension: ALLOWED_MIME_EXTENSION_MAP[detectedMime],
    fileSizeKb: Math.max(1, Math.ceil(buffer.length / 1024)),
  };
}

/**
 * Memastikan relativePath aman dan berada di dalam direktori privat EVIDENCE_ROOT.
 */
function resolveSafeEvidenceFullPath(relativePath: string): string {
  if (typeof relativePath !== "string" || relativePath.trim().length === 0) {
    throw new EvidencePathError("Jalur berkas evidence tidak boleh kosong.");
  }

  if (relativePath.includes("\0") || relativePath.includes("\\")) {
    throw new EvidencePathError("Jalur berkas evidence mengandung karakter terlarang.");
  }

  if (path.isAbsolute(relativePath)) {
    throw new EvidencePathError("Jalur berkas evidence wajib berupa jalur relatif.");
  }

  const segments = relativePath.split("/");
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === ".."
    )
  ) {
    throw new EvidencePathError("Terdeteksi percobaan path traversal pada jalur evidence.");
  }

  const targetFullPath = path.resolve(EVIDENCE_ROOT, ...segments);
  const rootWithSep = getEvidenceRootWithSep();

  if (!targetFullPath.startsWith(rootWithSep)) {
    throw new EvidencePathError(
      "Jalur target berada di luar direktori penyimpanan privat evidence."
    );
  }

  return targetFullPath;
}

export interface SavePrivateEvidenceFileParams {
  file: File;
  periode: string;
  idPiutang: number;
  jenisEvidence: JenisEvidence;
  validated?: {
    buffer: Buffer;
    extension: string;
    fileSizeKb: number;
  };
}

export interface SavePrivateEvidenceFileResult {
  relativePath: string;
  fileSizeKb: number;
}

/**
 * Menyimpan berkas foto evidence ke direktori privat `./storage/evidence/{periode}/{id_piutang}/`
 * dengan validasi ketat format, ukuran <= 300 KB, dan proteksi path traversal.
 */
export async function savePrivateEvidenceFile({
  file,
  periode,
  idPiutang,
  jenisEvidence,
  validated,
}: SavePrivateEvidenceFileParams): Promise<SavePrivateEvidenceFileResult> {
  const cleanPeriode = periode.trim();
  if (!PERIODE_REGEX.test(cleanPeriode)) {
    throw new EvidenceValidationError(
      `Periode '${periode}' tidak valid untuk penyimpanan evidence (wajib YYYY-MM).`
    );
  }

  if (!Number.isInteger(idPiutang) || idPiutang <= 0) {
    throw new EvidenceValidationError("ID Piutang harus berupa bilangan bulat positif.");
  }

  if (jenisEvidence !== "PENYAMPAIAN" && jenisEvidence !== "PEMUTUSAN") {
    throw new EvidenceValidationError("Jenis evidence tidak valid.");
  }

  const verified = validated ?? (await validateEvidenceFile(file));

  const timestamp = Date.now();
  const randomHex = crypto.randomBytes(6).toString("hex");
  const fileName = `${jenisEvidence.toLowerCase()}_${timestamp}_${randomHex}.${verified.extension}`;
  const relativePath = `${cleanPeriode}/${idPiutang}/${fileName}`;

  if (!SAFE_RELATIVE_PATH_REGEX.test(relativePath)) {
    throw new EvidencePathError("Format jalur file evidence hasil generasi tidak valid.");
  }

  const targetFullPath = resolveSafeEvidenceFullPath(relativePath);
  const targetDir = path.dirname(targetFullPath);

  if (!targetDir.startsWith(getEvidenceRootWithSep())) {
    throw new EvidencePathError(
      "Direktori target berada di luar batas root penyimpanan privat."
    );
  }

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetFullPath, verified.buffer);

  return {
    relativePath,
    fileSizeKb: verified.fileSizeKb,
  };
}

export interface ReadPrivateEvidenceFileResult {
  buffer: Buffer;
  mimeType: AllowedEvidenceMimeType;
  fileName: string;
}

/**
 * Membaca berkas foto evidence dari direktori privat setelah memvalidasi path traversal.
 */
export async function readPrivateEvidenceFile(
  relativePath: string
): Promise<ReadPrivateEvidenceFileResult> {
  const targetFullPath = resolveSafeEvidenceFullPath(relativePath);
  const buffer = await fs.readFile(targetFullPath);
  const fileName = path.basename(targetFullPath);
  const ext = path.extname(fileName).toLowerCase();

  const detectedMime = detectImageMagicMimeType(buffer);
  const extMime = EXTENSION_MIME_MAP[ext];
  const mimeType = detectedMime ?? extMime;

  if (!mimeType) {
    throw new EvidenceValidationError("Format biner evidence di penyimpanan tidak dikenali.");
  }

  return {
    buffer,
    mimeType,
    fileName,
  };
}

/**
 * Menghapus berkas foto evidence dari direktori privat (digunakan saat rollback
 * transaksi atau pembersihan berkas yang diganti), dengan proteksi path traversal.
 */
export async function deletePrivateEvidenceFile(
  relativePath: string
): Promise<void> {
  const targetFullPath = resolveSafeEvidenceFullPath(relativePath);
  try {
    await fs.unlink(targetFullPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      throw error;
    }
  }
}
