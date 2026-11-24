import type { NextAuthConfig, Session } from "next-auth";

type PeranPenggunaAuth = "ADMIN" | "PIMPINAN" | "PETUGAS";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12, // 12 jam shift kerja operasional
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const numericId =
          typeof user.id === "number" ? user.id : Number(user.id);
        token.id = numericId;
        token.username = user.username ?? "";
        token.nama = user.nama ?? user.name ?? "";
        token.peran = (user.peran ?? "PETUGAS") as PeranPenggunaAuth;
        token.kodeUnit = user.kodeUnit ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        const sessionUser = session.user as Session["user"];
        sessionUser.id =
          typeof token.id === "number" ? token.id : Number(token.id ?? 0);
        sessionUser.username =
          typeof token.username === "string" ? token.username : "";
        sessionUser.nama =
          typeof token.nama === "string" ? token.nama : "";
        sessionUser.peran = (token.peran ?? "PETUGAS") as PeranPenggunaAuth;
        sessionUser.kodeUnit =
          typeof token.kodeUnit === "string" ? token.kodeUnit : null;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
