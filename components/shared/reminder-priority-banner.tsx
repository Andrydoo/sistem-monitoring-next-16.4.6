import Link from "next/link";
import { AlertOctagon, ArrowRight, Clock } from "lucide-react";
import { EvaluateRemindersButton } from "@/components/admin/evaluate-reminders-button";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ReminderPriorityBannerProps {
  overdueCount: number;
  masaJanjiBayarCount: number;
  overdueNominal?: bigint | string | number;
  variant: "petugas" | "admin";
  ctaHref: string;
  ctaLabel?: string;
  showAdminTrigger?: boolean;
}

export function ReminderPriorityBanner({
  overdueCount,
  masaJanjiBayarCount,
  overdueNominal,
  variant,
  ctaHref,
  ctaLabel,
  showAdminTrigger = false,
}: ReminderPriorityBannerProps) {
  if (overdueCount === 0 && masaJanjiBayarCount === 0) {
    return null;
  }

  const isOverduePriority = overdueCount > 0;
  const resolvedCtaLabel =
    ctaLabel ??
    (variant === "petugas"
      ? "Lihat Daftar Janji Bayar"
      : isOverduePriority
        ? "Tinjau Piutang Overdue"
        : "Tinjau Masa Janji Bayar");

  const hasNominal = overdueNominal !== undefined;

  return (
    <section
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-md border p-4 shadow-xs",
        isOverduePriority
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-amber-200 bg-amber-50 text-amber-900"
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-3",
          variant === "petugas"
            ? "sm:flex-row sm:items-center sm:justify-between"
            : "lg:flex-row lg:items-center lg:justify-between"
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-white",
              isOverduePriority ? "border-red-200" : "border-amber-200"
            )}
          >
            {isOverduePriority ? (
              <AlertOctagon
                className="h-4 w-4 text-red-700"
                strokeWidth={1.75}
              />
            ) : (
              <Clock className="h-4 w-4 text-amber-700" strokeWidth={1.75} />
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <p
              className={cn(
                "text-xs font-semibold tracking-wide uppercase",
                isOverduePriority ? "text-red-800" : "text-amber-800"
              )}
            >
              {isOverduePriority
                ? "Peringatan Prioritas Tinggi — Janji Bayar Overdue"
                : "Pemantauan Aktif — Masa Janji Bayar"}
            </p>

            {isOverduePriority ? (
              <p className="text-xs leading-relaxed text-red-900">
                Terdapat{" "}
                <strong className="font-semibold tabular-nums">
                  {overdueCount.toLocaleString("id-ID")} pelanggan Overdue
                </strong>
                {hasNominal && (
                  <>
                    {" "}
                    dengan total tagihan{" "}
                    <strong className="font-semibold tabular-nums">
                      {formatRupiah(overdueNominal)}
                    </strong>
                  </>
                )}{" "}
                yang melewati batas jatuh tempo janji bayar.
                {masaJanjiBayarCount > 0 && (
                  <>
                    {" "}
                    Selain itu,{" "}
                    <strong className="font-semibold tabular-nums">
                      {masaJanjiBayarCount.toLocaleString("id-ID")} pelanggan
                    </strong>{" "}
                    sedang berada dalam Masa Janji Bayar aktif.
                  </>
                )}
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-amber-900">
                Terdapat{" "}
                <strong className="font-semibold tabular-nums">
                  {masaJanjiBayarCount.toLocaleString("id-ID")} pelanggan
                </strong>{" "}
                yang sedang memasuki rentang Masa Janji Bayar dan memerlukan
                pemantauan pelunasan sebelum tanggal jatuh tempo.
              </p>
            )}
          </div>
        </div>

        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            variant === "petugas" ? "w-full shrink-0 sm:w-auto" : "shrink-0"
          )}
        >
          {variant === "admin" && showAdminTrigger && (
            <EvaluateRemindersButton />
          )}

          <Link
            href={ctaHref}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-md px-3.5 text-xs font-semibold transition-colors",
              variant === "petugas"
                ? "min-h-11 w-full text-sm sm:w-auto sm:text-xs"
                : "h-9",
              isOverduePriority
                ? "bg-red-700 text-white hover:bg-red-800"
                : "bg-amber-700 text-white hover:bg-amber-800"
            )}
          >
            <span>{resolvedCtaLabel}</span>
            <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </section>
  );
}
