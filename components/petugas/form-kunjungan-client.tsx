"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import type {
  BentukPenyelesaian,
  JenisEvidence,
  KategoriPelanggan,
  RentangJanjiBayar,
  StatusPengingat,
  StatusRekonsiliasi,
} from "@prisma/client";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Camera,
  CheckCircle2,
  Clock,
  Edit3,
  History,
  Image as ImageIcon,
  Info,
  Loader2,
  Lock,
  MapPin,
  Navigation,
  RefreshCw,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { formatDaya, formatRupiah, formatTanggalWib } from "@/lib/format";
import {
  formatTanggalDateOnlyId,
  hitungRentangTanggalJanjiBayar,
  RENTANG_JANJI_BAYAR_LABEL_MAP,
  RENTANG_JANJI_BAYAR_OPTIONS,
} from "@/lib/janji-bayar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_EVIDENCE_BYTES = 300 * 1024;
const COMPRESS_RETRIGGER_THRESHOLD_BYTES = 295 * 1024;
const GPS_TIMEOUT_MS = 10_000;

export interface EvidenceItem {
  id: number;
  jenisEvidence: JenisEvidence;
  fileSizeKb: number | null;
  uploadedAt: string;
}

export interface PengingatItem {
  id: number;
  tanggalMulaiRentang: string;
  tanggalJatuhTempo: string;
  statusPengingat: StatusPengingat;
}

export interface RiwayatPenagihanItem {
  id: number;
  kategoriPelanggan: KategoriPelanggan;
  catatanKendala: string | null;
  bentukPenyelesaian: BentukPenyelesaian;
  rentangJanjiBayar: RentangJanjiBayar | null;
  latitude: string | null;
  longitude: string | null;
  alasanKendalaGps: string | null;
  waktuInput: string;
  updatedAt: string;
  daftarEvidence: EvidenceItem[];
  pengingat: PengingatItem | null;
}

export interface PiutangDetailData {
  id: number;
  idPelanggan: string;
  periode: string;
  jumlahLembar: number;
  nilaiTagihan: string;
  statusRekonsiliasi: StatusRekonsiliasi;
  pelanggan: {
    idPelanggan: string;
    namaPelanggan: string;
    alamat: string;
    tarif: string;
    daya: number;
    kodeUnit: string | null;
  };
  riwayatPenagihan: RiwayatPenagihanItem[];
}

interface PendingPhotoItem {
  localId: string;
  file: File;
  previewUrl: string;
  jenisEvidence: JenisEvidence;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}

type GpsStatus = "acquiring" | "locked" | "failed";

const PENYELESAIAN_CHOICES: ReadonlyArray<{
  value: BentukPenyelesaian;
  label: string;
  helper: string;
}> = [
  {
    value: "LUNAS_ONLINE",
    label: "Lunas Online",
    helper: "Bayar via PLN Mobile / Bank",
  },
  {
    value: "TITIP_LUNAS",
    label: "Titip Lunas",
    helper: "Titip pelunasan ke petugas",
  },
  {
    value: "DIPUTUS",
    label: "Diputus",
    helper: "Wajib foto pemutusan",
  },
  {
    value: "JANJI_BAYAR",
    label: "Janji Bayar",
    helper: "Komitmen rentang tanggal",
  },
];

function formatKb(bytes: number): string {
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${kb.toLocaleString("id-ID")} KB`;
}

function formatRemainingEditWindow(remainingMs: number): string {
  if (remainingMs <= 0) return "Habis";
  const totalMinutes = Math.floor(remainingMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours} jam ${minutes} menit`;
  }
  return `${Math.max(1, minutes)} menit`;
}

function normalizeCompressedFileName(
  originalName: string,
  mimeType: string
): string {
  const baseName = originalName.replace(/\.[^/.]+$/, "") || "evidence";
  const safeBase = baseName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  const ext =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : "jpg";
  return `${safeBase}.${ext}`;
}

function acquireCurrentPosition(
  isCurrent: () => boolean,
  onSuccess: (coords: {
    lat: string;
    lng: string;
    accuracy: number | null;
  }) => void,
  onError: (reason: string) => void
): () => void {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    const timer = window.setTimeout(() => {
      if (!isCurrent()) return;
      onError(
        "Perangkat atau browser tidak mendukung layanan Geolocation."
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }

  let settled = false;
  const guardTimer = window.setTimeout(() => {
    if (settled || !isCurrent()) return;
    settled = true;
    onError(
      "Penguncian GPS melewati batas waktu 10 detik. Silakan coba ulang atau isi alasan kendala GPS."
    );
  }, GPS_TIMEOUT_MS + 400);

  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (settled || !isCurrent()) return;
      settled = true;
      window.clearTimeout(guardTimer);
      onSuccess({
        lat: position.coords.latitude.toFixed(7),
        lng: position.coords.longitude.toFixed(7),
        accuracy: Number.isFinite(position.coords.accuracy)
          ? Math.round(position.coords.accuracy)
          : null,
      });
    },
    (error) => {
      if (settled || !isCurrent()) return;
      settled = true;
      window.clearTimeout(guardTimer);

      let reason = "Gagal mengunci koordinat lokasi GPS.";
      if (error.code === error.PERMISSION_DENIED) {
        reason =
          "Izin akses lokasi ditolak oleh browser/perangkat. Aktifkan izin lokasi atau isi alasan kendala GPS.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        reason =
          "Sinyal GPS tidak tersedia di lokasi ini. Isi alasan kendala GPS untuk melanjutkan.";
      } else if (error.code === error.TIMEOUT) {
        reason =
          "Waktu penguncian GPS habis (timeout 10 detik). Coba ulang di area terbuka atau isi alasan kendala GPS.";
      }
      onError(reason);
    },
    {
      enableHighAccuracy: true,
      timeout: GPS_TIMEOUT_MS,
      maximumAge: 0,
    }
  );

  return () => {
    settled = true;
    window.clearTimeout(guardTimer);
  };
}

