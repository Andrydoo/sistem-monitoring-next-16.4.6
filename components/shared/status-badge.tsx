import type {
  BentukPenyelesaian,
  StatusPengingat,
  StatusRekonsiliasi,
} from "@prisma/client";
import { cn } from "@/lib/utils";

export type SupportedStatusType =
  | StatusRekonsiliasi
  | StatusPengingat
  | BentukPenyelesaian;

interface StatusConfig {
  label: string;
  className: string;
}

const STATUS_CONFIG_MAP: Record<SupportedStatusType, StatusConfig> = {
  // Hijau (Selesai / Lunas Resmi)
  LUNAS_RESMI: {
    label: "Lunas Resmi",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  SELESAI: {
    label: "Selesai",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  LUNAS_ONLINE: {
    label: "Lunas Online",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  TITIP_LUNAS: {
    label: "Titip Lunas",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },

  // Kuning / Amber (Masa Janji Bayar / Klaim Lapangan / Aktif)
  MASA_JANJI_BAYAR: {
    label: "Masa Janji Bayar",
    className: "bg-amber-50 text-amber-800 border border-amber-200",
  },
  KLAIM_LAPANGAN: {
    label: "Klaim Lapangan",
    className: "bg-amber-50 text-amber-800 border border-amber-200",
  },
  AKTIF: {
    label: "Aktif",
    className: "bg-amber-50 text-amber-800 border border-amber-200",
  },
  JANJI_BAYAR: {
    label: "Janji Bayar",
    className: "bg-amber-50 text-amber-800 border border-amber-200",
  },

  // Merah (Overdue / Diputus / Unassigned)
  OVERDUE: {
    label: "Overdue",
    className: "bg-red-50 text-red-700 border border-red-200",
  },
  DIPUTUS: {
    label: "Diputus",
    className: "bg-red-50 text-red-700 border border-red-200",
  },
  UNASSIGNED: {
    label: "Belum Dipetakan (Unassigned)",
    className: "bg-red-50 text-red-700 border border-red-200",
  },

  // Netral / Slate (Belum Tertagih / Ditindaklanjuti)
  BELUM_TERTAGIH: {
    label: "Belum Tertagih",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
  },
  DITINDAKLANJUTI: {
    label: "Ditindaklanjuti",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
  },
};

export interface StatusBadgeProps {
  status: SupportedStatusType | string;
  customLabel?: string;
  className?: string;
}

export function StatusBadge({
  status,
  customLabel,
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG_MAP[status as SupportedStatusType] ?? {
    label: status,
    className: "bg-slate-100 text-slate-700 border border-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        config.className,
        className
      )}
    >
      {customLabel ?? config.label}
    </span>
  );
}
