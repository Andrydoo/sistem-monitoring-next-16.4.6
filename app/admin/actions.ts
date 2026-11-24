"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PeranPengguna, StatusRekonsiliasi } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface AdminActionResult {
  success: boolean;
  message: string;
}

export type LookupPelangganResult =
  | {
      found: true;
      pelanggan: {
        idPelanggan: string;
        namaPelanggan: string;
        alamat: string;
        tarif: string;
        daya: number;
        kodeUnit: string | null;
      };
    }
  | {
      found: false;
    };

export type CreatePiutangManualResult =
  | {
      success: true;
      statusRekonsiliasi: StatusRekonsiliasi;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

export interface CreatePiutangManualInput {
  idPelanggan: string;
  namaPelanggan: string;
  alamat: string;
  tarif: string;
  daya: number | string;
  kodeUnit?: string | null;
  periode: string;
  jumlahLembar: number | string;
  nilaiTagihan: number | string;
  idPetugas?: number | string | null;
}

const createPiutangManualSchema = z.object({
  idPelanggan: z
    .string()
    .transform((val) => val.replace(/\s+/g, "").trim())
    .refine((val) => /^\d{8,20}$/.test(val), {
      message:
        "ID Pelanggan harus berupa 8 hingga 20 digit angka (direkomendasikan 12 digit IDPEL PLN).",
    }),
  namaPelanggan: z
    .string()
    .trim()
    .min(2, "Nama pelanggan minimal 2 karakter.")
    .max(150, "Nama pelanggan maksimal 150 karakter."),
  alamat: z
    .string()
    .trim()
    .min(5, "Alamat lengkap pelanggan minimal 5 karakter."),
  tarif: z
    .string()
    .trim()
    .min(1, "Golongan tarif wajib diisi.")
    .max(10, "Golongan tarif maksimal 10 karakter.")
    .transform((val) => val.toUpperCase()),
  daya: z.coerce
    .number()
    .int("Daya (VA) harus berupa bilangan bulat positif.")
    .positive("Daya (VA) harus lebih besar dari 0."),
  kodeUnit: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (val === undefined) return "51304";
      if (val === null) return null;
      const trimmed = val.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .refine((val) => val === null || val.length <= 10, {
      message: "Kode Unit maksimal 10 karakter.",
    }),
  periode: z
    .string()
    .trim()
    .regex(
      /^\d{4}-(0[1-9]|1[0-2])$/,
      "Format periode wajib YYYY-MM (contoh: 2026-09)."
    ),
  jumlahLembar: z.coerce
    .number()
    .int("Jumlah lembar harus berupa bilangan bulat.")
    .min(1, "Jumlah lembar minimal 1."),
  nilaiTagihan: z
    .union([z.string(), z.number()])
    .transform((val, ctx): bigint => {
      if (typeof val === "number") {
        if (!Number.isFinite(val) || !Number.isInteger(val) || val <= 0) {
          ctx.addIssue({
            code: "custom",
            message: "Nilai tagihan harus berupa angka bulat positif (Rp > 0).",
          });
          return z.NEVER;
        }
        return BigInt(val);
      }

      const cleaned = val
        .trim()
        .replace(/^rp\s*/i, "")
        .replace(/\s+/g, "")
        .replace(/\./g, "");

      if (!/^\d+$/.test(cleaned)) {
        ctx.addIssue({
          code: "custom",
          message:
            "Nilai tagihan hanya boleh berisi angka nominal Rupiah positif.",
        });
        return z.NEVER;
      }

      const parsedBigInt = BigInt(cleaned);
      if (parsedBigInt <= BigInt(0)) {
        ctx.addIssue({
          code: "custom",
          message: "Nilai tagihan harus lebih besar dari Rp 0.",
        });
        return z.NEVER;
      }

      return parsedBigInt;
    }),
  idPetugas: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((val, ctx): number | null => {
      if (val === null || val === undefined) return null;
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed === "" || trimmed === "__UNASSIGNED__") return null;
        if (!/^\d+$/.test(trimmed)) {
          ctx.addIssue({
            code: "custom",
            message: "ID Petugas tidak valid.",
          });
          return z.NEVER;
        }
        const num = Number.parseInt(trimmed, 10);
        if (!Number.isSafeInteger(num) || num <= 0) {
          ctx.addIssue({
            code: "custom",
            message: "ID Petugas harus berupa bilangan bulat positif.",
          });
          return z.NEVER;
        }
        return num;
      }
      if (!Number.isInteger(val) || val <= 0) {
        ctx.addIssue({
          code: "custom",
          message: "ID Petugas harus berupa bilangan bulat positif.",
        });
        return z.NEVER;
      }
      return val;
    }),
});

