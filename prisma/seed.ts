import bcrypt from "bcryptjs";
import {
  BentukPenyelesaian,
  KategoriPelanggan,
  PeranPengguna,
  Prisma,
  PrismaClient,
  RentangJanjiBayar,
  StatusPengingat,
  StatusRekonsiliasi,
} from "@prisma/client";

const prisma = new PrismaClient();

const PERIODE = "2026-09";

async function main() {
  const passwordHash = await bcrypt.hash("PlnKraksaan2026!", 10);

  // 1. Seed 4 Akun Pengguna
  const admin = await prisma.pengguna.upsert({
    where: { username: "admin_kraksaan" },
    update: {
      nama: "Admin ULP Kraksaan",
      passwordHash,
      peran: PeranPengguna.ADMIN,
      kodeUnit: "51304",
      isActive: true,
    },
    create: {
      username: "admin_kraksaan",
      nama: "Admin ULP Kraksaan",
      passwordHash,
      peran: PeranPengguna.ADMIN,
      kodeUnit: "51304",
      isActive: true,
    },
  });

  await prisma.pengguna.upsert({
    where: { username: "manajer_ulp" },
    update: {
      nama: "Manajer ULP Kraksaan",
      passwordHash,
      peran: PeranPengguna.PIMPINAN,
      kodeUnit: "51304",
      isActive: true,
    },
    create: {
      username: "manajer_ulp",
      nama: "Manajer ULP Kraksaan",
      passwordHash,
      peran: PeranPengguna.PIMPINAN,
      kodeUnit: "51304",
      isActive: true,
    },
  });

  const ptg01 = await prisma.pengguna.upsert({
    where: { username: "ptg_01" },
    update: {
      nama: "Budi Santoso",
      passwordHash,
      peran: PeranPengguna.PETUGAS,
      kodeUnit: "51304",
      isActive: true,
    },
    create: {
      username: "ptg_01",
      nama: "Budi Santoso",
      passwordHash,
      peran: PeranPengguna.PETUGAS,
      kodeUnit: "51304",
      isActive: true,
    },
  });

  const ptg02 = await prisma.pengguna.upsert({
    where: { username: "ptg_02" },
    update: {
      nama: "Agus Pratama",
      passwordHash,
      peran: PeranPengguna.PETUGAS,
      kodeUnit: "51304",
      isActive: true,
    },
    create: {
      username: "ptg_02",
      nama: "Agus Pratama",
      passwordHash,
      peran: PeranPengguna.PETUGAS,
      kodeUnit: "51304",
      isActive: true,
    },
  });

  // 2. Seed 6 Data Pelanggan & Piutang Sampel (Periode 2026-09)
  const pelangganData: Array<{
    idPelanggan: string;
    namaPelanggan: string;
    alamat: string;
    tarif: string;
    daya: number;
    kodeUnit: string | null;
    idPetugas: number | null;
    jumlahLembar: number;
    nilaiTagihan: bigint;
    statusRekonsiliasi: StatusRekonsiliasi;
  }> = [
    {
      idPelanggan: "513040100001",
      namaPelanggan: "Slamet Riyadi",
      alamat:
        "Jl. Panglima Sudirman No. 45, Kel. Patokan, Kec. Kraksaan, Kab. Probolinggo",
      tarif: "R1M",
      daya: 900,
      kodeUnit: "51304",
      idPetugas: ptg01.id,
      jumlahLembar: 2,
      nilaiTagihan: BigInt(485200),
      statusRekonsiliasi: StatusRekonsiliasi.BELUM_TERTAGIH,
    },
    {
      idPelanggan: "513040100002",
      namaPelanggan: "Siti Aminah",
      alamat:
        "Dusun Krajan RT 02/RW 01, Desa Sukokerto, Kec. Pajarakan, Kab. Probolinggo",
      tarif: "R1",
      daya: 1300,
      kodeUnit: "51304",
      idPetugas: ptg01.id,
      jumlahLembar: 2,
      nilaiTagihan: BigInt(742500),
      statusRekonsiliasi: StatusRekonsiliasi.MASA_JANJI_BAYAR,
    },
    {
      idPelanggan: "513040100003",
      namaPelanggan: "Toko Sumber Makmur",
      alamat:
        "Jl. Raya Pantura No. 112, Desa Gending, Kec. Gending, Kab. Probolinggo",
      tarif: "B1",
      daya: 2200,
      kodeUnit: "51304",
      idPetugas: ptg01.id,
      jumlahLembar: 3,
      nilaiTagihan: BigInt(1680900),
      statusRekonsiliasi: StatusRekonsiliasi.KLAIM_LAPANGAN,
    },
    {
      idPelanggan: "513040100004",
      namaPelanggan: "Ahmad Fauzi",
      alamat:
        "Dusun Tengah RT 04/RW 02, Desa Besuk Agung, Kec. Besuk, Kab. Probolinggo",
      tarif: "R1M",
      daya: 900,
      kodeUnit: "51304",
      idPetugas: ptg02.id,
      jumlahLembar: 3,
      nilaiTagihan: BigInt(695400),
      statusRekonsiliasi: StatusRekonsiliasi.BELUM_TERTAGIH,
    },
    {
      idPelanggan: "513040100005",
      namaPelanggan: "Hendra Wijaya",
      alamat:
        "Jl. Raya Paiton Km. 5, Desa Sukodadi, Kec. Paiton, Kab. Probolinggo",
      tarif: "R1",
      daya: 1300,
      kodeUnit: "51304",
      idPetugas: ptg02.id,
      jumlahLembar: 2,
      nilaiTagihan: BigInt(815000),
      statusRekonsiliasi: StatusRekonsiliasi.OVERDUE,
    },
    {
      idPelanggan: "513040100006",
      namaPelanggan: "Mulyono",
      alamat:
        "Dusun Timur RT 01/RW 03, Desa Kebonagung, Kec. Kraksaan, Kab. Probolinggo",
      tarif: "R1",
      daya: 450,
      kodeUnit: null,
      idPetugas: null,
      jumlahLembar: 2,
      nilaiTagihan: BigInt(215600),
      statusRekonsiliasi: StatusRekonsiliasi.UNASSIGNED,
    },
  ];

  const piutangMap = new Map<string, { id: number }>();

  for (const item of pelangganData) {
    await prisma.pelanggan.upsert({
      where: { idPelanggan: item.idPelanggan },
      update: {
        namaPelanggan: item.namaPelanggan,
        alamat: item.alamat,
        tarif: item.tarif,
        daya: item.daya,
        kodeUnit: item.kodeUnit,
      },
      create: {
        idPelanggan: item.idPelanggan,
        namaPelanggan: item.namaPelanggan,
        alamat: item.alamat,
        tarif: item.tarif,
        daya: item.daya,
        kodeUnit: item.kodeUnit,
      },
    });

    const piutang = await prisma.piutang.upsert({
      where: {
        unik_pelanggan_periode: {
          idPelanggan: item.idPelanggan,
          periode: PERIODE,
        },
      },
      update: {
        idPetugas: item.idPetugas,
        jumlahLembar: item.jumlahLembar,
        nilaiTagihan: item.nilaiTagihan,
        statusRekonsiliasi: item.statusRekonsiliasi,
      },
      create: {
        idPelanggan: item.idPelanggan,
        idPetugas: item.idPetugas,
        periode: PERIODE,
        jumlahLembar: item.jumlahLembar,
        nilaiTagihan: item.nilaiTagihan,
        statusRekonsiliasi: item.statusRekonsiliasi,
      },
    });

    piutangMap.set(item.idPelanggan, { id: piutang.id });
  }

  // Helper idempotent untuk Penagihan (cek berdasarkan idPiutang)
  async function upsertSeedPenagihan(data: {
    idPiutang: number;
    idPetugas: number;
    kategoriPelanggan: KategoriPelanggan;
    catatanKendala: string | null;
    bentukPenyelesaian: BentukPenyelesaian;
    rentangJanjiBayar: RentangJanjiBayar | null;
    latitude: Prisma.Decimal;
    longitude: Prisma.Decimal;
  }) {
    const existing = await prisma.penagihan.findFirst({
      where: {
        idPiutang: data.idPiutang,
        idPetugas: data.idPetugas,
        bentukPenyelesaian: data.bentukPenyelesaian,
      },
    });

    if (existing) {
      return prisma.penagihan.update({
        where: { id: existing.id },
        data: {
          kategoriPelanggan: data.kategoriPelanggan,
          catatanKendala: data.catatanKendala,
          rentangJanjiBayar: data.rentangJanjiBayar,
          latitude: data.latitude,
          longitude: data.longitude,
        },
      });
    }

    return prisma.penagihan.create({ data });
  }

  // Penagihan + Pengingat untuk 513040100002 (MASA_JANJI_BAYAR)
  const piutang02 = piutangMap.get("513040100002")!;
  const penagihan02 = await upsertSeedPenagihan({
    idPiutang: piutang02.id,
    idPetugas: ptg01.id,
    kategoriPelanggan: KategoriPelanggan.KENDALI_PETUGAS,
    catatanKendala: null,
    bentukPenyelesaian: BentukPenyelesaian.JANJI_BAYAR,
    rentangJanjiBayar: RentangJanjiBayar.TGL_11_15,
    latitude: new Prisma.Decimal("-7.7568400"),
    longitude: new Prisma.Decimal("113.4158200"),
  });

  await prisma.pengingat.upsert({
    where: { idPenagihan: penagihan02.id },
    update: {
      tanggalMulaiRentang: new Date("2026-09-11"),
      tanggalJatuhTempo: new Date("2026-09-15"),
      statusPengingat: StatusPengingat.AKTIF,
    },
    create: {
      idPenagihan: penagihan02.id,
      tanggalMulaiRentang: new Date("2026-09-11"),
      tanggalJatuhTempo: new Date("2026-09-15"),
      statusPengingat: StatusPengingat.AKTIF,
    },
  });

  // Penagihan untuk 513040100003 (KLAIM_LAPANGAN)
  const piutang03 = piutangMap.get("513040100003")!;
  await upsertSeedPenagihan({
    idPiutang: piutang03.id,
    idPetugas: ptg01.id,
    kategoriPelanggan: KategoriPelanggan.KENDALI_PETUGAS,
    catatanKendala: null,
    bentukPenyelesaian: BentukPenyelesaian.LUNAS_ONLINE,
    rentangJanjiBayar: null,
    latitude: new Prisma.Decimal("-7.7592100"),
    longitude: new Prisma.Decimal("113.4184500"),
  });

  // Penagihan + Pengingat untuk 513040100005 (OVERDUE)
  const piutang05 = piutangMap.get("513040100005")!;
  const penagihan05 = await upsertSeedPenagihan({
    idPiutang: piutang05.id,
    idPetugas: ptg02.id,
    kategoriPelanggan: KategoriPelanggan.DI_LUAR_KENDALI_PETUGAS,
    catatanKendala:
      "Pelanggan sedang ke luar kota, janji transfer lewat keluarga",
    bentukPenyelesaian: BentukPenyelesaian.JANJI_BAYAR,
    rentangJanjiBayar: RentangJanjiBayar.TGL_1_5,
    latitude: new Prisma.Decimal("-7.7623500"),
    longitude: new Prisma.Decimal("113.4091200"),
  });

  await prisma.pengingat.upsert({
    where: { idPenagihan: penagihan05.id },
    update: {
      tanggalMulaiRentang: new Date("2026-09-01"),
      tanggalJatuhTempo: new Date("2026-09-05"),
      statusPengingat: StatusPengingat.OVERDUE,
    },
    create: {
      idPenagihan: penagihan05.id,
      tanggalMulaiRentang: new Date("2026-09-01"),
      tanggalJatuhTempo: new Date("2026-09-05"),
      statusPengingat: StatusPengingat.OVERDUE,
    },
  });

  // 3. Seed Rekap 7 Indikator Kinerja Awal (KinerjaPetugas) Periode 2026-09
  await prisma.kinerjaPetugas.upsert({
    where: {
      unik_kinerja_petugas_periode: {
        idPetugas: ptg01.id,
        periode: PERIODE,
      },
    },
    update: {
      saldoAkhirPeriode: BigInt(48520000),
      saldoAkhirBulan: BigInt(21350000),
      rpPelunasanPlnMobile: BigInt(18450000),
      kaliTransaksiPlnMobile: 42,
      perolehanMigrasiPrabayar: 7,
      perolehanPromoTematik: 5,
      pelunasanSaldoPrr: BigInt(3250000),
    },
    create: {
      idPetugas: ptg01.id,
      periode: PERIODE,
      saldoAkhirPeriode: BigInt(48520000),
      saldoAkhirBulan: BigInt(21350000),
      rpPelunasanPlnMobile: BigInt(18450000),
      kaliTransaksiPlnMobile: 42,
      perolehanMigrasiPrabayar: 7,
      perolehanPromoTematik: 5,
      pelunasanSaldoPrr: BigInt(3250000),
    },
  });

  await prisma.kinerjaPetugas.upsert({
    where: {
      unik_kinerja_petugas_periode: {
        idPetugas: ptg02.id,
        periode: PERIODE,
      },
    },
    update: {
      saldoAkhirPeriode: BigInt(43200701),
      saldoAkhirBulan: BigInt(19840500),
      rpPelunasanPlnMobile: BigInt(15920000),
      kaliTransaksiPlnMobile: 36,
      perolehanMigrasiPrabayar: 5,
      perolehanPromoTematik: 4,
      pelunasanSaldoPrr: BigInt(2800000),
    },
    create: {
      idPetugas: ptg02.id,
      periode: PERIODE,
      saldoAkhirPeriode: BigInt(43200701),
      saldoAkhirBulan: BigInt(19840500),
      rpPelunasanPlnMobile: BigInt(15920000),
      kaliTransaksiPlnMobile: 36,
      perolehanMigrasiPrabayar: 5,
      perolehanPromoTematik: 4,
      pelunasanSaldoPrr: BigInt(2800000),
    },
  });

  // 4. Seed 1 Log Audit Awal (AuditLog) secara idempotent
  const existingAudit = await prisma.auditLog.findFirst({
    where: {
      aksi: "SEED_INIT",
      entitas: "SYSTEM",
    },
  });

  if (!existingAudit) {
    await prisma.auditLog.create({
      data: {
        idPengguna: admin.id,
        entitas: "SYSTEM",
        idRekaman: "SEED_2026_09",
        aksi: "SEED_INIT",
        nilaiLama: Prisma.JsonNull,
        nilaiBaru: {
          periode: PERIODE,
          kodeUnit: "51304",
          keterangan: "Inisialisasi data awal ULP Kraksaan",
        },
      },
    });
  }

  // 5. Ringkasan jumlah record tiap tabel
  const [
    penggunaCount,
    pelangganCount,
    piutangCount,
    penagihanCount,
    pengingatCount,
    kinerjaPetugasCount,
    auditLogCount,
  ] = await Promise.all([
    prisma.pengguna.count(),
    prisma.pelanggan.count(),
    prisma.piutang.count(),
    prisma.penagihan.count(),
    prisma.pengingat.count(),
    prisma.kinerjaPetugas.count(),
    prisma.auditLog.count(),
  ]);

  console.log("=== Ringkasan Seed Database ULP Kraksaan ===");
  console.log(`pengguna        : ${penggunaCount}`);
  console.log(`pelanggan       : ${pelangganCount}`);
  console.log(`piutang         : ${piutangCount}`);
  console.log(`penagihan       : ${penagihanCount}`);
  console.log(`pengingat       : ${pengingatCount}`);
  console.log(`kinerja_petugas : ${kinerjaPetugasCount}`);
  console.log(`audit_log       : ${auditLogCount}`);
}

main()
  .catch((error: unknown) => {
    console.error("Error saat menjalankan database seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
