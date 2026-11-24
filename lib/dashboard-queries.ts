import type {
  BentukPenyelesaian,
  JenisEvidence,
  KategoriPelanggan,
  Prisma,
  RentangJanjiBayar,
  StatusPengingat,
  StatusRekonsiliasi,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_FALLBACK_PERIODE = "2026-09";

function bigIntToNumber(value: bigint | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}

function decimalToString(
  value: Prisma.Decimal | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value.toString();
}

export interface OfficialBookSummary {
  totalSaldoAkhirPeriode: number;
  totalSaldoAkhirBulan: number;
  totalRpPelunasanPlnMobile: number;
  totalKaliTransaksiPlnMobile: number;
  totalMigrasiPrabayar: number;
  totalPromoTematik: number;
  totalPelunasanSaldoPrr: number;
  petugasTercatatCount: number;
}

export interface FieldOperationalSummary {
  klaimLapanganCount: number;
  klaimLapanganNominal: number;
  lunasResmiCount: number;
  lunasResmiNominal: number;
  overdueCount: number;
  overdueNominal: number;
  masaJanjiBayarCount: number;
  masaJanjiBayarNominal: number;
  unassignedCount: number;
  unassignedNominal: number;
  belumTertagihCount: number;
  belumTertagihNominal: number;
  ditindaklanjutiCount: number;
  ditindaklanjutiNominal: number;
  totalPiutangCount: number;
  totalPiutangNominal: number;
}

export interface PetugasKinerjaComparisonRow {
  petugasId: number;
  nama: string;
  username: string;
  kodeUnit: string | null;
  hasKinerjaRecord: boolean;
  // 7 Indikator Kinerja Resmi (KinerjaPetugas)
  saldoAkhirPeriode: number;
  saldoAkhirBulan: number;
  rpPelunasanPlnMobile: number;
  kaliTransaksiPlnMobile: number;
  perolehanMigrasiPrabayar: number;
  perolehanPromoTematik: number;
  pelunasanSaldoPrr: number;
  // Ringkasan Operasional Lapangan (Terpisah dari Saldo Buku)
  totalTugas: number;
  klaimLapanganCount: number;
  klaimLapanganNominal: number;
  overdueCount: number;
  lunasResmiCount: number;
}

export interface WorkloadPerPetugasItem {
  namaPetugas: string;
  username: string;
  belumTertagih: number;
  masaJanjiBayar: number;
  overdue: number;
  ditindaklanjuti: number;
  klaimLapangan: number;
  lunasResmi: number;
  totalTugas: number;
  totalNominalRp: number;
}

export interface StatusDistributionItem {
  status: StatusRekonsiliasi;
  label: string;
  count: number;
  nominalRp: number;
}

export interface KinerjaComparisonChartItem {
  namaPetugas: string;
  username: string;
  saldoAkhirPeriode: number;
  saldoAkhirBulan: number;
  rpPelunasanPlnMobile: number;
  pelunasanSaldoPrr: number;
}

export interface MonitoringDashboardData {
  activePeriode: string;
  availablePeriods: string[];
  officialSummary: OfficialBookSummary;
  fieldSummary: FieldOperationalSummary;
  petugasComparison: PetugasKinerjaComparisonRow[];
  workloadPerPetugas: WorkloadPerPetugasItem[];
  statusDistribution: StatusDistributionItem[];
  kinerjaComparisonChart: KinerjaComparisonChartItem[];
}

export interface PiutangDetailEvidence {
  id: number;
  jenisEvidence: JenisEvidence;
  fileSizeKb: number | null;
  uploadedAt: string;
}

export interface PiutangDetailPengingat {
  id: number;
  tanggalMulaiRentang: string;
  tanggalJatuhTempo: string;
  statusPengingat: StatusPengingat;
  updatedAt: string;
}

export interface PiutangDetailRiwayat {
  id: number;
  idPetugas: number;
  petugas: {
    id: number;
    nama: string;
    username: string;
  };
  kategoriPelanggan: KategoriPelanggan;
  catatanKendala: string | null;
  bentukPenyelesaian: BentukPenyelesaian;
  rentangJanjiBayar: RentangJanjiBayar | null;
  latitude: string | null;
  longitude: string | null;
  alasanKendalaGps: string | null;
  waktuInput: string;
  updatedAt: string;
  daftarEvidence: PiutangDetailEvidence[];
  pengingat: PiutangDetailPengingat | null;
}

export interface PiutangMonitoringDetail {
  id: number;
  idPelanggan: string;
  periode: string;
  jumlahLembar: number;
  nilaiTagihan: string;
  statusRekonsiliasi: StatusRekonsiliasi;
  createdAt: string;
  updatedAt: string;
  pelanggan: {
    idPelanggan: string;
    namaPelanggan: string;
    alamat: string;
    tarif: string;
    daya: number;
    kodeUnit: string | null;
  };
  petugas: {
    id: number;
    nama: string;
    username: string;
    kodeUnit: string | null;
  } | null;
  riwayatPenagihan: PiutangDetailRiwayat[];
}

const STATUS_LABEL_ORDERED: ReadonlyArray<{
  status: StatusRekonsiliasi;
  label: string;
}> = [
  { status: "OVERDUE", label: "Overdue" },
  { status: "MASA_JANJI_BAYAR", label: "Masa Janji Bayar" },
  { status: "BELUM_TERTAGIH", label: "Belum Tertagih" },
  { status: "DITINDAKLANJUTI", label: "Ditindaklanjuti" },
  { status: "KLAIM_LAPANGAN", label: "Klaim Lapangan" },
  { status: "LUNAS_RESMI", label: "Lunas Resmi" },
  { status: "UNASSIGNED", label: "Unassigned" },
];

/**
 * Mengambil daftar `periode` unik gabungan dari `Piutang` dan `KinerjaPetugas`,
 * diurutkan menurun (terbaru di atas). Jika kosong, mengembalikan `["2026-09"]`.
 */
export async function getAvailablePeriods(): Promise<string[]> {
  const [piutangPeriods, kinerjaPeriods] = await Promise.all([
    prisma.piutang.findMany({
      distinct: ["periode"],
      select: { periode: true },
    }),
    prisma.kinerjaPetugas.findMany({
      distinct: ["periode"],
      select: { periode: true },
    }),
  ]);

  const periodSet = new Set<string>();
  for (const row of piutangPeriods) {
    if (row.periode?.trim()) {
      periodSet.add(row.periode.trim());
    }
  }
  for (const row of kinerjaPeriods) {
    if (row.periode?.trim()) {
      periodSet.add(row.periode.trim());
    }
  }

  if (periodSet.size === 0) {
    return [DEFAULT_FALLBACK_PERIODE];
  }

  return Array.from(periodSet).sort((a, b) => b.localeCompare(a));
}

/**
 * Mesin agregasi dashboard monitoring terpusat untuk modul Admin & Pimpinan.
 * Memisahkan secara ketat Saldo Resmi Buku (KinerjaPetugas) dan Progres
 * Operasional Lapangan (Piutang / KLAIM_LAPANGAN).
 */
export async function getMonitoringDashboardData(
  selectedPeriode?: string
): Promise<MonitoringDashboardData> {
  const availablePeriods = await getAvailablePeriods();
  const normalizedSelected = selectedPeriode?.trim();
  const activePeriode =
    normalizedSelected && availablePeriods.includes(normalizedSelected)
      ? normalizedSelected
      : availablePeriods[0];

  const [kinerjaRows, piutangRows, activePetugasList] = await Promise.all([
    prisma.kinerjaPetugas.findMany({
      where: { periode: activePeriode },
      include: {
        petugas: {
          select: {
            id: true,
            nama: true,
            username: true,
            kodeUnit: true,
          },
        },
      },
    }),
    prisma.piutang.findMany({
      where: { periode: activePeriode },
      include: {
        petugas: {
          select: {
            id: true,
            nama: true,
            username: true,
          },
        },
      },
    }),
    prisma.pengguna.findMany({
      where: {
        peran: "PETUGAS",
        isActive: true,
      },
      orderBy: { nama: "asc" },
      select: {
        id: true,
        nama: true,
        username: true,
        kodeUnit: true,
      },
    }),
  ]);

  // A1. Total Resmi Buku — HANYA dari KinerjaPetugas (TIDAK dipotong KLAIM_LAPANGAN)
  let totalSaldoAkhirPeriodeBig = BigInt(0);
  let totalSaldoAkhirBulanBig = BigInt(0);
  let totalRpPelunasanPlnMobileBig = BigInt(0);
  let totalKaliTransaksiPlnMobile = 0;
  let totalMigrasiPrabayar = 0;
  let totalPromoTematik = 0;
  let totalPelunasanSaldoPrrBig = BigInt(0);

  const kinerjaByPetugasId = new Map<number, (typeof kinerjaRows)[number]>();

  for (const row of kinerjaRows) {
    totalSaldoAkhirPeriodeBig += row.saldoAkhirPeriode;
    totalSaldoAkhirBulanBig += row.saldoAkhirBulan;
    totalRpPelunasanPlnMobileBig += row.rpPelunasanPlnMobile;
    totalKaliTransaksiPlnMobile += row.kaliTransaksiPlnMobile;
    totalMigrasiPrabayar += row.perolehanMigrasiPrabayar;
    totalPromoTematik += row.perolehanPromoTematik;
    totalPelunasanSaldoPrrBig += row.pelunasanSaldoPrr;

    kinerjaByPetugasId.set(row.idPetugas, row);
  }

  const officialSummary: OfficialBookSummary = {
    totalSaldoAkhirPeriode: bigIntToNumber(totalSaldoAkhirPeriodeBig),
    totalSaldoAkhirBulan: bigIntToNumber(totalSaldoAkhirBulanBig),
    totalRpPelunasanPlnMobile: bigIntToNumber(totalRpPelunasanPlnMobileBig),
    totalKaliTransaksiPlnMobile,
    totalMigrasiPrabayar,
    totalPromoTematik,
    totalPelunasanSaldoPrr: bigIntToNumber(totalPelunasanSaldoPrrBig),
    petugasTercatatCount: kinerjaRows.length,
  };

  // A2. Metrik Operasional Lapangan — Terpisah dari Saldo Buku
  const statusAccumulator = new Map<
    StatusRekonsiliasi,
    { count: number; nominal: bigint }
  >();

  for (const { status } of STATUS_LABEL_ORDERED) {
    statusAccumulator.set(status, { count: 0, nominal: BigInt(0) });
  }

  interface PetugasFieldStats {
    belumTertagih: number;
    masaJanjiBayar: number;
    overdue: number;
    ditindaklanjuti: number;
    klaimLapangan: number;
    lunasResmi: number;
    klaimLapanganNominal: bigint;
    totalTugas: number;
    totalNominal: bigint;
  }

  const fieldStatsByPetugasId = new Map<number, PetugasFieldStats>();

  const getOrInitFieldStats = (petugasId: number): PetugasFieldStats => {
    let stats = fieldStatsByPetugasId.get(petugasId);
    if (!stats) {
      stats = {
        belumTertagih: 0,
        masaJanjiBayar: 0,
        overdue: 0,
        ditindaklanjuti: 0,
        klaimLapangan: 0,
        lunasResmi: 0,
        klaimLapanganNominal: BigInt(0),
        totalTugas: 0,
        totalNominal: BigInt(0),
      };
      fieldStatsByPetugasId.set(petugasId, stats);
    }
    return stats;
  };

  let totalPiutangNominalBig = BigInt(0);

  for (const item of piutangRows) {
    totalPiutangNominalBig += item.nilaiTagihan;

    const statusBucket = statusAccumulator.get(item.statusRekonsiliasi);
    if (statusBucket) {
      statusBucket.count += 1;
      statusBucket.nominal += item.nilaiTagihan;
    }

    if (item.idPetugas !== null) {
      const pStats = getOrInitFieldStats(item.idPetugas);
      pStats.totalTugas += 1;
      pStats.totalNominal += item.nilaiTagihan;

      switch (item.statusRekonsiliasi) {
        case "BELUM_TERTAGIH":
          pStats.belumTertagih += 1;
          break;
        case "MASA_JANJI_BAYAR":
          pStats.masaJanjiBayar += 1;
          break;
        case "OVERDUE":
          pStats.overdue += 1;
          break;
        case "DITINDAKLANJUTI":
          pStats.ditindaklanjuti += 1;
          break;
        case "KLAIM_LAPANGAN":
          pStats.klaimLapangan += 1;
          pStats.klaimLapanganNominal += item.nilaiTagihan;
          break;
        case "LUNAS_RESMI":
          pStats.lunasResmi += 1;
          break;
        default:
          break;
      }
    }
  }

  const getStatusBucket = (status: StatusRekonsiliasi) =>
    statusAccumulator.get(status) ?? { count: 0, nominal: BigInt(0) };

  const klaimBucket = getStatusBucket("KLAIM_LAPANGAN");
  const lunasBucket = getStatusBucket("LUNAS_RESMI");
  const overdueBucket = getStatusBucket("OVERDUE");
  const janjiBayarBucket = getStatusBucket("MASA_JANJI_BAYAR");
  const unassignedBucket = getStatusBucket("UNASSIGNED");
  const belumTertagihBucket = getStatusBucket("BELUM_TERTAGIH");
  const ditindaklanjutiBucket = getStatusBucket("DITINDAKLANJUTI");

  const fieldSummary: FieldOperationalSummary = {
    klaimLapanganCount: klaimBucket.count,
    klaimLapanganNominal: bigIntToNumber(klaimBucket.nominal),
    lunasResmiCount: lunasBucket.count,
    lunasResmiNominal: bigIntToNumber(lunasBucket.nominal),
    overdueCount: overdueBucket.count,
    overdueNominal: bigIntToNumber(overdueBucket.nominal),
    masaJanjiBayarCount: janjiBayarBucket.count,
    masaJanjiBayarNominal: bigIntToNumber(janjiBayarBucket.nominal),
    unassignedCount: unassignedBucket.count,
    unassignedNominal: bigIntToNumber(unassignedBucket.nominal),
    belumTertagihCount: belumTertagihBucket.count,
    belumTertagihNominal: bigIntToNumber(belumTertagihBucket.nominal),
    ditindaklanjutiCount: ditindaklanjutiBucket.count,
    ditindaklanjutiNominal: bigIntToNumber(ditindaklanjutiBucket.nominal),
    totalPiutangCount: piutangRows.length,
    totalPiutangNominal: bigIntToNumber(totalPiutangNominalBig),
  };

  // B & C. Perbandingan 7 Indikator Kinerja & Dataset Grafik Recharts per Petugas Aktif
  const petugasComparison: PetugasKinerjaComparisonRow[] = [];
  const workloadPerPetugas: WorkloadPerPetugasItem[] = [];
  const kinerjaComparisonChart: KinerjaComparisonChartItem[] = [];

  for (const ptg of activePetugasList) {
    const k = kinerjaByPetugasId.get(ptg.id);
    const f = fieldStatsByPetugasId.get(ptg.id);

    const saldoAkhirPeriode = bigIntToNumber(k?.saldoAkhirPeriode);
    const saldoAkhirBulan = bigIntToNumber(k?.saldoAkhirBulan);
    const rpPelunasanPlnMobile = bigIntToNumber(k?.rpPelunasanPlnMobile);
    const kaliTransaksiPlnMobile = k?.kaliTransaksiPlnMobile ?? 0;
    const perolehanMigrasiPrabayar = k?.perolehanMigrasiPrabayar ?? 0;
    const perolehanPromoTematik = k?.perolehanPromoTematik ?? 0;
    const pelunasanSaldoPrr = bigIntToNumber(k?.pelunasanSaldoPrr);

    petugasComparison.push({
      petugasId: ptg.id,
      nama: ptg.nama,
      username: ptg.username,
      kodeUnit: ptg.kodeUnit,
      hasKinerjaRecord: Boolean(k),
      saldoAkhirPeriode,
      saldoAkhirBulan,
      rpPelunasanPlnMobile,
      kaliTransaksiPlnMobile,
      perolehanMigrasiPrabayar,
      perolehanPromoTematik,
      pelunasanSaldoPrr,
      totalTugas: f?.totalTugas ?? 0,
      klaimLapanganCount: f?.klaimLapangan ?? 0,
      klaimLapanganNominal: bigIntToNumber(f?.klaimLapanganNominal),
      overdueCount: f?.overdue ?? 0,
      lunasResmiCount: f?.lunasResmi ?? 0,
    });

    workloadPerPetugas.push({
      namaPetugas: ptg.nama,
      username: ptg.username,
      belumTertagih: f?.belumTertagih ?? 0,
      masaJanjiBayar: f?.masaJanjiBayar ?? 0,
      overdue: f?.overdue ?? 0,
      ditindaklanjuti: f?.ditindaklanjuti ?? 0,
      klaimLapangan: f?.klaimLapangan ?? 0,
      lunasResmi: f?.lunasResmi ?? 0,
      totalTugas: f?.totalTugas ?? 0,
      totalNominalRp: bigIntToNumber(f?.totalNominal),
    });

    kinerjaComparisonChart.push({
      namaPetugas: ptg.nama,
      username: ptg.username,
      saldoAkhirPeriode,
      saldoAkhirBulan,
      rpPelunasanPlnMobile,
      pelunasanSaldoPrr,
    });
  }

  const statusDistribution: StatusDistributionItem[] = STATUS_LABEL_ORDERED.map(
    ({ status, label }) => {
      const bucket = getStatusBucket(status);
      return {
        status,
        label,
        count: bucket.count,
        nominalRp: bigIntToNumber(bucket.nominal),
      };
    }
  );

  return {
    activePeriode,
    availablePeriods,
    officialSummary,
    fieldSummary,
    petugasComparison,
    workloadPerPetugas,
    statusDistribution,
    kinerjaComparisonChart,
  };
}

/**
 * Mengambil detail lengkap satu rekaman Piutang (pelanggan, petugas,
 * riwayat multi-kunjungan penagihan, koordinat/alasan GPS, pengingat,
 * dan daftar foto evidence privat) dalam format 100% JSON-serializable.
 */
export async function getPiutangDetailById(
  piutangId: number
): Promise<PiutangMonitoringDetail | null> {
  const piutang = await prisma.piutang.findUnique({
    where: { id: piutangId },
    include: {
      pelanggan: {
        select: {
          idPelanggan: true,
          namaPelanggan: true,
          alamat: true,
          tarif: true,
          daya: true,
          kodeUnit: true,
        },
      },
      petugas: {
        select: {
          id: true,
          nama: true,
          username: true,
          kodeUnit: true,
        },
      },
      riwayatPenagihan: {
        orderBy: { waktuInput: "desc" },
        include: {
          petugas: {
            select: {
              id: true,
              nama: true,
              username: true,
            },
          },
          daftarEvidence: {
            orderBy: { uploadedAt: "asc" },
            select: {
              id: true,
              jenisEvidence: true,
              fileSizeKb: true,
              uploadedAt: true,
            },
          },
          pengingat: {
            select: {
              id: true,
              tanggalMulaiRentang: true,
              tanggalJatuhTempo: true,
              statusPengingat: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  });

  if (!piutang) {
    return null;
  }

  return {
    id: piutang.id,
    idPelanggan: piutang.idPelanggan,
    periode: piutang.periode,
    jumlahLembar: piutang.jumlahLembar,
    nilaiTagihan: piutang.nilaiTagihan.toString(),
    statusRekonsiliasi: piutang.statusRekonsiliasi,
    createdAt: piutang.createdAt.toISOString(),
    updatedAt: piutang.updatedAt.toISOString(),
    pelanggan: piutang.pelanggan,
    petugas: piutang.petugas,
    riwayatPenagihan: piutang.riwayatPenagihan.map((visit) => ({
      id: visit.id,
      idPetugas: visit.idPetugas,
      petugas: visit.petugas,
      kategoriPelanggan: visit.kategoriPelanggan,
      catatanKendala: visit.catatanKendala,
      bentukPenyelesaian: visit.bentukPenyelesaian,
      rentangJanjiBayar: visit.rentangJanjiBayar,
      latitude: decimalToString(visit.latitude),
      longitude: decimalToString(visit.longitude),
      alasanKendalaGps: visit.alasanKendalaGps,
      waktuInput: visit.waktuInput.toISOString(),
      updatedAt: visit.updatedAt.toISOString(),
      daftarEvidence: visit.daftarEvidence.map((ev) => ({
        id: ev.id,
        jenisEvidence: ev.jenisEvidence,
        fileSizeKb: ev.fileSizeKb,
        uploadedAt: ev.uploadedAt.toISOString(),
      })),
      pengingat: visit.pengingat
        ? {
            id: visit.pengingat.id,
            tanggalMulaiRentang: visit.pengingat.tanggalMulaiRentang.toISOString(),
            tanggalJatuhTempo: visit.pengingat.tanggalJatuhTempo.toISOString(),
            statusPengingat: visit.pengingat.statusPengingat,
            updatedAt: visit.pengingat.updatedAt.toISOString(),
          }
        : null,
    })),
  };
}