const resolveAnomaliSchema = z.object({
  piutangId: z.number().int().positive("ID Piutang tidak valid."),
  idPetugas: z.number().int().positive("Petugas tujuan wajib dipilih."),
  kodeUnit: z
    .string()
    .trim()
    .min(1, "Kode Unit wajib diisi.")
    .max(10, "Kode Unit maksimal 10 karakter.")
    .default("51304"),
});

const bulkResolveAnomaliSchema = z.object({
  piutangIds: z
    .array(z.number().int().positive())
    .min(1, "Pilih minimal 1 baris piutang anomali."),
  idPetugas: z.number().int().positive("Petugas tujuan wajib dipilih."),
  kodeUnit: z
    .string()
    .trim()
    .min(1, "Kode Unit wajib diisi.")
    .max(10, "Kode Unit maksimal 10 karakter.")
    .default("51304"),
});

const reassignPetugasSchema = z.object({
  piutangIds: z
    .array(z.number().int().positive())
    .min(1, "Pilih minimal 1 data piutang untuk dipindahkan."),
  targetPetugasId: z
    .number()
    .int()
    .positive("Petugas tujuan wajib dipilih."),
});

const createPenggunaSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(50, "Username maksimal 50 karakter.")
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip."
    ),
  nama: z
    .string()
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter.")
    .max(150, "Nama lengkap maksimal 150 karakter."),
  password: z
    .string()
    .min(6, "Kata sandi minimal 6 karakter.")
    .max(100, "Kata sandi maksimal 100 karakter."),
  peran: z.enum(["ADMIN", "PIMPINAN", "PETUGAS"]),
  kodeUnit: z
    .string()
    .trim()
    .max(10, "Kode Unit maksimal 10 karakter.")
    .optional()
    .nullable(),
  isActive: z.boolean().default(true),
});

const updatePenggunaSchema = z.object({
  id: z.number().int().positive("ID Pengguna tidak valid."),
  nama: z
    .string()
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter.")
    .max(150, "Nama lengkap maksimal 150 karakter."),
  peran: z.enum(["ADMIN", "PIMPINAN", "PETUGAS"]),
  kodeUnit: z
    .string()
    .trim()
    .max(10, "Kode Unit maksimal 10 karakter.")
    .optional()
    .nullable(),
  isActive: z.boolean(),
  passwordBaru: z
    .string()
    .max(100, "Kata sandi maksimal 100 karakter.")
    .optional(),
});

function revalidateAllAdminPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/impor");
  revalidatePath("/admin/anomali");
  revalidatePath("/admin/piutang");
  revalidatePath("/admin/pengguna");
  revalidatePath("/pimpinan");
  revalidatePath("/pimpinan/piutang");
  revalidatePath("/petugas");
}

/**
 * 1. Memetakan 1 baris piutang UNASSIGNED ke petugas aktif & mengisi kodeUnit pelanggan.
 */
