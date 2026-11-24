import { z } from "zod";
import {
  Prisma,
  type BentukPenyelesaian,
  type JenisEvidence,
  type KategoriPelanggan,
  type RentangJanjiBayar,
} from "@prisma/client";
import {
  EvidenceValidationError,
  validateEvidenceFile,
  type AllowedEvidenceMimeType,
} from "@/lib/evidence-storage";

const KATEGORI_VALUES = ["KENDALI_PETUGAS", "DI_LUAR_KENDALI_PETUGAS"] as const;
const PENYELESAIAN_VALUES = [
  "LUNAS_ONLINE",
  "TITIP_LUNAS",
  "DIPUTUS",
  "JANJI_BAYAR",
] as const;
const RENTANG_VALUES = [
  "TGL_1_5",
  "TGL_6_10",
  "TGL_11_15",
  "TGL_16_20",
  "DI_ATAS_20",
] as const;
const JENIS_EVIDENCE_VALUES = ["PENYAMPAIAN", "PEMUTUSAN"] as const;

export const MAX_PHOTOS_PER_SUBMISSION = 5;

const basePenagihanFormSchema = z.object({
  kategoriPelanggan: z.enum(KATEGORI_VALUES, {
    error: "Kategori pelanggan wajib dipilih dengan nilai yang valid.",
  }),
  catatanKendala: z.string().trim().max(2000, "Catatan kendala maksimal 2.000 karakter."),
  bentukPenyelesaian: z.enum(PENYELESAIAN_VALUES, {
    error: "Bentuk penyelesaian wajib dipilih dengan nilai yang valid.",
  }),
  rentangJanjiBayarRaw: z.string().trim(),
  latitudeRaw: z.string().trim(),
  longitudeRaw: z.string().trim(),
  alasanKendalaGps: z
    .string()
    .trim()
    .max(1000, "Alasan kendala GPS maksimal 1.000 karakter."),
});

export interface ValidatedUploadedPhoto {
  file: File;
  jenisEvidence: JenisEvidence;
  validated: {
    buffer: Buffer;
    mimeType: AllowedEvidenceMimeType;
    extension: string;
    fileSizeKb: number;
  };
}

export interface ParsedPenagihanSubmission {
  kategoriPelanggan: KategoriPelanggan;
  catatanKendala: string | null;
  bentukPenyelesaian: BentukPenyelesaian;
  rentangJanjiBayar: RentangJanjiBayar | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  hasGps: boolean;
  alasanKendalaGps: string | null;
  uploadedPhotos: ValidatedUploadedPhoto[];
  removeEvidenceIds: number[];
}

function readFormString(formData: FormData, key: string): string {
  const val = formData.get(key);
  return typeof val === "string" ? val : "";
}

function parseRemoveEvidenceIds(formData: FormData): number[] {
  const rawValues = formData.getAll("removeEvidenceIds");
  const parsedIds = new Set<number>();

  for (const item of rawValues) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("[")) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr)) {
          for (const el of arr) {
            const num = Number(el);
            if (Number.isInteger(num) && num > 0) {
              parsedIds.add(num);
            }
          }
        }
      } catch {
        // Abaikan JSON rusak; akan ditolak bila tidak valid
      }
    } else {
      const num = Number.parseInt(trimmed, 10);
      if (Number.isInteger(num) && num > 0) {
        parsedIds.add(num);
      }
    }
  }

  return Array.from(parsedIds);
}

