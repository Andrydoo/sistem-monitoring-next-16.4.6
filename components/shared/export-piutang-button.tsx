"use client";

import * as React from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ExportPiutangButtonProps {
  periode?: string;
  petugas?: string;
  status?: string;
  q?: string;
  label?: string;
  variant?: "primary" | "outline";
  className?: string;
}

function extractFilenameFromDisposition(
  headerValue: string | null,
  fallback: string
): string {
  if (!headerValue) {
    return fallback;
  }

  const quotedMatch = /filename="([^"]+)"/i.exec(headerValue);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const plainMatch = /filename=([^;]+)/i.exec(headerValue);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return fallback;
}

export function ExportPiutangButton({
  periode,
  petugas,
  status,
  q,
  label = "Ekspor Excel (21 Kolom)",
  variant = "primary",
  className,
}: ExportPiutangButtonProps) {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const params = new URLSearchParams();
      if (periode && periode.trim() && periode.toUpperCase() !== "ALL") {
        params.set("periode", periode.trim());
      }
      if (petugas && petugas.trim() && petugas.toUpperCase() !== "ALL") {
        params.set("petugas", petugas.trim());
      }
      if (status && status.trim() && status.toUpperCase() !== "ALL") {
        params.set("status", status.trim());
      }
      if (q && q.trim()) {
        params.set("q", q.trim());
      }

      const queryString = params.toString();
      const endpoint = queryString
        ? `/api/monitoring/export/piutang?${queryString}`
        : "/api/monitoring/export/piutang";

      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        let errorMessage =
          "Gagal mengekspor laporan detail piutang ke format Excel.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) {
            errorMessage = payload.error;
          }
        } catch {
          // Gunakan pesan bawaan apabila body bukan JSON
        }
        toast.error(errorMessage);
        return;
      }

      const blob = await response.blob();
      const periodeLabel =
        periode && periode.trim() && periode.toUpperCase() !== "ALL"
          ? periode.trim()
          : "SEMUA";
      const fallbackFilename = `Laporan_Detail_Piutang_ULP_Kraksaan_${periodeLabel}.xlsx`;
      const filename = extractFilenameFromDisposition(
        response.headers.get("Content-Disposition"),
        fallbackFilename
      );

      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);

      toast.success("Laporan Excel 21 Kolom berhasil diunduh", {
        description: filename,
      });
    } catch {
      toast.error(
        "Terjadi kesalahan jaringan saat mengunduh laporan Excel piutang."
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant === "outline" ? "outline" : "default"}
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className={cn(
        "h-9 rounded-md px-3 text-xs font-semibold",
        variant === "primary"
          ? "bg-emerald-700 text-white hover:bg-emerald-800"
          : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        className
      )}
    >
      {isExporting ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
          <span>Menyiapkan Excel...</span>
        </>
      ) : (
        <>
          <FileSpreadsheet
            className={cn(
              "h-3.5 w-3.5",
              variant === "outline" ? "text-emerald-700" : "text-white"
            )}
            strokeWidth={1.75}
          />
          <span>{label}</span>
          <Download
            className={cn(
              "h-3.5 w-3.5",
              variant === "outline" ? "text-slate-500" : "text-emerald-100"
            )}
            strokeWidth={1.75}
          />
        </>
      )}
    </Button>
  );
}