export async function resolveAnomaliAction(input: {
  piutangId: number;
  idPetugas: number;
  kodeUnit?: string;
}): Promise<AdminActionResult> {
  const session = await requireRole(["ADMIN"]);

  const parsed = resolveAnomaliSchema.safeParse({
    ...input,
    kodeUnit: input.kodeUnit?.trim() || "51304",
  });

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Data pemetaan anomali tidak valid.",
    };
  }

  const { piutangId, idPetugas, kodeUnit } = parsed.data;

  try {
    const petugas = await prisma.pengguna.findFirst({
      where: {
        id: idPetugas,
        peran: "PETUGAS",
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        nama: true,
      },
    });

    if (!petugas) {
      return {
        success: false,
        message: "Petugas tujuan tidak ditemukan atau sedang nonaktif.",
      };
    }

    const piutang = await prisma.piutang.findUnique({
      where: { id: piutangId },
      include: {
        pelanggan: true,
        petugas: {
          select: { id: true, username: true, nama: true },
        },
      },
    });

    if (!piutang) {
      return {
        success: false,
        message: "Rekaman piutang tidak ditemukan di basis data.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.pelanggan.update({
        where: { idPelanggan: piutang.idPelanggan },
        data: { kodeUnit },
      });

      await tx.piutang.update({
        where: { id: piutang.id },
        data: {
          idPetugas: petugas.id,
          statusRekonsiliasi: "BELUM_TERTAGIH",
        },
      });

      await createAuditLog(
        {
          idPengguna: session.user.id,
          entitas: "PIUTANG",
          idRekaman: piutang.id,
          aksi: "RESOLVE_ANOMALI",
          nilaiLama: {
            idPelanggan: piutang.idPelanggan,
            periode: piutang.periode,
            idPetugas: piutang.idPetugas,
            kodeUnit: piutang.pelanggan.kodeUnit,
            statusRekonsiliasi: piutang.statusRekonsiliasi,
          },
          nilaiBaru: {
            idPelanggan: piutang.idPelanggan,
            periode: piutang.periode,
            idPetugas: petugas.id,
            usernamePetugas: petugas.username,
            namaPetugas: petugas.nama,
            kodeUnit,
            statusRekonsiliasi: "BELUM_TERTAGIH",
          },
        },
        tx
      );
    });

    revalidateAllAdminPaths();

    return {
      success: true,
      message: `Anomali pelanggan ${piutang.idPelanggan} berhasil dipetakan ke ${petugas.nama} (@${petugas.username}).`,
    };
  } catch (error) {
    console.error("[resolveAnomaliAction] Error:", error);
    return {
      success: false,
      message: "Terjadi kesalahan server saat memetakan data anomali.",
    };
  }
}

/**
 * 2. Memetakan beberapa piutangIds[] UNASSIGNED sekaligus ke 1 petugas & kodeUnit.
 */
export async function bulkResolveAnomaliAction(input: {
  piutangIds: number[];
  idPetugas: number;
  kodeUnit?: string;
}): Promise<AdminActionResult> {
  const session = await requireRole(["ADMIN"]);

  const parsed = bulkResolveAnomaliSchema.safeParse({
    ...input,
    kodeUnit: input.kodeUnit?.trim() || "51304",
  });

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ??
        "Parameter pemetaan massal tidak valid.",
    };
  }

  const { piutangIds, idPetugas, kodeUnit } = parsed.data;
  const uniqueIds = Array.from(new Set(piutangIds));

  try {
    const petugas = await prisma.pengguna.findFirst({
      where: {
        id: idPetugas,
        peran: "PETUGAS",
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        nama: true,
      },
    });

    if (!petugas) {
      return {
        success: false,
        message: "Petugas tujuan tidak ditemukan atau sedang nonaktif.",
      };
    }

    const daftarPiutang = await prisma.piutang.findMany({
      where: {
        id: { in: uniqueIds },
      },
      include: {
        pelanggan: {
          select: {
            idPelanggan: true,
            kodeUnit: true,
          },
        },
      },
    });

    if (daftarPiutang.length === 0) {
      return {
        success: false,
        message: "Tidak ada rekaman piutang yang cocok untuk dipetakan.",
      };
    }

    const pelangganIds = Array.from(
      new Set(daftarPiutang.map((item) => item.idPelanggan))
    );
    const resolvedPiutangIds = daftarPiutang.map((item) => item.id);

    await prisma.$transaction(async (tx) => {
      await tx.pelanggan.updateMany({
        where: {
          idPelanggan: { in: pelangganIds },
        },
        data: {
          kodeUnit,
        },
      });

      await tx.piutang.updateMany({
        where: {
          id: { in: resolvedPiutangIds },
        },
        data: {
          idPetugas: petugas.id,
          statusRekonsiliasi: "BELUM_TERTAGIH",
        },
      });

      await createAuditLog(
        {
          idPengguna: session.user.id,
          entitas: "PIUTANG",
          idRekaman:
            resolvedPiutangIds.length === 1
              ? String(resolvedPiutangIds[0])
              : `BULK_${resolvedPiutangIds.length}_ITEMS`,
          aksi: "RESOLVE_ANOMALI",
          nilaiLama: {
            count: daftarPiutang.length,
            piutangIds: resolvedPiutangIds,
            idPelangganList: pelangganIds,
          },
          nilaiBaru: {
            count: daftarPiutang.length,
            idPetugas: petugas.id,
            usernamePetugas: petugas.username,
            namaPetugas: petugas.nama,
            kodeUnit,
            statusRekonsiliasi: "BELUM_TERTAGIH",
          },
        },
        tx
      );
    });

    revalidateAllAdminPaths();

    return {
      success: true,
      message: `${daftarPiutang.length} rekaman anomali berhasil dipetakan ke ${petugas.nama} (@${petugas.username}) pada Unit ${kodeUnit}.`,
    };
  } catch (error) {
    console.error("[bulkResolveAnomaliAction] Error:", error);
    return {
      success: false,
      message: "Terjadi kesalahan server saat menjalankan pemetaan massal.",
    };
  }
}

