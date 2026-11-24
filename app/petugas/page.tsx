import type { StatusRekonsiliasi } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { evaluateActiveReminders } from "@/lib/reminder-evaluator";
import {
  DaftarTugasClient,
  type PetugasTugasItem,
} from "@/components/petugas/daftar-tugas-client";
import { ReminderPriorityBanner } from "@/components/shared/reminder-priority-banner";

const STATUS_PRIORITY_ORDER: Record<StatusRekonsiliasi, number> = {
  OVERDUE: 1,
  MASA_JANJI_BAYAR: 2,
  BELUM_TERTAGIH: 3,
  DITINDAKLANJUTI: 4,
  KLAIM_LAPANGAN: 5,
  LUNAS_RESMI: 6,
  UNASSIGNED: 7,
};

export default async function PetugasHomePage() {
  const session = await requireRole(["PETUGAS"]);

  try {
    await evaluateActiveReminders({ source: "PAGE_LOAD" });
  } catch (error) {
    console.error(
      "[PetugasHomePage] Gagal mengevaluasi pengingat otomatis:",
      error
    );
  }

  const daftarPiutang = await prisma.piutang.findMany({
    where: {
      idPetugas: session.user.id,
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
      _count: {
        select: {
          riwayatPenagihan: true,
        },
      },
      riwayatPenagihan: {
        orderBy: [{ waktuInput: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          id: true,
          waktuInput: true,
          bentukPenyelesaian: true,
          rentangJanjiBayar: true,
        },
      },
    },
  });

  // Urutkan otomatis berdasarkan prioritas penagihan lalu nominal tagihan terbesar
  const sortedPiutang = [...daftarPiutang].sort((a, b) => {
    const priorityDiff =
      (STATUS_PRIORITY_ORDER[a.statusRekonsiliasi] ?? 99) -
      (STATUS_PRIORITY_ORDER[b.statusRekonsiliasi] ?? 99);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    if (b.nilaiTagihan > a.nilaiTagihan) return 1;
    if (b.nilaiTagihan < a.nilaiTagihan) return -1;
    return a.id - b.id;
  });

  const periodeSet = new Set<string>();
  const tasks: PetugasTugasItem[] = sortedPiutang.map((item) => {
    periodeSet.add(item.periode);
    const lastVisit = item.riwayatPenagihan[0] ?? null;

    return {
      id: item.id,
      idPelanggan: item.idPelanggan,
      periode: item.periode,
      jumlahLembar: item.jumlahLembar,
      nilaiTagihan: item.nilaiTagihan.toString(),
      statusRekonsiliasi: item.statusRekonsiliasi,
      pelanggan: item.pelanggan,
      jumlahKunjungan: item._count.riwayatPenagihan,
      kunjunganTerakhir: lastVisit
        ? {
            id: lastVisit.id,
            waktuInput: lastVisit.waktuInput.toISOString(),
            bentukPenyelesaian: lastVisit.bentukPenyelesaian,
            rentangJanjiBayar: lastVisit.rentangJanjiBayar,
          }
        : null,
    };
  });

  const periodeList = Array.from(periodeSet).sort((a, b) => b.localeCompare(a));

  let overdueCount = 0;
  let masaJanjiBayarCount = 0;
  let overdueNominal = BigInt(0);

  for (const item of sortedPiutang) {
    if (item.statusRekonsiliasi === "OVERDUE") {
      overdueCount++;
      overdueNominal += item.nilaiTagihan;
    } else if (item.statusRekonsiliasi === "MASA_JANJI_BAYAR") {
      masaJanjiBayarCount++;
    }
  }

  return (
    <div className="space-y-4">
      <ReminderPriorityBanner
        variant="petugas"
        overdueCount={overdueCount}
        masaJanjiBayarCount={masaJanjiBayarCount}
        overdueNominal={overdueNominal}
        ctaHref="/petugas/pengingat"
        ctaLabel="Lihat Daftar Janji Bayar"
      />
      <DaftarTugasClient
        tasks={tasks}
        periodeList={periodeList}
        petugasUsername={session.user.username}
      />
    </div>
  );
}
