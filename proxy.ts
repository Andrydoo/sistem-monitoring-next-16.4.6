import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

type PeranPenggunaProxy = "ADMIN" | "PIMPINAN" | "PETUGAS";

function resolveRoleHomePath(peran: PeranPenggunaProxy): string {
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

const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;

  // 1. Aset statis Next.js, endpoint internal Auth.js, dan Cron Job dibebaskan dari redirect middleware
  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron")
  ) {
    return NextResponse.next();
  }

  const user = req.auth?.user;
  const isLoggedIn = Boolean(user && user.peran);

  // 2. Endpoint Evidence wajib terautentikasi dan mengembalikan JSON 401 (bukan redirect HTML)
  if (pathname.startsWith("/api/evidence")) {
    if (!isLoggedIn) {
      return NextResponse.json(
        { error: "401 Unauthorized — Sesi autentikasi diperlukan." },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 3. Halaman Login: jika sudah login, arahkan otomatis ke beranda sesuai peran
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    if (isLoggedIn && user?.peran) {
      return NextResponse.redirect(
        new URL(resolveRoleHomePath(user.peran), nextUrl)
      );
    }
    return NextResponse.next();
  }

  // 4. Root Path (/): redirect ke /login jika belum masuk, atau ke home sesuai peran jika sudah masuk
  if (pathname === "/") {
    if (!isLoggedIn || !user?.peran) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    return NextResponse.redirect(
      new URL(resolveRoleHomePath(user.peran), nextUrl)
    );
  }

  // 5. Matriks Isolasi Ketat RBAC untuk /admin/*, /pimpinan/*, dan /petugas/*
  const isAdminRoute =
    pathname === "/admin" || pathname.startsWith("/admin/");
  const isPimpinanRoute =
    pathname === "/pimpinan" || pathname.startsWith("/pimpinan/");
  const isPetugasRoute =
    pathname === "/petugas" || pathname.startsWith("/petugas/");

  if (isAdminRoute || isPimpinanRoute || isPetugasRoute) {
    if (!isLoggedIn || !user?.peran) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }

    if (isAdminRoute && user.peran !== "ADMIN") {
      return NextResponse.redirect(
        new URL(resolveRoleHomePath(user.peran), nextUrl)
      );
    }

    if (isPimpinanRoute && user.peran !== "PIMPINAN") {
      return NextResponse.redirect(
        new URL(resolveRoleHomePath(user.peran), nextUrl)
      );
    }

    if (isPetugasRoute && user.peran !== "PETUGAS") {
      return NextResponse.redirect(
        new URL(resolveRoleHomePath(user.peran), nextUrl)
      );
    }
  }

  return NextResponse.next();
});

export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