function collectUploadedPhotoPairs(formData: FormData): Array<{
  file: File;
  jenisRaw: string;
}> {
  const pairs: Array<{ file: File; jenisRaw: string }> = [];

  const collectGroup = (fileKey: string, jenisKey: string) => {
    const rawFiles = formData.getAll(fileKey);
    const rawJenisList = formData.getAll(jenisKey);

    for (let i = 0; i < rawFiles.length; i++) {
      const candidate = rawFiles[i];
      if (!(candidate instanceof File)) continue;
      // Abaikan input file HTML kosong tanpa nama dan 0 byte
      if (candidate.size === 0 && candidate.name.trim() === "") continue;

      const jenisCandidate = rawJenisList[i] ?? rawJenisList[0];
      const jenisRaw =
        typeof jenisCandidate === "string" ? jenisCandidate.trim().toUpperCase() : "";

      pairs.push({ file: candidate, jenisRaw });
    }
  };

  collectGroup("evidenceFile", "jenisEvidence");
  collectGroup("evidenceFiles", "jenisEvidences");

  const penyampaianExtras = formData.getAll("evidenceFilePenyampaian");
  for (const candidate of penyampaianExtras) {
    if (candidate instanceof File && (candidate.size > 0 || candidate.name.trim() !== "")) {
      pairs.push({ file: candidate, jenisRaw: "PENYAMPAIAN" });
    }
  }

  const pemutusanExtras = formData.getAll("evidenceFilePemutusan");
  for (const candidate of pemutusanExtras) {
    if (candidate instanceof File && (candidate.size > 0 || candidate.name.trim() !== "")) {
      pairs.push({ file: candidate, jenisRaw: "PEMUTUSAN" });
    }
  }

  return pairs;
}

/**
 * Mem-parsing dan memvalidasi seluruh aturan kondisional FormData kunjungan lapangan
 * untuk `POST /api/petugas/penagihan` dan `PATCH /api/petugas/penagihan/[id]`.
 */
export async function parseAndValidatePenagihanFormData(
  formData: FormData,
  options?: {
    existingEvidence?: Array<{ id: number; jenisEvidence: JenisEvidence }>;
  }
): Promise<
  | { success: true; data: ParsedPenagihanSubmission }
  | { success: false; error: string }