/**
 * 3. Fitur Load Balancing: Memindahkan 1 atau beberapa piutangIds[] ke petugas tujuan.
 * Jika piutang sebelumnya UNASSIGNED dan pelanggan.kodeUnit sudah ada, status berubah ke BELUM_TERTAGIH;
 * jika sudah berstatus lain, status dipertahankan.
 */
export async function reassignPetugasAction(input: {
  piutangIds: number[];
  targetPetugasId: number;
}): Promise<AdminActionResult> {
  const session = await requireRole(["ADMIN"]);

  const parsed = reassignPetugasSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ??
        "Parameter pemindahan petugas tidak valid.",
    };
  }

  const { piutangIds, targetPetugasId } = parsed.data;
  const uniqueIds = Array.from(new Set(piutangIds));

  try {
    const targetPetugas = await prisma.pengguna.findFirst({
      where: {
        id: targetPetugasId,
        peran: "PETUGAS",
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        nama: true,
      },
    });

    if (!targetPetugas) {
      return {
        success: false,
        message: "Petugas tujuan tidak ditemukan atau sedang nonaktif.",
      };
    }

    const daftarPiutang = await prisma.piutang.findMany({
      where: {
        id: { in: uniqueIds },
      },
      include: {
        pelanggan: {
          select: {
            idPelanggan: true,
            namaPelanggan: true,
            kodeUnit: true,
          },
        },
        petugas: {
          select: {
            id: true,
            username: true,
            nama: true,
          },
        },
      },
    });

    if (daftarPiutang.length === 0) {
      return {
        success: false,
        message: "Data piutang yang dipilih tidak ditemukan.",
      };
    }

    await prisma.$transaction(async (tx) => {
      for (const item of daftarPiutang) {
        const hasKodeUnit = Boolean(
          item.pelanggan.kodeUnit && item.pelanggan.kodeUnit.trim().length > 0
        );

        const nextStatus: StatusRekonsiliasi =
          item.statusRekonsiliasi === "UNASSIGNED" && hasKodeUnit
            ? "BELUM_TERTAGIH"
            : item.statusRekonsiliasi;

        await tx.piutang.update({
          where: { id: item.id },
          data: {
            idPetugas: targetPetugas.id,
            statusRekonsiliasi: nextStatus,
          },
        });

        await createAuditLog(
          {
            idPengguna: session.user.id,
            entitas: "PIUTANG",
            idRekaman: item.id,
            aksi: "REASSIGN_PETUGAS",
            nilaiLama: {
              idPelanggan: item.idPelanggan,
              periode: item.periode,
              idPetugasLama: item.idPetugas,
              usernamePetugasLama: item.petugas?.username ?? null,
              namaPetugasLama: item.petugas?.nama ?? "Belum Dipetakan",
              statusRekonsiliasi: item.statusRekonsiliasi,
            },
            nilaiBaru: {
              idPelanggan: item.idPelanggan,
              periode: item.periode,
              idPetugasBaru: targetPetugas.id,
              usernamePetugasBaru: targetPetugas.username,
              namaPetugasBaru: targetPetugas.nama,
              statusRekonsiliasi: nextStatus,
            },
          },
          tx
        );
      }
    });

    revalidateAllAdminPaths();

    return {
      success: true,
      message: `${daftarPiutang.length} penugasan piutang berhasil dipindahkan ke ${targetPetugas.nama} (@${targetPetugas.username}).`,
    };
  } catch (error) {
    console.error("[reassignPetugasAction] Error:", error);
    return {
      success: false,
      message: "Terjadi kesalahan server saat memindahkan penugasan petugas.",
    };
  }
}

