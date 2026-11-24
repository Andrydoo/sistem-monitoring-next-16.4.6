-- CreateTable
CREATE TABLE `pengguna` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `nama` VARCHAR(150) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `peran` ENUM('ADMIN', 'PIMPINAN', 'PETUGAS') NOT NULL DEFAULT 'PETUGAS',
    `kode_unit` VARCHAR(10) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pengguna_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pelanggan` (
    `id_pelanggan` VARCHAR(20) NOT NULL,
    `nama_pelanggan` VARCHAR(150) NOT NULL,
    `alamat` TEXT NOT NULL,
    `tarif` VARCHAR(10) NOT NULL,
    `daya` INTEGER NOT NULL,
    `kode_unit` VARCHAR(10) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `pelanggan_nama_pelanggan_idx`(`nama_pelanggan`),
    PRIMARY KEY (`id_pelanggan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `piutang` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_pelanggan` VARCHAR(20) NOT NULL,
    `id_petugas` INTEGER NULL,
    `periode` VARCHAR(7) NOT NULL,
    `jumlah_lembar` INTEGER NOT NULL,
    `nilai_tagihan` BIGINT NOT NULL,
    `status_rekonsiliasi` ENUM('UNASSIGNED', 'BELUM_TERTAGIH', 'MASA_JANJI_BAYAR', 'OVERDUE', 'DITINDAKLANJUTI', 'KLAIM_LAPANGAN', 'LUNAS_RESMI') NOT NULL DEFAULT 'BELUM_TERTAGIH',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `piutang_periode_id_petugas_status_rekonsiliasi_idx`(`periode`, `id_petugas`, `status_rekonsiliasi`),
    UNIQUE INDEX `piutang_id_pelanggan_periode_key`(`id_pelanggan`, `periode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `penagihan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_piutang` INTEGER NOT NULL,
    `id_petugas` INTEGER NOT NULL,
    `kategori_pelanggan` ENUM('KENDALI_PETUGAS', 'DI_LUAR_KENDALI_PETUGAS') NOT NULL,
    `catatan_kendala` TEXT NULL,
    `bentuk_penyelesaian` ENUM('LUNAS_ONLINE', 'TITIP_LUNAS', 'DIPUTUS', 'JANJI_BAYAR') NOT NULL,
    `rentang_janji_bayar` ENUM('TGL_1_5', 'TGL_6_10', 'TGL_11_15', 'TGL_16_20', 'DI_ATAS_20') NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `alasan_kendala_gps` TEXT NULL,
    `waktu_input` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `penagihan_id_piutang_waktu_input_idx`(`id_piutang`, `waktu_input`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evidence` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_penagihan` INTEGER NOT NULL,
    `jenis_evidence` ENUM('PENYAMPAIAN', 'PEMUTUSAN') NOT NULL,
    `file_path` VARCHAR(255) NOT NULL,
    `file_size_kb` INTEGER NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kinerja_petugas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_petugas` INTEGER NOT NULL,
    `periode` VARCHAR(7) NOT NULL,
    `saldo_akhir_periode` BIGINT NOT NULL DEFAULT 0,
    `saldo_akhir_bulan` BIGINT NOT NULL DEFAULT 0,
    `rp_pelunasan_pln_mobile` BIGINT NOT NULL DEFAULT 0,
    `kali_transaksi_pln_mobile` INTEGER NOT NULL DEFAULT 0,
    `perolehan_migrasi_prabayar` INTEGER NOT NULL DEFAULT 0,
    `perolehan_promo_tematik` INTEGER NOT NULL DEFAULT 0,
    `pelunasan_saldo_prr` BIGINT NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `kinerja_petugas_periode_idx`(`periode`),
    UNIQUE INDEX `kinerja_petugas_id_petugas_periode_key`(`id_petugas`, `periode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pengingat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_penagihan` INTEGER NOT NULL,
    `tanggal_mulai_rentang` DATE NOT NULL,
    `tanggal_jatuh_tempo` DATE NOT NULL,
    `status_pengingat` ENUM('AKTIF', 'OVERDUE', 'SELESAI') NOT NULL DEFAULT 'AKTIF',
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pengingat_id_penagihan_key`(`id_penagihan`),
    INDEX `pengingat_status_pengingat_tanggal_jatuh_tempo_idx`(`status_pengingat`, `tanggal_jatuh_tempo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `id_pengguna` INTEGER NOT NULL,
    `entitas` VARCHAR(50) NOT NULL,
    `id_rekaman` VARCHAR(50) NOT NULL,
    `aksi` VARCHAR(30) NOT NULL,
    `nilai_lama` JSON NULL,
    `nilai_baru` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_log_entitas_id_rekaman_idx`(`entitas`, `id_rekaman`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `piutang` ADD CONSTRAINT `piutang_id_pelanggan_fkey` FOREIGN KEY (`id_pelanggan`) REFERENCES `pelanggan`(`id_pelanggan`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `piutang` ADD CONSTRAINT `piutang_id_petugas_fkey` FOREIGN KEY (`id_petugas`) REFERENCES `pengguna`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penagihan` ADD CONSTRAINT `penagihan_id_piutang_fkey` FOREIGN KEY (`id_piutang`) REFERENCES `piutang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penagihan` ADD CONSTRAINT `penagihan_id_petugas_fkey` FOREIGN KEY (`id_petugas`) REFERENCES `pengguna`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evidence` ADD CONSTRAINT `evidence_id_penagihan_fkey` FOREIGN KEY (`id_penagihan`) REFERENCES `penagihan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kinerja_petugas` ADD CONSTRAINT `kinerja_petugas_id_petugas_fkey` FOREIGN KEY (`id_petugas`) REFERENCES `pengguna`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pengingat` ADD CONSTRAINT `pengingat_id_penagihan_fkey` FOREIGN KEY (`id_penagihan`) REFERENCES `penagihan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_id_pengguna_fkey` FOREIGN KEY (`id_pengguna`) REFERENCES `pengguna`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
