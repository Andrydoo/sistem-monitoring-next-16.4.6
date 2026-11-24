import type { PeranPengguna } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: number;
    username: string;
    nama: string;
    peran: PeranPengguna;
    kodeUnit: string | null;
  }

  interface Session {
    user: {
      id: number;
      username: string;
      nama: string;
      peran: PeranPengguna;
      kodeUnit: string | null;
    } & Omit<NonNullable<DefaultSession["user"]>, "id">;
  }
}

declare module "@auth/core/types" {
  interface User {
    username?: string;
    nama?: string;
    peran?: PeranPengguna;
    kodeUnit?: string | null;
  }

  interface Session {
    user: {
      id: number;
      username: string;
      nama: string;
      peran: PeranPengguna;
      kodeUnit: string | null;
    } & Omit<NonNullable<DefaultSession["user"]>, "id">;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: number;
    username: string;
    nama: string;
    peran: PeranPengguna;
    kodeUnit: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: number;
    username?: string;
    nama?: string;
    peran?: PeranPengguna;
    kodeUnit?: string | null;
  }
}