/**
 * 4A. Menambah pengguna baru (Admin / Pimpinan / Petugas) dengan bcrypt cost 10.
 */
export async function createPenggunaAction(input: {
  username: string;
  nama: string;
  password: string;
  peran: PeranPengguna;
  kodeUnit?: string | null;
  isActive?: boolean;
}): Promise<AdminActionResult> {
  const session = await requireRole(["ADMIN"]);

  const parsed = createPenggunaSchema.safeParse({
    ...input,
    kodeUnit: input.kodeUnit?.trim() || "51304",
    isActive: input.isActive ?? true,
  });

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ?? "Data pengguna baru tidak valid.",
    };
  }

  const { username, nama, password, peran, kodeUnit, isActive } = parsed.data;
  const normalizedUsername = username.toLowerCase();

  try {
    const existing = await prisma.pengguna.findUnique({
      where: { username: normalizedUsername },
      select: { id: true },
    });

    if (existing) {
      return {
        success: false,
        message: `Username '@${normalizedUsername}' sudah terdaftar. Gunakan username lain.`,
      };
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const createdUser = await prisma.pengguna.create({
      data: {
        username: normalizedUsername,
        nama,
        passwordHash,
        peran,
        kodeUnit: kodeUnit || "51304",
        isActive,
      },
    });

    await createAuditLog({
      idPengguna: session.user.id,
      entitas: "PENGGUNA",
      idRekaman: createdUser.id,
      aksi: "CREATE_PENGGUNA",
      nilaiBaru: {
        id: createdUser.id,
        username: createdUser.username,
        nama: createdUser.nama,
        peran: createdUser.peran,
        kodeUnit: createdUser.kodeUnit,
        isActive: createdUser.isActive,
      },
    });

    revalidateAllAdminPaths();

    return {
      success: true,
      message: `Akun pengguna ${createdUser.nama} (@${createdUser.username}) berhasil ditambahkan.`,
    };
  } catch (error) {
    console.error("[createPenggunaAction] Error:", error);
    return {
      success: false,
      message: "Terjadi kesalahan server saat menambahkan pengguna baru.",
    };
  }
}

/**
 * 4B. Memperbarui profil, peran, kodeUnit, status aktif, dan reset password opsional pengguna.
 * Mencegah Admin menonaktifkan atau menurunkan peran akun dirinya sendiri.
 */
