"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EvaluateRemindersButtonProps {
  label?: string;
  className?: string;
}

interface EvaluateRemindersApiResponse {
  evaluatedAtWib: string;
  referenceDate: string;
  totalChecked: number;
  updatedCount: number;
  transitionedToMasaJanjiBayar: number;
  transitionedToOverdue: number;
  resolvedCount: number;
  activeMasaJanjiBayarTotal: number;
  activeOverdueTotal: number;
  error?: string;
}

export function EvaluateRemindersButton({
  label = "Sinkronkan Jadwal Janji Bayar",
  className,
}: EvaluateRemindersButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleEvaluate = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const response = await fetch("/api/cron/evaluate-reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = (await response.json()) as EvaluateRemindersApiResponse;

      if (!response.ok) {
        toast.error(
          data.error ?? "Gagal menyinkronkan jadwal pengingat janji bayar."
        );
        return;
      }

      toast.success("Sinkronisasi jadwal janji bayar selesai", {
        description: `Acuan ${data.referenceDate}: ${data.totalChecked.toLocaleString("id-ID")} diperiksa, ${data.updatedCount.toLocaleString("id-ID")} diperbarui (${data.transitionedToOverdue.toLocaleString("id-ID")} overdue, ${data.transitionedToMasaJanjiBayar.toLocaleString("id-ID")} masa janji bayar), ${data.resolvedCount.toLocaleString("id-ID")} selesai.`,
      });

      router.refresh();
    } catch {
      toast.error(
        "Terjadi kesalahan jaringan saat menyinkronkan jadwal janji bayar."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleEvaluate}
      disabled={isLoading}
      className={cn(
        "h-9 rounded-md border-sky-600 bg-white px-3 text-xs font-semibold text-sky-700 hover:bg-sky-50 hover:text-sky-800",
        className
      )}
    >
      <RefreshCw
        className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
        strokeWidth={1.75}
      />
      <span>{isLoading ? "Menyinkronkan..." : label}</span>
    </Button>
  );
}
