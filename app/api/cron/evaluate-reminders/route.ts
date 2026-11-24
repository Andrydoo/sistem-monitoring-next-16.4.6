import { timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWibTodayDateOnly } from "@/lib/janji-bayar";
import { evaluateActiveReminders } from "@/lib/reminder-evaluator";

export const runtime = "nodejs";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isSecretMatch(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

function extractCronSecretFromHeaders(request: Request): string {
  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken) {
      return bearerToken;
    }
  }

  return request.headers.get("x-cron-secret")?.trim() ?? "";
}

/**
 * Endpoint Evaluasi Pengingat Janji Bayar (Cron Harian & Pemicu Manual Admin).
 *
 * Jadwal Cron Harian Rekomendasi: `0 0 * * *` (UTC = 07.00 WIB).
 * Contoh pemicu terjadwal:
 *   POST /api/cron/evaluate-reminders
 *   Header: `Authorization: Bearer <CRON_SECRET>` atau `x-cron-secret: <CRON_SECRET>`
 *
 * Opsional untuk simulasi tanggal:
 *   Query `?referenceDate=YYYY-MM-DD` atau JSON body `{ "referenceDate": "YYYY-MM-DD" }`.
 */
export async function POST(request: Request) {
  const expectedSecret = process.env.CRON_SECRET?.trim() ?? "";
  const providedSecret = extractCronSecretFromHeaders(request);
  const isCronSecretValid =
    expectedSecret.length > 0 && isSecretMatch(providedSecret, expectedSecret);

  let triggeredByUserId: number | undefined;

  if (!isCronSecretValid) {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json(
        {
          error:
            "401 Unauthorized — Token cron atau sesi Administrator aktif diperlukan.",
        },
        { status: 401 }
      );
    }

    if (session.user.peran !== "ADMIN") {
      return NextResponse.json(
        {
          error:
            "403 Forbidden — Hanya Administrator atau layanan cron terotorisasi yang diizinkan.",
        },
        { status: 403 }
      );
    }

    triggeredByUserId = session.user.id;
  }

  // Baca referenceDate opsional dari JSON body atau query param
  const url = new URL(request.url);
  const queryRefDate = url.searchParams.get("referenceDate")?.trim() || undefined;

  let bodyRefDate: string | undefined;
  try {
    const rawBody = await request.text();
    if (rawBody.trim().length > 0) {
      const parsedBody: unknown = JSON.parse(rawBody);
      if (
        parsedBody &&
        typeof parsedBody === "object" &&
        "referenceDate" in parsedBody
      ) {
        const rawValue = (parsedBody as { referenceDate?: unknown })
          .referenceDate;
        if (rawValue !== undefined && rawValue !== null) {
          if (typeof rawValue !== "string") {
            return NextResponse.json(
              {
                error:
                  "Parameter referenceDate harus berupa string berformat YYYY-MM-DD.",
              },
              { status: 400 }
            );
          }
          bodyRefDate = rawValue.trim() || undefined;
        }
      }
    }
  } catch {
    return NextResponse.json(
      { error: "Format JSON request body tidak valid." },
      { status: 400 }
    );
  }

  const rawReferenceDate = bodyRefDate ?? queryRefDate;
  let referenceDate: Date;

  if (rawReferenceDate) {
    if (!ISO_DATE_REGEX.test(rawReferenceDate)) {
      return NextResponse.json(
        {
          error:
            "Format referenceDate tidak valid. Gunakan format YYYY-MM-DD (contoh: 2026-04-06).",
        },
        { status: 400 }
      );
    }

    const parsedDate = new Date(`${rawReferenceDate}T00:00:00.000Z`);
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== rawReferenceDate
    ) {
      return NextResponse.json(
        { error: "Nilai tanggal referenceDate tidak valid pada kalender." },
        { status: 400 }
      );
    }

    referenceDate = parsedDate;
  } else {
    referenceDate = getWibTodayDateOnly();
  }

  try {
    const result = await evaluateActiveReminders({
      referenceDate,
      triggeredByUserId,
      source: isCronSecretValid ? "CRON" : "ADMIN_MANUAL",
    });

    revalidatePath("/petugas");
    revalidatePath("/petugas/pengingat");
    revalidatePath("/admin");
    revalidatePath("/admin/piutang");
    revalidatePath("/pimpinan");
    revalidatePath("/pimpinan/piutang");

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[CronEvaluateReminders] Gagal mengevaluasi pengingat:", error);
    return NextResponse.json(
      {
        error:
          "Terjadi kesalahan server saat mengevaluasi jadwal pengingat janji bayar.",
      },
      { status: 500 }
    );
  }
}