export async function updatePenggunaAction(input: {
  id: number;
  nama: string;
  peran: PeranPengguna;
  kodeUnit?: string | null;
  isActive: boolean;
  passwordBaru?: string;
}): Promise<AdminActionResult> {
  const session = await requireRole(["ADMIN"]);

  const parsed = updatePenggunaSchema.safeParse({
    ...input,
    kodeUnit: input.kodeUnit?.trim() || "51304",
  });

  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ??
        "Data pembaruan pengguna tidak valid.",
    };
  }

  const { id, nama, peran, kodeUnit, isActive, passwordBaru } = parsed.data;
  const trimmedPassword = passwordBaru?.trim() ?? "";

  if (trimmedPassword.length > 0 && trimmedPassword.length < 6) {
    return {
      success: false,
      message: "Kata sandi baru minimal harus 6 karakter.",
    };
  }

  if (id === session.user.id) {
    if (!isActive) {
      return {
        success: false,
        message:
          "Tindakan ditolak: Anda tidak dapat menonaktifkan akun Administrator yang sedang Anda gunakan.",
      };
    }
    if (peran !== "ADMIN") {
      return {
        success: false,
        message:
          "Tindakan ditolak: Anda tidak dapat mengubah peran akun Anda sendiri dari ADMIN.",
      };
    }
  }

  try {
    const existing = await prisma.pengguna.findUnique({
      where: { id },
    });

    if (!existing) {
      return {
        success: false,
        message: "Pengguna tidak ditemukan di basis data.",
      };
    }

    const updateData: {
      nama: string;
      peran: PeranPengguna;
      kodeUnit: string | null;
      isActive: boolean;
      passwordHash?: string;
    } = {
      nama,
      peran,
      kodeUnit: kodeUnit || "51304",
      isActive,
    };

    const passwordReset = trimmedPassword.length >= 6;
    if (passwordReset) {
      updateData.passwordHash = await bcrypt.hash(trimmedPassword, 10);
    }

    const updated = await prisma.pengguna.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog({
      idPengguna: session.user.id,
      entitas: "PENGGUNA",
      idRekaman: updated.id,
      aksi: "UPDATE_PENGGUNA",
      nilaiLama: {
        username: existing.username,
        nama: existing.nama,
        peran: existing.peran,
        kodeUnit: existing.kodeUnit,
        isActive: existing.isActive,
      },
      nilaiBaru: {
        username: updated.username,
        nama: updated.nama,
        peran: updated.peran,
        kodeUnit: updated.kodeUnit,
        isActive: updated.isActive,
        passwordReset,
      },
    });

    revalidateAllAdminPaths();

    return {
      success: true,
      message: `Data pengguna ${updated.nama} (@${updated.username}) berhasil diperbarui${passwordReset ? " beserta kata sandi baru" : ""}.`,
    };
  } catch (error) {
    console.error("[updatePenggunaAction] Error:", error);
    return {
      success: false,
      message: "Terjadi kesalahan server saat memperbarui data pengguna.",
    };
  }
}

/**
 * 5. Mencari identitas pelanggan berdasarkan ID Pelanggan (IDPEL) untuk auto-fill form manual.
 */
export async function lookupPelangganAction(
  idPelanggan: string
): Promise<LookupPelangganResult> {
  await requireRole(["ADMIN"]);

  const cleanedId =
    typeof idPelanggan === "string"
      ? idPelanggan.replace(/\s+/g, "").trim()
      : "";

  if (!cleanedId) {
    return { found: false };
  }

  try {
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { idPelanggan: cleanedId },
      select: {
        idPelanggan: true,
        namaPelanggan: true,
        alamat: true,
        tarif: true,
        daya: true,
        kodeUnit: true,
      },
    });

    if (!pelanggan) {
      return { found: false };
    }

    return {
      found: true,
      pelanggan,
    };
  } catch (error) {
    console.error("[lookupPelangganAction] Error:", error);
    return { found: false };
  }
}

/**
 * 6. Menambahkan data pelanggan & piutang secara manual (melengkapi impor Excel TUL III-09).
 * Menegakkan aturan duplikasi unik (idPelanggan + periode), validasi petugas aktif,
 * status rekonsiliasi UNASSIGNED vs BELUM_TERTAGIH, serta pencatatan AuditLog.
 */
