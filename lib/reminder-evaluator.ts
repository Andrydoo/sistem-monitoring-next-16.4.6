import { createAuditLog } from "@/lib/audit";
import { formatTanggalWib } from "@/lib/format";
import {
  evaluasiStatusJanjiBayar,
  getWibTodayDateOnly,
} from "@/lib/janji-bayar";
import { prisma } from "@/lib/prisma";

export type EvaluateRemindersSource = "CRON" | "ADMIN_MANUAL" | "PAGE_LOAD";

export interface EvaluateRemindersOptions {
  referenceDate?: Date;
  triggeredByUserId?: number | null;
  source?: EvaluateRemindersSource;
}

export interface EvaluateRemindersResult {
  evaluatedAtWib: string;
  referenceDate: string;
  totalChecked: number;
  updatedCount: number;
  transitionedToMasaJanjiBayar: number;
  transitionedToOverdue: number;
  resolvedCount: number;
  activeMasaJanjiBayarTotal: number;
  activeOverdueTotal: number;
}

function normalizeUtcDateOnly(date: Date): Date {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Tanggal referensi evaluasi pengingat tidak valid.");
  }
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
}

/**
 * Mesin evaluasi deterministik dan idempotent untuk jadwal Pengingat Janji Bayar.
 *
 * - Menandai Pengingat menjadi `SELESAI` apabila Piutang sudah `LUNAS_RESMI` / `KLAIM_LAPANGAN`
 *   atau apabila kunjungan terakhir pada Piutang bukan lagi Penagihan milik Pengingat tersebut.
 * - Mengevaluasi rentang aktif (`tanggalMulaiRentang` s.d. `tanggalJatuhTempo`) terhadap tanggal WIB
 *   untuk memperbarui status `Pengingat` dan `Piutang` secara atomik di dalam `prisma.$transaction`.
 * - Mencatat `AuditLog` apabila terjadi perubahan data atau apabila dipicu oleh `CRON` / `ADMIN_MANUAL`.
 */
export async function evaluateActiveReminders(
  options?: EvaluateRemindersOptions
): Promise<EvaluateRemindersResult> {
  const source: EvaluateRemindersSource = options?.source ?? "PAGE_LOAD";
  const today = normalizeUtcDateOnly(
    options?.referenceDate ?? getWibTodayDateOnly()
  );
  const referenceDateIso = today.toISOString().slice(0, 10);
  const evaluatedAtWib = formatTanggalWib(new Date());

  const activeReminders = await prisma.pengingat.findMany({
    where: {
      statusPengingat: { in: ["AKTIF", "OVERDUE"] },
    },
    include: {
      penagihan: {
        select: {
          id: true,
          idPiutang: true,
          bentukPenyelesaian: true,
          rentangJanjiBayar: true,
          waktuInput: true,
          piutang: {
            select: {
              id: true,
              periode: true,
              statusRekonsiliasi: true,
              riwayatPenagihan: {
                orderBy: [{ waktuInput: "desc" }, { id: "desc" }],
                take: 1,
                select: {
                  id: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const totalChecked = activeReminders.length;
  let updatedCount = 0;
  let transitionedToMasaJanjiBayar = 0;
  let transitionedToOverdue = 0;
  let resolvedCount = 0;

  for (const pengingat of activeReminders) {
    const { penagihan } = pengingat;
    const { piutang } = penagihan;
    const latestVisit = piutang.riwayatPenagihan[0] ?? null;

    const isPiutangSettled =
      piutang.statusRekonsiliasi === "LUNAS_RESMI" ||
      piutang.statusRekonsiliasi === "KLAIM_LAPANGAN";
    const isSupersededByNewerVisit =
      !latestVisit || latestVisit.id !== pengingat.idPenagihan;

    // Kasus 1: Selesai Otomatis
    if (isPiutangSettled || isSupersededByNewerVisit) {
      await prisma.pengingat.update({
        where: { id: pengingat.id },
        data: { statusPengingat: "SELESAI" },
      });
      resolvedCount++;
      continue;
    }

    // Kasus 2: Evaluasi Rentang Aktif
    const evaluated = evaluasiStatusJanjiBayar(
      pengingat.tanggalMulaiRentang,
      pengingat.tanggalJatuhTempo,
      today
    );

    const needsPengingatUpdate =
      pengingat.statusPengingat !== evaluated.statusPengingat;
    const needsPiutangUpdate =
      piutang.statusRekonsiliasi !== evaluated.statusPiutang;

    if (needsPengingatUpdate || needsPiutangUpdate) {
      await prisma.$transaction(async (tx) => {
        if (needsPengingatUpdate) {
          await tx.pengingat.update({
            where: { id: pengingat.id },
            data: { statusPengingat: evaluated.statusPengingat },
          });
        }
        if (needsPiutangUpdate) {
          await tx.piutang.update({
            where: { id: piutang.id },
            data: { statusRekonsiliasi: evaluated.statusPiutang },
          });
        }
      });

      updatedCount++;

      if (
        needsPiutangUpdate &&
        evaluated.statusPiutang === "MASA_JANJI_BAYAR"
      ) {
        transitionedToMasaJanjiBayar++;
      } else if (
        (needsPiutangUpdate && evaluated.statusPiutang === "OVERDUE") ||
        (needsPengingatUpdate && evaluated.statusPengingat === "OVERDUE")
      ) {
        transitionedToOverdue++;
      }
    }
  }

  const [activeMasaJanjiBayarTotal, activeOverdueTotal] = await Promise.all([
    prisma.piutang.count({
      where: { statusRekonsiliasi: "MASA_JANJI_BAYAR" },
    }),
    prisma.piutang.count({
      where: { statusRekonsiliasi: "OVERDUE" },
    }),
  ]);

  const result: EvaluateRemindersResult = {
    evaluatedAtWib,
    referenceDate: referenceDateIso,
    totalChecked,
    updatedCount,
    transitionedToMasaJanjiBayar,
    transitionedToOverdue,
    resolvedCount,
    activeMasaJanjiBayarTotal,
    activeOverdueTotal,
  };

  // Pencatatan AuditLog: hanya saat ada perubahan atau pemicu bukan PAGE_LOAD
  const shouldWriteAuditLog =
    updatedCount > 0 || resolvedCount > 0 || source !== "PAGE_LOAD";

  if (shouldWriteAuditLog) {
    let actorId = options?.triggeredByUserId ?? null;

    if (!actorId) {
      const firstActiveAdmin = await prisma.pengguna.findFirst({
        where: { peran: "ADMIN", isActive: true },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      actorId = firstActiveAdmin?.id ?? null;
    }

    if (actorId !== null) {
      await createAuditLog({
        idPengguna: actorId,
        entitas: "PENGINGAT",
        idRekaman: referenceDateIso,
        aksi:
          source === "CRON"
            ? "CRON_EVALUATE_REMINDERS"
            : "EVALUATE_REMINDERS",
        nilaiBaru: {
          source,
          ...result,
        },
      });
    }
  }

  return result;
}
