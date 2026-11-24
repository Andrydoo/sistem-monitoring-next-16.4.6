import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-guard";
import { getPiutangDetailById } from "@/lib/dashboard-queries";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireApiRole(["ADMIN", "PIMPINAN"]);
  if (authCheck.response) {
    return authCheck.response;
  }

  const { id } = await context.params;

  if (!/^\d+$/.test(id.trim())) {
    return NextResponse.json(
      { error: "ID Piutang tidak valid." },
      { status: 400 }
    );
  }

  const piutangId = Number.parseInt(id, 10);
  if (!Number.isSafeInteger(piutangId) || piutangId <= 0) {
    return NextResponse.json(
      { error: "ID Piutang tidak valid." },
      { status: 400 }
    );
  }

  try {
    const detail = await getPiutangDetailById(piutangId);

    if (!detail) {
      return NextResponse.json(
        { error: "Rekaman piutang tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { data: detail },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[MonitoringPiutangDetailGET] Gagal memuat detail:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengambil detail piutang." },
      { status: 500 }
    );
  }
}
