import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth-guard";
import {
  EvidencePathError,
  EvidenceValidationError,
  readPrivateEvidenceFile,
} from "@/lib/evidence-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireApiRole(["ADMIN", "PIMPINAN", "PETUGAS"]);
  if (authCheck.response) {
    return authCheck.response;
  }

  const { session } = authCheck;
  const { id } = await context.params;

  if (!/^\d+$/.test(id.trim())) {
    return NextResponse.json(
      { error: "ID Evidence tidak valid." },
      { status: 400 }
    );
  }

  const evidenceId = Number.parseInt(id, 10);
  if (!Number.isSafeInteger(evidenceId) || evidenceId <= 0) {
    return NextResponse.json(
      { error: "ID Evidence tidak valid." },
      { status: 400 }
    );
  }

  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      penagihan: {
        select: {
          idPetugas: true,
          piutang: {
            select: {
              idPetugas: true,
            },
          },
        },
      },
    },
  });

  if (!evidence) {
    return NextResponse.json(
      { error: "Data evidence tidak ditemukan." },
      { status: 404 }
    );
  }

  // Isolasi RBAC: Petugas hanya boleh membaca evidence milik piutang yang ditugaskan kepadanya
  if (
    session.user.peran === "PETUGAS" &&
    evidence.penagihan.piutang.idPetugas !== session.user.id
  ) {
    return NextResponse.json(
      { error: "Akses ditolak. Evidence milik petugas lain." },
      { status: 403 }
    );
  }

  try {
    const fileData = await readPrivateEvidenceFile(evidence.filePath);

    return new NextResponse(new Uint8Array(fileData.buffer), {
      status: 200,
      headers: {
        "Content-Type": fileData.mimeType,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="${fileData.fileName}"`,
      },
    });
  } catch (error) {
    const fsErr = error as NodeJS.ErrnoException;
    if (fsErr.code === "ENOENT") {
      return NextResponse.json(
        { error: "Berkas foto evidence tidak ditemukan di penyimpanan privat." },
        { status: 404 }
      );
    }

    if (
      error instanceof EvidencePathError ||
      error instanceof EvidenceValidationError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[EvidenceGET] Gagal membaca berkas evidence:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat membaca berkas foto evidence." },
      { status: 500 }
    );
  }
}
