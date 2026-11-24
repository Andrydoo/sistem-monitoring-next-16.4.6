import type { PeranPengguna } from "@prisma/client";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Mengembalikan jalur halaman beranda utama berdasarkan peran pengguna.
 */
export function getRoleHomePath(peran: PeranPengguna): string {
  switch (peran) {
    case "ADMIN":
      return "/admin";
    case "PIMPINAN":
      return "/pimpinan";
    case "PETUGAS":
      return "/petugas";
    default:
      return "/login";
  }
}

/**
 * Memastikan sesi aktif tersedia pada Server Component / Server Action.
 * Mengarahkan ke `/login` apabila pengguna belum terautentikasi.
 */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Memastikan sesi aktif memiliki salah satu dari peran yang diizinkan.
 * Jika peran tidak sesuai, mengarahkan ke halaman utama peran pengguna tersebut.
 */
export async function requireRole(
  allowedRoles: PeranPengguna[]
): Promise<Session> {
  const session = await requireSession();
  if (!allowedRoles.includes(session.user.peran)) {
    redirect(getRoleHomePath(session.user.peran));
  }
  return session;
}

/**
 * Memverifikasi sesi dan peran khusus untuk Route Handler API (`app/api/*`).
 * Mengembalikan objek `{ session }` jika valid, atau `NextResponse` JSON 401/403 jika ditolak.
 */
export async function requireApiRole(
  allowedRoles: PeranPengguna[]
): Promise<{ session: Session; response?: never } | { session?: never; response: NextResponse }> {
  const session = await auth();
  if (!session || !session.user) {
    return {
      response: NextResponse.json(
        { error: "Sesi tidak ditemukan. Silakan masuk terlebih dahulu." },
        { status: 401 }
      ),
    };
  }

  if (!allowedRoles.includes(session.user.peran)) {
    return {
      response: NextResponse.json(
        { error: "Akses ditolak. Peran Anda tidak memiliki izin untuk operasi ini." },
        { status: 403 }
      ),
    };
  }

  return { session };
}
