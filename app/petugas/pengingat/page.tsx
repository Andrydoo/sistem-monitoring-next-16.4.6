import { requireRole } from "@/lib/auth-guard";
import { getWibTodayDateOnly } from "@/lib/janji-bayar";
import { prisma } from "@/lib/prisma";
import { evaluateActiveReminders } from "@/lib/reminder-evaluator";
import {
  PengingatClient,
  type PengingatCategory,
  type PetugasPengingatItem,
} from "@/components/petugas/pengingat-client";

const CATEGORY_PRIORITY: Record<PengingatCategory, number> = {
  OVERDUE: 1,
  MASA_JANJI_BAYAR: 2,
  MENDATANG: 3,
};

export default async function PetugasPengingatPage() {
  const session = await requireRole(["PETUGAS"]);

  try {
    await evaluateActiveReminders({ source: "PAGE_LOAD" });
  } catch (error) {
    console.error(
      "[PetugasPengingatPage] Gagal mengevaluasi pengingat otomatis:",
      error
    );
  }

  const todayDate = getWibTodayDateOnly();
  const todayIso = todayDate.toISOString().slice(0, 10);

  const daftarPiutangPengingat = await prisma.piutang.findMany({
    where: {
      idPetugas: session.user.id,
      OR: [
        {
          statusRekonsiliasi: { in: ["OVERDUE", "MASA_JANJI_BAYAR"] },
        },
        {
          riwayatPenagihan: {
            some: {
              pengingat: {
                statusPengingat: { in: ["AKTIF", "OVERDUE"] },
              },
            },
          },
        },
      ],
    },
    include: {
      pelanggan: {
        select: {
          idPelanggan: true,
          namaPelanggan: true,
          alamat: true,
          tarif: true,
          daya: true,
        },
      },
      riwayatPenagihan: {
        orderBy: [{ waktuInput: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          id: true,
          catatanKendala: true,
          rentangJanjiBayar: true,
          pengingat: {
            select: {
              id: true,
              tanggalMulaiRentang: true,
              tanggalJatuhTempo: true,
              statusPengingat: true,
            },
          },
        },
      },
    },
  });

  const mappedItems = daftarPiutangPengingat.map((piutang) => {
    const latestVisit = piutang.riwayatPenagihan[0] ?? null;
    const pengingat = latestVisit?.pengingat ?? null;

    let category: PengingatCategory;
    if (
      piutang.statusRekonsiliasi === "OVERDUE" ||
      pengingat?.statusPengingat === "OVERDUE"
    ) {
      category = "OVERDUE";
    } else if (piutang.statusRekonsiliasi === "MASA_JANJI_BAYAR") {
      category = "MASA_JANJI_BAYAR";
    } else {
      category = "MENDATANG";
    }

    const dueTimestamp = pengingat
      ? pengingat.tanggalJatuhTempo.getTime()
      : Number.MAX_SAFE_INTEGER;

    return {
      dueTimestamp,
      nilaiTagihanBigInt: piutang.nilaiTagihan,
      item: {
        id: piutang.id,
        idPelanggan: piutang.idPelanggan,
        periode: piutang.periode,
        jumlahLembar: piutang.jumlahLembar,
        nilaiTagihan: piutang.nilaiTagihan.toString(),
        statusRekonsiliasi: piutang.statusRekonsiliasi,
        category,
        pelanggan: piutang.pelanggan,
        rentangJanjiBayar: latestVisit?.rentangJanjiBayar ?? null,
        tanggalMulaiRentang: pengingat
          ? pengingat.tanggalMulaiRentang.toISOString()
          : null,
        tanggalJatuhTempo: pengingat
          ? pengingat.tanggalJatuhTempo.toISOString()
          : null,
        statusPengingat: pengingat?.statusPengingat ?? null,
        catatanKendala: latestVisit?.catatanKendala ?? null,
      } satisfies PetugasPengingatItem,
    };
  });

  // Urutkan prioritas: OVERDUE paling atas, lalu tanggalJatuhTempo terdekat
  mappedItems.sort((a, b) => {
    const priorityDiff =
      CATEGORY_PRIORITY[a.item.category] - CATEGORY_PRIORITY[b.item.category];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    if (a.dueTimestamp !== b.dueTimestamp) {
      return a.dueTimestamp - b.dueTimestamp;
    }

    if (b.nilaiTagihanBigInt > a.nilaiTagihanBigInt) return 1;
    if (b.nilaiTagihanBigInt < a.nilaiTagihanBigInt) return -1;
    return a.item.id - b.item.id;
  });

  const sortedItems: PetugasPengingatItem[] = mappedItems.map(
    (entry) => entry.item
  );

  return (
    <PengingatClient
      items={sortedItems}
      todayIso={todayIso}
      petugasNama={session.user.nama}
      petugasUsername={session.user.username}
    />
  );
}