> {
  const baseParsed = basePenagihanFormSchema.safeParse({
    kategoriPelanggan: readFormString(formData, "kategoriPelanggan").toUpperCase(),
    catatanKendala: readFormString(formData, "catatanKendala"),
    bentukPenyelesaian: readFormString(formData, "bentukPenyelesaian").toUpperCase(),
    rentangJanjiBayarRaw: readFormString(formData, "rentangJanjiBayar").toUpperCase(),
    latitudeRaw: readFormString(formData, "latitude"),
    longitudeRaw: readFormString(formData, "longitude"),
    alasanKendalaGps: readFormString(formData, "alasanKendalaGps"),
  });

  if (!baseParsed.success) {
    return {
      success: false,
      error: baseParsed.error.issues[0]?.message ?? "Data kunjungan tidak valid.",
    };
  }

  const {
    kategoriPelanggan,
    catatanKendala,
    bentukPenyelesaian,
    rentangJanjiBayarRaw,
    latitudeRaw,
    longitudeRaw,
    alasanKendalaGps,
  } = baseParsed.data;

  // Aturan Kondisional 1: DI_LUAR_KENDALI_PETUGAS wajib isi catatanKendala >= 5 karakter
  if (kategoriPelanggan === "DI_LUAR_KENDALI_PETUGAS" && catatanKendala.length < 5) {
    return {
      success: false,
      error:
        "Catatan kendala wajib diisi minimal 5 karakter untuk kategori Di Luar Kendali Petugas.",
    };
  }

  // Aturan Kondisional 2: JANJI_BAYAR wajib rentangJanjiBayar valid; selain itu null
  let rentangJanjiBayar: RentangJanjiBayar | null = null;
  if (bentukPenyelesaian === "JANJI_BAYAR") {
    const rentangSchema = z.enum(RENTANG_VALUES);
    const parsedRentang = rentangSchema.safeParse(rentangJanjiBayarRaw);
    if (!parsedRentang.success) {
      return {
        success: false,
        error: "Rentang janji bayar wajib dipilih saat penyelesaian adalah Janji Bayar.",
      };
    }
    rentangJanjiBayar = parsedRentang.data;
  }

  // Aturan Kondisional 4: Validasi GPS Fallback & Rentang Koordinat
  const hasRawLat = latitudeRaw.length > 0;
  const hasRawLng = longitudeRaw.length > 0;

  let latitude: Prisma.Decimal | null = null;
  let longitude: Prisma.Decimal | null = null;
  let hasGps = false;
  let cleanAlasanGps: string | null = alasanKendalaGps.length > 0 ? alasanKendalaGps : null;

  if (hasRawLat && hasRawLng) {
    const latNum = Number(latitudeRaw);
    const lngNum = Number(longitudeRaw);

    if (
      !Number.isFinite(latNum) ||
      !Number.isFinite(lngNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lngNum < -180 ||
      lngNum > 180
    ) {
      return {
        success: false,
        error:
          "Koordinat GPS tidak valid. Latitude harus antara -90 s.d. 90 dan Longitude antara -180 s.d. 180.",
      };
    }

    latitude = new Prisma.Decimal(latNum.toFixed(7));
    longitude = new Prisma.Decimal(lngNum.toFixed(7));
    hasGps = true;
    cleanAlasanGps = null;
  } else {
    // Jika salah satu kosong/gagal terkunci, koordinat dikosongkan & alasanKendalaGps wajib >= 5 karakter
    if (alasanKendalaGps.length < 5) {
      return {
        success: false,
        error:
          "Koordinat GPS tidak tersedia. Alasan kendala GPS wajib diisi minimal 5 karakter.",
      };
    }
    hasGps = false;
  }

  // Aturan Kondisional 5: Validasi foto yang diunggah (format + magic bytes + <= 300 KB)
  const rawPhotoPairs = collectUploadedPhotoPairs(formData);
  if (rawPhotoPairs.length > MAX_PHOTOS_PER_SUBMISSION) {
    return {
      success: false,
      error: `Maksimal ${MAX_PHOTOS_PER_SUBMISSION} foto bukti dalam satu kali pengiriman laporan.`,
    };
  }

  const jenisSchema = z.enum(JENIS_EVIDENCE_VALUES);
  const uploadedPhotos: ValidatedUploadedPhoto[] = [];

  for (const pair of rawPhotoPairs) {
    const parsedJenis = jenisSchema.safeParse(pair.jenisRaw);
    if (!parsedJenis.success) {
      return {
        success: false,
        error:
          "Jenis evidence setiap foto wajib bernilai 'PENYAMPAIAN' atau 'PEMUTUSAN'.",
      };
    }

    try {
      const validated = await validateEvidenceFile(pair.file);
      uploadedPhotos.push({
        file: pair.file,
        jenisEvidence: parsedJenis.data,
        validated,
      });
    } catch (error) {
      if (error instanceof EvidenceValidationError) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: "Berkas foto evidence gagal divalidasi oleh server.",
      };
    }
  }

  const removeEvidenceIds = parseRemoveEvidenceIds(formData);
  const removeEvidenceIdSet = new Set(removeEvidenceIds);

  // Aturan Kondisional 3: DIPUTUS wajib minimal 1 foto berjenis PEMUTUSAN
  const newPemutusanCount = uploadedPhotos.filter(
    (item) => item.jenisEvidence === "PEMUTUSAN"
  ).length;
  const remainingExistingPemutusanCount = (options?.existingEvidence ?? []).filter(
    (item) =>
      item.jenisEvidence === "PEMUTUSAN" && !removeEvidenceIdSet.has(item.id)
  ).length;

  if (
    bentukPenyelesaian === "DIPUTUS" &&
    remainingExistingPemutusanCount + newPemutusanCount < 1
  ) {
    return {
      success: false,
      error:
        "Bentuk penyelesaian DIPUTUS wajib melampirkan minimal 1 foto bukti berjenis PEMUTUSAN.",
    };
  }

  return {
    success: true,
    data: {
      kategoriPelanggan,
      catatanKendala: catatanKendala.length > 0 ? catatanKendala : null,
      bentukPenyelesaian,
      rentangJanjiBayar,
      latitude,
      longitude,
      hasGps,
      alasanKendalaGps: cleanAlasanGps,
      uploadedPhotos,
      removeEvidenceIds,
    },
  };
}