export function FormKunjunganClient({
  piutang,
  initialNowIso,
}: {
  piutang: PiutangDetailData;
  initialNowIso: string;
}) {
  const router = useRouter();
  const formContainerRef = React.useRef<HTMLDivElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const gpsRequestCounterRef = React.useRef(0);
  const pendingPhotosRef = React.useRef<PendingPhotoItem[]>([]);

  const [nowMs, setNowMs] = React.useState<number>(() =>
    Date.parse(initialNowIso)
  );

  // Mode Form: null = Input Baru, number = Edit Kunjungan <= 24 Jam
  const [editingPenagihanId, setEditingPenagihanId] = React.useState<
    number | null
  >(null);
  const [editingWaktuInput, setEditingWaktuInput] = React.useState<
    string | null
  >(null);

  // State GPS
  const [gpsStatus, setGpsStatus] = React.useState<GpsStatus>("acquiring");
  const [latitude, setLatitude] = React.useState<string>("");
  const [longitude, setLongitude] = React.useState<string>("");
  const [gpsAccuracy, setGpsAccuracy] = React.useState<number | null>(null);
  const [gpsErrorDetail, setGpsErrorDetail] = React.useState<string>("");
  const [alasanKendalaGps, setAlasanKendalaGps] = React.useState<string>("");

  // State Form Kunjungan
  const [kategoriPelanggan, setKategoriPelanggan] =
    React.useState<KategoriPelanggan>("KENDALI_PETUGAS");
  const [catatanKendala, setCatatanKendala] = React.useState<string>("");
  const [bentukPenyelesaian, setBentukPenyelesaian] = React.useState<
    BentukPenyelesaian | ""
  >("");
  const [rentangJanjiBayar, setRentangJanjiBayar] = React.useState<
    RentangJanjiBayar | ""
  >("");

  // State Foto & Kompresi
  const [activeJenisEvidence, setActiveJenisEvidence] =
    React.useState<JenisEvidence>("PENYAMPAIAN");
  const [pendingPhotos, setPendingPhotos] = React.useState<PendingPhotoItem[]>(
    []
  );
  const [existingEvidenceInEdit, setExistingEvidenceInEdit] = React.useState<
    EvidenceItem[]
  >([]);
  const [removedExistingIds, setRemovedExistingIds] = React.useState<number[]>(
    []
  );
  const [isCompressing, setIsCompressing] = React.useState(false);
  const [compressProgress, setCompressProgress] = React.useState(0);

  // Submit & Preview
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [previewModal, setPreviewModal] = React.useState<{
    url: string;
    title: string;
    subtitle: string;
  } | null>(null);

  const isPiutangLocked =
    piutang.statusRekonsiliasi === "LUNAS_RESMI" ||
    piutang.statusRekonsiliasi === "UNASSIGNED";

  // Perbarui penanda waktu tiap 1 menit tanpa mengganggu hidrasi awal
  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  // Sinkronkan ref pendingPhotos untuk pembersihan URL objek saat unmount
  React.useEffect(() => {
    pendingPhotosRef.current = pendingPhotos;
  }, [pendingPhotos]);

  React.useEffect(() => {
    return () => {
      for (const photo of pendingPhotosRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
  }, []);

  const requestGpsLock = React.useCallback(() => {
    const requestId = ++gpsRequestCounterRef.current;
    setGpsStatus("acquiring");
    setGpsErrorDetail("");

    acquireCurrentPosition(
      () => gpsRequestCounterRef.current === requestId,
      ({ lat, lng, accuracy }) => {
        setLatitude(lat);
        setLongitude(lng);
        setGpsAccuracy(accuracy);
        setGpsErrorDetail("");
        setGpsStatus("locked");
      },
      (reason) => {
        setGpsStatus("failed");
        setLatitude("");
        setLongitude("");
        setGpsAccuracy(null);
        setGpsErrorDetail(reason);
      }
    );
  }, []);

  // Otomatis meminta GPS saat form baru pertama kali aktif
  React.useEffect(() => {
    if (isPiutangLocked) return;
    const requestId = ++gpsRequestCounterRef.current;

    return acquireCurrentPosition(
      () => gpsRequestCounterRef.current === requestId,
      ({ lat, lng, accuracy }) => {
        setLatitude(lat);
        setLongitude(lng);
        setGpsAccuracy(accuracy);
        setGpsErrorDetail("");
        setGpsStatus("locked");
      },
      (reason) => {
        setGpsStatus("failed");
        setLatitude("");
        setLongitude("");
        setGpsAccuracy(null);
        setGpsErrorDetail(reason);
      }
    );
  }, [isPiutangLocked]);

  const clearPendingPhotos = React.useCallback(() => {
    setPendingPhotos((prev) => {
      for (const item of prev) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return [];
    });
  }, []);

  const handleSelectPenyelesaian = (choice: BentukPenyelesaian) => {
    setBentukPenyelesaian(choice);
    if (choice === "DIPUTUS") {
      setActiveJenisEvidence("PEMUTUSAN");
    }
    if (choice !== "JANJI_BAYAR") {
      setRentangJanjiBayar("");
    }
  };

  const handlePhotoSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const mime = file.type.toLowerCase();
    if (
      mime !== "image/jpeg" &&
      mime !== "image/png" &&
      mime !== "image/webp"
    ) {
      toast.error("Format foto wajib JPG, PNG, atau WebP.");
      return;
    }

    if (pendingPhotos.length >= 5) {
      toast.error("Maksimal 5 foto bukti dalam satu kali kirim laporan.");
      return;
    }

    setIsCompressing(true);
    setCompressProgress(5);
    setFormError(null);

    try {
      const targetType = mime === "image/png" ? "image/jpeg" : mime;
      let compressedBlob = await imageCompression(file, {
        maxSizeMB: 0.28,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        fileType: targetType,
        onProgress: (p) => setCompressProgress(Math.min(70, Math.round(p * 0.7))),
      });

      if (compressedBlob.size > COMPRESS_RETRIGGER_THRESHOLD_BYTES) {
        setCompressProgress(75);
        compressedBlob = await imageCompression(compressedBlob, {
          maxSizeMB: 0.25,
          maxWidthOrHeight: 1024,
          useWebWorker: true,
          initialQuality: 0.65,
          fileType: "image/jpeg",
          onProgress: (p) =>
            setCompressProgress(75 + Math.round(p * 0.2)),
        });
      }

      if (compressedBlob.size > MAX_EVIDENCE_BYTES) {
        compressedBlob = await imageCompression(compressedBlob, {
          maxSizeMB: 0.22,
          maxWidthOrHeight: 800,
          useWebWorker: true,
          initialQuality: 0.5,
          fileType: "image/jpeg",
        });
      }

      if (compressedBlob.size > MAX_EVIDENCE_BYTES) {
        toast.error(
          `Ukuran foto setelah kompresi (${formatKb(compressedBlob.size)}) masih melebihi 300 KB. Coba ambil foto ulang.`
        );
        return;
      }

      const finalMime =
        compressedBlob.type === "image/png" ||
        compressedBlob.type === "image/webp" ||
        compressedBlob.type === "image/jpeg"
          ? compressedBlob.type
          : "image/jpeg";

      const finalFile = new File(
        [compressedBlob],
        normalizeCompressedFileName(file.name, finalMime),
        { type: finalMime }
      );

      const previewUrl = URL.createObjectURL(finalFile);
      const jenisForPhoto: JenisEvidence = activeJenisEvidence;

      setPendingPhotos((prev) => [
        ...prev,
        {
          localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          file: finalFile,
          previewUrl,
          jenisEvidence: jenisForPhoto,
          originalSizeBytes: file.size,
          compressedSizeBytes: finalFile.size,
        },
      ]);

      setCompressProgress(100);
      toast.success(
        `Foto dikompresi: ${formatKb(file.size)} menjadi ${formatKb(finalFile.size)}.`
      );
    } catch (error) {
      console.error("[KompresiFoto] Gagal mengompresi foto:", error);
      toast.error(
        "Gagal mengompresi foto di browser. Pastikan berkas gambar tidak rusak."
      );
    } finally {
      setIsCompressing(false);
      setCompressProgress(0);
    }
  };

  const handleRemovePendingPhoto = (localId: string) => {
    setPendingPhotos((prev) => {
      const target = prev.find((item) => item.localId === localId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.localId !== localId);
    });
  };

  const handleChangePendingPhotoJenis = (
    localId: string,
    jenis: JenisEvidence
  ) => {
    setPendingPhotos((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, jenisEvidence: jenis } : item
      )
    );
  };

  const handleToggleRemoveExistingEvidence = (evidenceId: number) => {
    setRemovedExistingIds((prev) =>
      prev.includes(evidenceId)
        ? prev.filter((id) => id !== evidenceId)
        : [...prev, evidenceId]
    );
  };

  const handleStartEditVisit = (visit: RiwayatPenagihanItem) => {
    clearPendingPhotos();
    setFormError(null);
    setEditingPenagihanId(visit.id);
    setEditingWaktuInput(visit.waktuInput);
    setKategoriPelanggan(visit.kategoriPelanggan);
    setCatatanKendala(visit.catatanKendala ?? "");
    setBentukPenyelesaian(visit.bentukPenyelesaian);
    setRentangJanjiBayar(visit.rentangJanjiBayar ?? "");
    setActiveJenisEvidence(
      visit.bentukPenyelesaian === "DIPUTUS" ? "PEMUTUSAN" : "PENYAMPAIAN"
    );
    setExistingEvidenceInEdit(visit.daftarEvidence);
    setRemovedExistingIds([]);

    // Batalkan request GPS lama agar tidak menimpa data kunjungan yang diedit
    gpsRequestCounterRef.current++;

    if (visit.latitude && visit.longitude) {
      setLatitude(visit.latitude);
      setLongitude(visit.longitude);
      setGpsAccuracy(null);
      setGpsErrorDetail("");
      setGpsStatus("locked");
      setAlasanKendalaGps("");
    } else {
      setLatitude("");
      setLongitude("");
      setGpsAccuracy(null);
      setGpsErrorDetail(
        "Kunjungan ini sebelumnya disimpan menggunakan alasan kendala GPS."
      );
      setGpsStatus("failed");
      setAlasanKendalaGps(visit.alasanKendalaGps ?? "");
    }

    formContainerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleCancelEdit = () => {
    clearPendingPhotos();
    setFormError(null);
    setEditingPenagihanId(null);
    setEditingWaktuInput(null);
    setKategoriPelanggan("KENDALI_PETUGAS");
    setCatatanKendala("");
    setBentukPenyelesaian("");
    setRentangJanjiBayar("");
    setActiveJenisEvidence("PENYAMPAIAN");
    setExistingEvidenceInEdit([]);
    setRemovedExistingIds([]);
    setAlasanKendalaGps("");
    requestGpsLock();
  };

  const previewJanjiBayarDates = React.useMemo(() => {
    if (bentukPenyelesaian !== "JANJI_BAYAR" || !rentangJanjiBayar) {
      return null;
    }
    try {
      return hitungRentangTanggalJanjiBayar(piutang.periode, rentangJanjiBayar);
    } catch {
      return null;
    }
  }, [bentukPenyelesaian, piutang.periode, rentangJanjiBayar]);

  const activePemutusanCount = React.useMemo(() => {
    const removedSet = new Set(removedExistingIds);
    const remainingExisting = existingEvidenceInEdit.filter(
      (ev) => ev.jenisEvidence === "PEMUTUSAN" && !removedSet.has(ev.id)
    ).length;
    const newUploads = pendingPhotos.filter(
      (item) => item.jenisEvidence === "PEMUTUSAN"
    ).length;
    return remainingExisting + newUploads;
  }, [existingEvidenceInEdit, removedExistingIds, pendingPhotos]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    if (isCompressing) {
      setFormError("Mohon tunggu hingga proses kompresi foto selesai.");
      return;
    }

    if (gpsStatus === "acquiring") {
      setFormError(
        "Penguncian koordinat GPS masih berlangsung (maks. 10 detik). Mohon tunggu sebentar."
      );
      return;
    }

    const hasValidCoordinates =
      gpsStatus === "locked" &&
      latitude.trim().length > 0 &&
      longitude.trim().length > 0;

    if (!hasValidCoordinates && alasanKendalaGps.trim().length < 5) {
      setFormError(
        "Koordinat GPS tidak terkunci. Alasan kendala GPS wajib diisi minimal 5 karakter."
      );
      return;
    }

    if (
      kategoriPelanggan === "DI_LUAR_KENDALI_PETUGAS" &&
      catatanKendala.trim().length < 5
    ) {
      setFormError(
        "Catatan kendala wajib diisi minimal 5 karakter untuk kategori Di Luar Kendali Petugas."
      );
      return;
    }

    if (!bentukPenyelesaian) {
      setFormError("Silakan pilih Bentuk Penyelesaian terlebih dahulu.");
      return;
    }

    if (bentukPenyelesaian === "JANJI_BAYAR" && !rentangJanjiBayar) {
      setFormError(
        "Rentang tanggal janji bayar wajib dipilih untuk penyelesaian Janji Bayar."
      );
      return;
    }

    if (bentukPenyelesaian === "DIPUTUS" && activePemutusanCount < 1) {
      setFormError(
        "Penyelesaian DIPUTUS wajib melampirkan minimal 1 foto bukti berjenis PEMUTUSAN."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      if (editingPenagihanId === null) {
        formData.append("idPiutang", String(piutang.id));
      }

      formData.append("kategoriPelanggan", kategoriPelanggan);
      formData.append("catatanKendala", catatanKendala.trim());
      formData.append("bentukPenyelesaian", bentukPenyelesaian);

      if (bentukPenyelesaian === "JANJI_BAYAR" && rentangJanjiBayar) {
        formData.append("rentangJanjiBayar", rentangJanjiBayar);
      }

      if (hasValidCoordinates) {
        formData.append("latitude", latitude.trim());
        formData.append("longitude", longitude.trim());
      } else {
        formData.append("alasanKendalaGps", alasanKendalaGps.trim());
      }

      for (const photo of pendingPhotos) {
        formData.append("evidenceFile", photo.file);
        formData.append("jenisEvidence", photo.jenisEvidence);
      }

      if (editingPenagihanId !== null && removedExistingIds.length > 0) {
        for (const removedId of removedExistingIds) {
          formData.append("removeEvidenceIds", String(removedId));
        }
      }

      const endpoint =
        editingPenagihanId !== null
          ? `/api/petugas/penagihan/${editingPenagihanId}`
          : "/api/petugas/penagihan";
      const method = editingPenagihanId !== null ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const message =
          data?.error ?? "Gagal menyimpan laporan kunjungan lapangan.";
        setFormError(message);
        toast.error(message);
        return;
      }

      toast.success(
        data?.message ??
          (editingPenagihanId !== null
            ? "Perubahan laporan kunjungan berhasil disimpan."
            : "Laporan kunjungan penagihan berhasil disimpan.")
      );

      clearPendingPhotos();
      setEditingPenagihanId(null);
      setEditingWaktuInput(null);
      setExistingEvidenceInEdit([]);
      setRemovedExistingIds([]);
      setCatatanKendala("");
      setBentukPenyelesaian("");
      setRentangJanjiBayar("");
      setActiveJenisEvidence("PENYAMPAIAN");

      if (editingPenagihanId !== null) {
        requestGpsLock();
      }

      router.refresh();
    } catch {
      const msg =
        "Terjadi gangguan jaringan saat mengirim laporan kunjungan ke server.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showFormSection = !isPiutangLocked || editingPenagihanId !== null;

  return (
    <div className={cn("space-y-4", showFormSection && "pb-36 lg:pb-8")}>
      {/* Header & Breadcrumb Navigasi Kembali */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/petugas"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-900 shadow-xs transition-colors hover:bg-slate-50 lg:h-9 lg:min-h-9"
          >
            <ArrowLeft className="h-4 w-4 text-slate-700" strokeWidth={1.75} />
            <span>Kembali ke Daftar Tugas</span>
          </Link>

          <nav
            aria-label="Breadcrumb"
            className="hidden items-center gap-2 text-xs text-slate-500 lg:flex"
          >
            <Link href="/petugas" className="hover:text-slate-900">
              Daftar Tugas Saya
            </Link>
            <span>/</span>
            <span className="font-mono font-semibold text-slate-800 tabular-nums">
              {piutang.idPelanggan}
            </span>
            <span>•</span>
            <span className="truncate font-medium text-slate-700">
              {piutang.pelanggan.namaPelanggan}
            </span>
          </nav>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs font-semibold text-slate-700 tabular-nums">
            Periode {piutang.periode}
          </span>
          <StatusBadge status={piutang.statusRekonsiliasi} />
        </div>
      </div>

      {/* Workspace Adaptif: 1 Kolom Mobile (Detail -> Form -> Riwayat) | 2 Kolom Enterprise Desktop */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
        {/* Kolom Kiri Desktop (order-2 di Mobile, col-span-7 di Desktop): Banner Read-Only & Form Kunjungan */}
        <div className="order-2 space-y-4 lg:order-1 lg:col-span-7">
          {/* Banner Read-Only jika Piutang Sudah Lunas Resmi */}
          {isPiutangLocked && editingPenagihanId === null && (
            <Alert className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-950">
              <CheckCircle2
                className="h-4 w-4 text-emerald-700"
                strokeWidth={1.75}
              />
              <AlertTitle className="text-xs font-semibold tracking-wide text-emerald-900 uppercase">
                Piutang Sudah Terverifikasi ({piutang.statusRekonsiliasi})
              </AlertTitle>
              <AlertDescription className="text-xs text-emerald-900">
                Status piutang pelanggan ini telah berstatus Lunas Resmi atau
                belum dipetakan sehingga input kunjungan baru dinonaktifkan. Anda
                tetap dapat meninjau riwayat kunjungan pada panel riwayat.
              </AlertDescription>
            </Alert>
          )}

          {/* Panel Form Kunjungan Lapangan */}
          {showFormSection && (
            <section
              ref={formContainerRef}
              aria-label="Form Kunjungan Lapangan"
              className="rounded-md border border-slate-200 bg-white p-4 shadow-xs lg:p-5"
            >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {editingPenagihanId !== null
                  ? "Edit Laporan Kunjungan Lapangan"
                  : "Input Laporan Kunjungan Lapangan"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                {editingPenagihanId !== null && editingWaktuInput
                  ? `Mengubah kunjungan input ${formatTanggalWib(editingWaktuInput)}`
                  : "Lengkapi kondisi lapangan, koordinat GPS, dan foto bukti."}
              </p>
            </div>
            {editingPenagihanId !== null && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Batal Edit
              </button>
            )}
          </div>

          {editingPenagihanId !== null && editingWaktuInput && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
              <p className="font-semibold">
                Mode Edit Aktif (Batas 24 Jam Sejak Input)
              </p>
              <p className="mt-0.5 tabular-nums">
                Sisa jendela edit:{" "}
                <strong>
                  {formatRemainingEditWindow(
                    EDIT_WINDOW_MS - (nowMs - Date.parse(editingWaktuInput))
                  )}
                </strong>
                . Perubahan pada kunjungan terbaru akan menyinkronkan status
                piutang secara otomatis.
              </p>
            </div>
          )}

          {formError && (
            <Alert
              variant="destructive"
              className="mt-3 rounded-md border-red-200 bg-red-50 text-red-900"
            >
              <AlertCircle
                className="h-4 w-4 text-red-700"
                strokeWidth={1.75}
              />
              <AlertTitle className="text-xs font-semibold tracking-wide text-red-900 uppercase">
                Validasi Laporan Kunjungan
              </AlertTitle>
              <AlertDescription className="text-xs text-red-800">
                {formError}
              </AlertDescription>
            </Alert>
          )}

          <form
            id="form-kunjungan-lapangan"
            onSubmit={handleSubmit}
            className="mt-4 space-y-5"
            noValidate
          >
            {/* 1. Panel Status GPS */}
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold tracking-wide text-slate-800 uppercase">
                1. Koordinat Lokasi Lapangan (GPS)
              </Label>

              {gpsStatus === "acquiring" && (
                <div className="rounded-md border border-sky-200 bg-sky-50 p-3.5 text-sky-950">
                  <div className="flex items-center gap-2.5">
                    <Loader2
                      className="h-4 w-4 shrink-0 animate-spin text-sky-700"
                      strokeWidth={1.75}
                    />
                    <span className="text-xs font-semibold">
                      Mengunci koordinat GPS (maks. 10 detik)...
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-sky-900">
                    Pastikan izin lokasi browser diaktifkan untuk akurasi
                    titik koordinat kunjungan.
                  </p>
                </div>
              )}

              {gpsStatus === "locked" && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3.5 text-emerald-950">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                        <Navigation
                          className="h-4 w-4 shrink-0 text-emerald-700"
                          strokeWidth={1.75}
                        />
                        <span>Koordinat GPS Terkunci</span>
                      </div>
                      <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {latitude}, {longitude}
                      </p>
                      {gpsAccuracy !== null && (
                        <p className="text-xs text-emerald-900 tabular-nums">
                          Akurasi estimasi: +/- {gpsAccuracy} meter
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => requestGpsLock()}
                      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
                    >
                      <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                      <span>Perbarui GPS</span>
                    </button>
                  </div>
                </div>
              )}

              {gpsStatus === "failed" && (
                <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3.5 text-slate-900">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0 text-amber-800"
                        strokeWidth={1.75}
                      />
                      <div>
                        <p className="text-xs font-semibold text-amber-950">
                          GPS Tidak Terkunci (Mode Fallback)
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-amber-900">
                          {gpsErrorDetail}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => requestGpsLock()}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-amber-400 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-amber-100"
                  >
                    <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                    <span>Coba Kunci Ulang GPS</span>
                  </button>

                  <div className="space-y-1.5 border-t border-amber-200 pt-3">
                    <Label
                      htmlFor="alasan-kendala-gps"
                      className="text-xs font-semibold text-slate-900"
                    >
                      Alasan Kendala GPS{" "}
                      <span className="text-red-700">* (Wajib min. 5 karakter)</span>
                    </Label>
                    <Textarea
                      id="alasan-kendala-gps"
                      value={alasanKendalaGps}
                      onChange={(e) => setAlasanKendalaGps(e.target.value)}
                      placeholder="Contoh: Sinyal GPS lemah di dalam gang padat / cuaca mendung tebal"
                      className="min-h-20 rounded-md border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-600"
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Kategori Pelanggan */}
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold tracking-wide text-slate-800 uppercase">
                2. Kategori Kondisi Pelanggan
              </Label>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setKategoriPelanggan("KENDALI_PETUGAS")}
                  aria-pressed={kategoriPelanggan === "KENDALI_PETUGAS"}
                  className={cn(
                    "flex min-h-11 flex-col items-start justify-center rounded-md border px-3.5 py-2.5 text-left transition-colors",
                    kategoriPelanggan === "KENDALI_PETUGAS"
                      ? "border-sky-600 bg-sky-50 text-sky-900 ring-1 ring-sky-600"
                      : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <span className="text-sm font-semibold">Kendali Petugas</span>
                  <span className="mt-0.5 text-xs text-slate-600">
                    Pelanggan dapat ditemui / diakses
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setKategoriPelanggan("DI_LUAR_KENDALI_PETUGAS")
                  }
                  aria-pressed={
                    kategoriPelanggan === "DI_LUAR_KENDALI_PETUGAS"
                  }
                  className={cn(
                    "flex min-h-11 flex-col items-start justify-center rounded-md border px-3.5 py-2.5 text-left transition-colors",
                    kategoriPelanggan === "DI_LUAR_KENDALI_PETUGAS"
                      ? "border-sky-600 bg-sky-50 text-sky-900 ring-1 ring-sky-600"
                      : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <span className="text-sm font-semibold">
                    Di Luar Kendali Petugas
                  </span>
                  <span className="mt-0.5 text-xs text-slate-600">
                    Rumah kosong, pindah, atau akses terkunci
                  </span>
                </button>
              </div>

              {kategoriPelanggan === "DI_LUAR_KENDALI_PETUGAS" && (
                <div className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <Label
                    htmlFor="catatan-kendala"
                    className="text-xs font-semibold text-slate-900"
                  >
                    Catatan Kendala Lapangan{" "}
                    <span className="text-red-700">* (Wajib min. 5 karakter)</span>
                  </Label>
                  <Textarea
                    id="catatan-kendala"
                    value={catatanKendala}
                    onChange={(e) => setCatatanKendala(e.target.value)}
                    placeholder="Jelaskan kondisi kendala lapangan yang ditemui..."
                    className="min-h-20 rounded-md border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-600"
                    required
                  />
                </div>
              )}

              {kategoriPelanggan === "KENDALI_PETUGAS" && (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="catatan-kendala-opsional"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Catatan Tambahan Lapangan (Opsional)
                  </Label>
                  <Textarea
                    id="catatan-kendala-opsional"
                    value={catatanKendala}
                    onChange={(e) => setCatatanKendala(e.target.value)}
                    placeholder="Catatan singkat hasil pertemuan dengan pelanggan (jika ada)..."
                    className="min-h-16 rounded-md border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-600"
                  />
                </div>
              )}
            </div>

            {/* 3. Bentuk Penyelesaian */}
            <div className="space-y-2.5">
              <Label className="text-xs font-semibold tracking-wide text-slate-800 uppercase">
                3. Bentuk Penyelesaian Penagihan{" "}
                <span className="text-red-700">*</span>
              </Label>

              <div className="grid grid-cols-2 gap-2.5">
                {PENYELESAIAN_CHOICES.map((choice) => {
                  const selected = bentukPenyelesaian === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => handleSelectPenyelesaian(choice.value)}
                      aria-pressed={selected}
                      className={cn(
                        "flex min-h-11 flex-col items-start justify-center rounded-md border px-3 py-2.5 text-left transition-colors",
                        selected
                          ? "border-sky-600 bg-sky-50 text-sky-900 ring-1 ring-sky-600"
                          : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                      )}
                    >
                      <span className="text-sm font-semibold">
                        {choice.label}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 text-[11px] leading-snug",
                          selected ? "text-sky-800" : "text-slate-600"
                        )}
                      >
                        {choice.helper}
                      </span>
                    </button>
                  );
                })}
              </div>

              {(bentukPenyelesaian === "LUNAS_ONLINE" ||
                bentukPenyelesaian === "TITIP_LUNAS") && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                  <Info
                    className="mt-0.5 h-4 w-4 shrink-0 text-amber-800"
                    strokeWidth={1.75}
                  />
                  <p className="leading-relaxed">
                    Status piutang akan tercatat sebagai{" "}
                    <strong>Klaim Lapangan</strong> hingga terverifikasi melalui
                    impor data Excel resmi Admin (tidak langsung mengubah status
                    Lunas Resmi maupun realisasi kinerja).
                  </p>
                </div>
              )}

              {bentukPenyelesaian === "JANJI_BAYAR" && (
                <div className="space-y-2.5 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <Label className="text-xs font-semibold text-slate-900">
                    Rentang Tanggal Janji Bayar{" "}
                    <span className="text-red-700">* (Wajib dipilih)</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {RENTANG_JANJI_BAYAR_OPTIONS.map((opt) => {
                      const active = rentangJanjiBayar === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setRentangJanjiBayar(opt.value)}
                          aria-pressed={active}
                          className={cn(
                            "min-h-11 rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors",
                            opt.value === "DI_ATAS_20" && "col-span-2",
                            active
                              ? "border-sky-600 bg-sky-600 text-white"
                              : "border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {previewJanjiBayarDates && (
                    <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 tabular-nums">
                      <CalendarClock
                        className="h-4 w-4 shrink-0 text-sky-600"
                        strokeWidth={1.75}
                      />
                      <span>
                        Jatuh tempo terhitung:{" "}
                        <strong className="text-slate-900">
                          {formatTanggalDateOnlyId(
                            previewJanjiBayarDates.tanggalMulaiRentang
                          )}{" "}
                          s.d.{" "}
                          {formatTanggalDateOnlyId(
                            previewJanjiBayarDates.tanggalJatuhTempo
                          )}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {bentukPenyelesaian === "DIPUTUS" && (
                <div
                  className={cn(
                    "flex items-start gap-2 rounded-md border p-3 text-xs",
                    activePemutusanCount >= 1
                      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                      : "border-red-200 bg-red-50 text-red-900"
                  )}
                >
                  <AlertCircle
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      activePemutusanCount >= 1
                        ? "text-emerald-700"
                        : "text-red-700"
                    )}
                    strokeWidth={1.75}
                  />
                  <p className="leading-relaxed">
                    {activePemutusanCount >= 1
                      ? `Syarat foto bukti PEMUTUSAN terpenuhi (${activePemutusanCount} foto terlampir).`
                      : "Penyelesaian DIPUTUS wajib melampirkan minimal 1 foto bukti berjenis PEMUTUSAN di bawah ini."}
                  </p>
                </div>
              )}
            </div>

            {/* 4. Unggah & Kompresi Foto Evidence */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold tracking-wide text-slate-800 uppercase">
                  4. Foto Bukti Lapangan (Privat UU PDP)
                </Label>
                <span className="font-mono text-[11px] font-semibold text-slate-600 tabular-nums">
                  Maks. 300 KB / foto
                </span>
              </div>

              {/* Pilihan Jenis Evidence untuk foto berikutnya */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveJenisEvidence("PENYAMPAIAN")}
                  aria-pressed={activeJenisEvidence === "PENYAMPAIAN"}
                  className={cn(
                    "min-h-11 rounded-md border px-3 text-xs font-semibold transition-colors",
                    activeJenisEvidence === "PENYAMPAIAN"
                      ? "border-sky-600 bg-sky-50 text-sky-900 ring-1 ring-sky-600"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                >
                  Foto Penyampaian
                </button>
                <button
                  type="button"
                  onClick={() => setActiveJenisEvidence("PEMUTUSAN")}
                  aria-pressed={activeJenisEvidence === "PEMUTUSAN"}
                  className={cn(
                    "min-h-11 rounded-md border px-3 text-xs font-semibold transition-colors",
                    activeJenisEvidence === "PEMUTUSAN"
                      ? "border-sky-600 bg-sky-50 text-sky-900 ring-1 ring-sky-600"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                >
                  Foto Pemutusan
                </button>
              </div>

              {/* Input Kamera / Upload */}
              <div>
                <input
                  ref={fileInputRef}
                  id="evidence-camera-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  disabled={isCompressing || isSubmitting}
                  className="sr-only"
                />
                <label
                  htmlFor="evidence-camera-input"
                  className={cn(
                    "flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-sky-400 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900 transition-colors hover:bg-sky-100",
                    (isCompressing || isSubmitting) &&
                      "pointer-events-none opacity-60"
                  )}
                >
                  {isCompressing ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin text-sky-700"
                        strokeWidth={1.75}
                      />
                      <span className="tabular-nums">
                        Mengompresi foto otomatis... {compressProgress}%
                      </span>
                    </>
                  ) : (
                    <>
                      <Camera
                        className="h-4 w-4 text-sky-700"
                        strokeWidth={1.75}
                      />
                      <span>
                        Ambil Foto Kamera / Pilih Berkas (
                        {activeJenisEvidence === "PEMUTUSAN"
                          ? "Pemutusan"
                          : "Penyampaian"}
                        )
                      </span>
                      <Upload
                        className="h-4 w-4 text-sky-700"
                        strokeWidth={1.75}
                      />
                    </>
                  )}
                </label>
              </div>

              {/* Foto Lama Saat Mode Edit */}
              {editingPenagihanId !== null &&
                existingEvidenceInEdit.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-700">
                      Foto Tersimpan Sebelumnya ({existingEvidenceInEdit.length})
                    </p>
                    <div className="space-y-2">
                      {existingEvidenceInEdit.map((ev) => {
                        const markedRemoved = removedExistingIds.includes(
                          ev.id
                        );
                        return (
                          <div
                            key={ev.id}
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-md border p-2.5",
                              markedRemoved
                                ? "border-red-200 bg-red-50/70"
                                : "border-slate-200 bg-slate-50"
                            )}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewModal({
                                  url: `/api/evidence/${ev.id}`,
                                  title: `Foto ${ev.jenisEvidence}`,
                                  subtitle: `Ukuran tersimpan: ${ev.fileSizeKb ?? 0} KB`,
                                })
                              }
                              className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/evidence/${ev.id}`}
                                alt={`Evidence ${ev.jenisEvidence}`}
                                className={cn(
                                  "h-12 w-12 shrink-0 rounded-md border border-slate-200 object-cover",
                                  markedRemoved && "opacity-45"
                                )}
                              />
                              <div className="min-w-0">
                                <p
                                  className={cn(
                                    "text-xs font-semibold text-slate-900",
                                    markedRemoved && "line-through"
                                  )}
                                >
                                  {ev.jenisEvidence}
                                </p>
                                <p className="text-xs text-slate-600 tabular-nums">
                                  Tersimpan: {ev.fileSizeKb ?? "-"} KB
                                </p>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleToggleRemoveExistingEvidence(ev.id)
                              }
                              className={cn(
                                "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border px-3 text-xs font-semibold",
                                markedRemoved
                                  ? "border-slate-300 bg-white text-slate-800"
                                  : "border-red-200 bg-white text-red-700 hover:bg-red-50"
                              )}
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                              <span>{markedRemoved ? "Batal Hapus" : "Hapus"}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Daftar Foto Baru Terkompresi */}
              {pendingPhotos.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-slate-700">
                    Foto Siap Dikirim ({pendingPhotos.length})
                  </p>
                  {pendingPhotos.map((photo) => (
                    <div
                      key={photo.localId}
                      className="space-y-2.5 rounded-md border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewModal({
                              url: photo.previewUrl,
                              title: `Pratinjau Foto ${photo.jenisEvidence}`,
                              subtitle: `Asli: ${formatKb(photo.originalSizeBytes)} -> Terkompresi: ${formatKb(photo.compressedSizeBytes)}`,
                            })
                          }
                          className="shrink-0 overflow-hidden rounded-md border border-slate-300 bg-white"
                          aria-label="Perbesar pratinjau foto"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.previewUrl}
                            alt={`Pratinjau ${photo.jenisEvidence}`}
                            className="h-16 w-16 object-cover"
                          />
                        </button>

                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {photo.file.name}
                          </p>
                          <p className="text-xs font-medium text-emerald-800 tabular-nums">
                            Asli: {formatKb(photo.originalSizeBytes)} -&gt;
                            Terkompresi: {formatKb(photo.compressedSizeBytes)}{" "}
                            (Memenuhi &lt; 300 KB)
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemovePendingPhoto(photo.localId)}
                          aria-label="Hapus foto ini"
                          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleChangePendingPhotoJenis(
                              photo.localId,
                              "PENYAMPAIAN"
                            )
                          }
                          className={cn(
                            "min-h-11 rounded-md border px-2.5 text-xs font-semibold",
                            photo.jenisEvidence === "PENYAMPAIAN"
                              ? "border-sky-600 bg-sky-600 text-white"
                              : "border-slate-300 bg-white text-slate-800"
                          )}
                        >
                          PENYAMPAIAN
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleChangePendingPhotoJenis(
                              photo.localId,
                              "PEMUTUSAN"
                            )
                          }
                          className={cn(
                            "min-h-11 rounded-md border px-2.5 text-xs font-semibold",
                            photo.jenisEvidence === "PEMUTUSAN"
                              ? "border-sky-600 bg-sky-600 text-white"
                              : "border-slate-300 bg-white text-slate-800"
                          )}
                        >
                          PEMUTUSAN
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Action Bar Inline Khusus Desktop (>= lg) */}
            <div className="hidden items-center justify-end gap-3 border-t border-slate-200 pt-4 lg:flex">
              {editingPenagihanId !== null && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal Edit
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting || isCompressing}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-sky-600 px-5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-sky-700 disabled:pointer-events-none disabled:opacity-60"
              >
                {isSubmitting && (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                )}
                <span>
                  {isSubmitting
                    ? "Menyimpan Laporan..."
                    : editingPenagihanId !== null
                      ? "Simpan Perubahan Kunjungan"
                      : "Simpan Laporan Kunjungan"}
                </span>
              </button>
            </div>
          </form>
        </section>
      )}
        </div>

        {/* Kolom Kanan Desktop (contents di Mobile agar urutan tetap Detail -> Form -> Riwayat; sticky block di Desktop) */}
        <div className="contents lg:sticky lg:top-20 lg:order-2 lg:col-span-5 lg:block lg:space-y-4">
          {/* Kartu 1: Ringkasan Profil Pelanggan & Tagihan (order-1 di Mobile) */}
          <section
            aria-label="Detail Pelanggan Piutang"
            className="order-1 rounded-md border border-slate-200 bg-white p-4 shadow-xs"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                    {piutang.idPelanggan}
                  </span>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-medium text-slate-700 tabular-nums">
                    Periode {piutang.periode}
                  </span>
                </div>
                <h1 className="mt-1 text-base font-bold text-slate-900">
                  {piutang.pelanggan.namaPelanggan}
                </h1>
              </div>
              <StatusBadge status={piutang.statusRekonsiliasi} />
            </div>

            <div className="mt-3 flex items-start gap-2 text-xs text-slate-700">
              <MapPin
                className="mt-0.5 h-4 w-4 shrink-0 text-slate-600"
                strokeWidth={1.75}
              />
              <p className="leading-relaxed">{piutang.pelanggan.alamat}</p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-slate-200 pt-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                  Tarif / Daya & Lembar
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900 tabular-nums">
                  <Zap className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
                  <span>
                    {piutang.pelanggan.tarif} /{" "}
                    {formatDaya(piutang.pelanggan.daya)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs font-medium text-slate-700 tabular-nums">
                  {piutang.jumlahLembar.toLocaleString("id-ID")} Lembar Tagihan
                </p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-semibold tracking-wide text-slate-600 uppercase">
                  Total Nilai Tagihan
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                  {formatRupiah(piutang.nilaiTagihan)}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-600 tabular-nums">
                  Unit {piutang.pelanggan.kodeUnit ?? "51304"}
                </p>
              </div>
            </div>
          </section>

          {/* Kartu 2: Riwayat Multi-Kunjungan & Foto Evidence (order-3 di Mobile) */}
          <section
            aria-label="Riwayat Kunjungan Piutang"
            className="order-3 space-y-3 rounded-md border border-slate-200 bg-white p-4 shadow-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <History
                  className="h-4 w-4 text-sky-600"
                  strokeWidth={1.75}
                />
                <h2 className="text-sm font-semibold text-slate-900">
                  Riwayat Kunjungan Lapangan
                </h2>
              </div>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-slate-700 tabular-nums">
                {piutang.riwayatPenagihan.length} Catatan
              </span>
            </div>

            {piutang.riwayatPenagihan.length === 0 ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-5 text-center">
                <p className="text-sm font-semibold text-slate-900">
                  Belum Ada Riwayat Kunjungan
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Laporan kunjungan yang Anda simpan akan tercatat secara
                  kronologis di sini.
                </p>
              </div>
            ) : (
              <div className="space-y-3 lg:max-h-[520px] lg:overflow-y-auto lg:pr-1">
                {piutang.riwayatPenagihan.map((visit, index) => {
                  const visitAgeMs = nowMs - Date.parse(visit.waktuInput);
                  const remainingMs = EDIT_WINDOW_MS - visitAgeMs;
                  const isEditable = !isPiutangLocked && remainingMs >= 0;
                  const isCurrentlyEditing = editingPenagihanId === visit.id;

                  return (
                    <article
                      key={visit.id}
                      className={cn(
                        "space-y-3 rounded-md border bg-white p-3.5",
                        isCurrentlyEditing
                          ? "border-sky-600 ring-1 ring-sky-600"
                          : "border-slate-200"
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 tabular-nums">
                              Kunjungan #
                              {piutang.riwayatPenagihan.length - index}
                            </span>
                            <span className="text-xs font-medium text-slate-600 tabular-nums">
                              {formatTanggalWib(visit.waktuInput)}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs font-semibold text-slate-900">
                            {visit.kategoriPelanggan === "KENDALI_PETUGAS"
                              ? "Kendali Petugas"
                              : "Di Luar Kendali Petugas"}
                          </p>
                        </div>

                        <StatusBadge status={visit.bentukPenyelesaian} />
                      </div>

                      {visit.rentangJanjiBayar && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-800">
                            <Clock
                              className="h-4 w-4 shrink-0 text-amber-700"
                              strokeWidth={1.75}
                            />
                            <span className="font-semibold">
                              {
                                RENTANG_JANJI_BAYAR_LABEL_MAP[
                                  visit.rentangJanjiBayar
                                ]
                              }
                            </span>
                          </div>
                          {visit.pengingat && (
                            <StatusBadge
                              status={visit.pengingat.statusPengingat}
                            />
                          )}
                        </div>
                      )}

                      {visit.pengingat && (
                        <p className="text-xs text-slate-600 tabular-nums">
                          Periode pantau:{" "}
                          <strong className="text-slate-900">
                            {formatTanggalDateOnlyId(
                              visit.pengingat.tanggalMulaiRentang
                            )}{" "}
                            s.d.{" "}
                            {formatTanggalDateOnlyId(
                              visit.pengingat.tanggalJatuhTempo
                            )}
                          </strong>
                        </p>
                      )}

                      {visit.catatanKendala && (
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                          <p className="font-semibold text-slate-800">
                            Catatan Kendala / Lapangan:
                          </p>
                          <p className="mt-1 leading-relaxed text-slate-700">
                            {visit.catatanKendala}
                          </p>
                        </div>
                      )}

                      {/* Info GPS / Fallback */}
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                        {visit.latitude && visit.longitude ? (
                          <div className="flex items-center gap-2 text-slate-800">
                            <Navigation
                              className="h-4 w-4 shrink-0 text-emerald-700"
                              strokeWidth={1.75}
                            />
                            <span>
                              GPS:{" "}
                              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                                {visit.latitude}, {visit.longitude}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1 text-slate-800">
                            <p className="font-semibold text-amber-900">
                              GPS Tidak Terkunci (Fallback)
                            </p>
                            <p className="leading-relaxed text-slate-700">
                              Alasan: {visit.alasanKendalaGps ?? "-"}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Galeri Evidence Privat */}
                      {visit.daftarEvidence.length > 0 && (
                        <div className="space-y-2">
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                            <ImageIcon
                              className="h-4 w-4 text-sky-600"
                              strokeWidth={1.75}
                            />
                            <span>
                              Bukti Foto Lapangan ({visit.daftarEvidence.length}
                              )
                            </span>
                          </p>
                          <div className="grid grid-cols-2 gap-2.5">
                            {visit.daftarEvidence.map((ev) => (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={() =>
                                  setPreviewModal({
                                    url: `/api/evidence/${ev.id}`,
                                    title: `Bukti Foto ${ev.jenisEvidence}`,
                                    subtitle: `Diunggah ${formatTanggalWib(ev.uploadedAt)} • ${ev.fileSizeKb ?? 0} KB`,
                                  })
                                }
                                className="group min-h-11 overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-left transition-colors hover:border-sky-500"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`/api/evidence/${ev.id}`}
                                  alt={`Evidence ${ev.jenisEvidence}`}
                                  className="h-28 w-full object-cover"
                                />
                                <div className="flex items-center justify-between border-t border-slate-200 bg-white px-2.5 py-2 text-[11px]">
                                  <span className="font-semibold text-slate-900">
                                    {ev.jenisEvidence}
                                  </span>
                                  <span className="font-mono text-slate-600 tabular-nums">
                                    {ev.fileSizeKb ?? "-"} KB
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer Jendela Edit 24 Jam */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
                        {isEditable ? (
                          <>
                            <span className="text-xs font-medium text-slate-600 tabular-nums">
                              Sisa waktu edit:{" "}
                              <strong className="text-slate-900">
                                {formatRemainingEditWindow(remainingMs)}
                              </strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartEditVisit(visit)}
                              disabled={isCurrentlyEditing}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-sky-600 bg-white px-3.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50 lg:min-h-9"
                            >
                              <Edit3 className="h-4 w-4" strokeWidth={1.75} />
                              <span>
                                {isCurrentlyEditing
                                  ? "Sedang Diedit"
                                  : "Edit Kunjungan"}
                              </span>
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
                            <span>
                              {isPiutangLocked
                                ? "Terkunci (Piutang Final)"
                                : "Terkunci (> 24 Jam)"}
                            </span>
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Sticky Bottom Action Bar Khusus Mobile (< lg) di atas Bottom Navigation Bar (bottom-16) */}
      {showFormSection && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white px-4 py-3 shadow-xs lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-2.5">
            {editingPenagihanId !== null && (
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
            )}
            <button
              type="submit"
              form="form-kunjungan-lapangan"
              disabled={isSubmitting || isCompressing}
              className="inline-flex min-h-12 w-full flex-1 items-center justify-center gap-2 rounded-md bg-sky-600 px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-sky-700 disabled:pointer-events-none disabled:opacity-60"
            >
              {isSubmitting && (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  strokeWidth={1.75}
                />
              )}
              <span>
                {isSubmitting
                  ? "Menyimpan Laporan..."
                  : editingPenagihanId !== null
                    ? "Simpan Perubahan Kunjungan"
                    : "Simpan Laporan Kunjungan"}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Dialog Pratinjau Foto Penuh */}
      <Dialog
        open={previewModal !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewModal(null);
        }}
      >
        <DialogContent className="max-w-md rounded-md border border-slate-200 bg-white p-4">
          <DialogHeader className="text-left">
            <DialogTitle className="text-sm font-semibold text-slate-900">
              {previewModal?.title ?? "Pratinjau Foto Evidence"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 tabular-nums">
              {previewModal?.subtitle ?? ""}
            </DialogDescription>
          </DialogHeader>
          {previewModal && (
            <>
              <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewModal.url}
                  alt={previewModal.title}
                  className="max-h-[65vh] w-full object-contain"
                />
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Tutup Pratinjau
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