export async function createPiutangManualAction(
  input: CreatePiutangManualInput
): Promise<CreatePiutangManualResult> {
  const session = await requireRole(["ADMIN"]);

  const parsed = createPiutangManualSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ??
        "Data pelanggan dan piutang tidak valid.",
    };
  }

  const {
    idPelanggan,
    namaPelanggan,
    alamat,
    tarif,
    daya,
    kodeUnit,
    periode,
    jumlahLembar,
    nilaiTagihan,
    idPetugas,
  } = parsed.data;

  try {
    // 1. Cek duplikasi unik (idPelanggan + periode) agar tidak menimpa data berjalan
    const existingPiutang = await prisma.piutang.findUnique({
      where: {
        unik_pelanggan_periode: {
          idPelanggan,
          periode,
        },
      },
      select: { id: true },
    });

    if (existingPiutang) {
      return {
        success: false,
        error:
          "Data piutang untuk ID Pelanggan tersebut pada periode ini sudah terdaftar.",
      };
    }

    // 2. Verifikasi petugas aktif apabila idPetugas diisi
    let validPetugas: { id: number; username: string; nama: string } | null =
      null;

    if (idPetugas !== null) {
      validPetugas = await prisma.pengguna.findFirst({
        where: {
          id: idPetugas,
          peran: "PETUGAS",
          isActive: true,
        },
        select: {
          id: true,
          username: true,
          nama: true,
        },
      });

      if (!validPetugas) {
        return {
          success: false,
          error:
            "Petugas penagihan yang dipilih tidak ditemukan atau sedang nonaktif.",
        };
      }
    }

    // 3. Penegakan aturan bisnis Status Rekonsiliasi (UNASSIGNED vs BELUM_TERTAGIH)
    const hasKodeUnit = Boolean(kodeUnit && kodeUnit.trim().length > 0);
    const assignedPetugasId =
      hasKodeUnit && validPetugas ? validPetugas.id : null;
    const statusRekonsiliasi: StatusRekonsiliasi =
      assignedPetugasId !== null && hasKodeUnit
        ? "BELUM_TERTAGIH"
        : "UNASSIGNED";

    // 4. Jalankan upsert pelanggan, create piutang, dan pencatatan AuditLog dalam satu transaksi
    await prisma.$transaction(async (tx) => {
      await tx.pelanggan.upsert({
        where: { idPelanggan },
        create: {
          idPelanggan,
          namaPelanggan,
          alamat,
          tarif,
          daya,
          kodeUnit,
        },
        update: {
          namaPelanggan,
          alamat,
          tarif,
          daya,
          kodeUnit,
        },
      });

      const piutang = await tx.piutang.create({
        data: {
          idPelanggan,
          idPetugas: assignedPetugasId,
          periode,
          jumlahLembar,
          nilaiTagihan,
          statusRekonsiliasi,
        },
      });

      await createAuditLog(
        {
          idPengguna: session.user.id,
          entitas: "PIUTANG",
          idRekaman: String(piutang.id),
          aksi: "CREATE_MANUAL",
          nilaiBaru: {
            idPelanggan,
            namaPelanggan,
            periode,
            jumlahLembar,
            nilaiTagihan,
            idPetugas: assignedPetugasId,
            kodeUnit,
            statusRekonsiliasi,
          },
        },
        tx
      );
    });

    revalidatePath("/admin/piutang");
    revalidatePath("/admin/anomali");
    revalidatePath("/admin");
    revalidatePath("/pimpinan");
    revalidatePath("/pimpinan/piutang");
    revalidatePath("/petugas");

    const message =
      statusRekonsiliasi === "UNASSIGNED"
        ? `Data piutang ${idPelanggan} (${periode}) berhasil disimpan dengan status UNASSIGNED dan masuk ke Antrean Koreksi Admin.`
        : `Data piutang ${idPelanggan} (${periode}) berhasil disimpan dan ditugaskan ke ${validPetugas?.nama ?? "petugas"} (@${validPetugas?.username ?? "-"}).`;

    return {
      success: true,
      statusRekonsiliasi,
      message,
    };
  } catch (error) {
    console.error("[createPiutangManualAction] Error:", error);
    return {
      success: false,
      error: "Terjadi kesalahan server saat menyimpan data piutang manual.",
    };
  }
}
