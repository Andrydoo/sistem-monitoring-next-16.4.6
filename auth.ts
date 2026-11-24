import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

const loginCredentialsSchema = z.object({
  username: z.string().trim().min(3, "Username minimal 3 karakter."),
  password: z.string().min(6, "Kata sandi minimal 6 karakter."),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Kredensial Korporat PLN",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Kata Sandi", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginCredentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { username, password } = parsed.data;

        const user = await prisma.pengguna.findUnique({
          where: { username },
        });

        if (!user || user.isActive === false) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          password,
          user.passwordHash
        );
        if (!isPasswordValid) {
          return null;
        }

        await createAuditLog({
          idPengguna: user.id,
          entitas: "AUTH",
          idRekaman: String(user.id),
          aksi: "LOGIN",
          nilaiBaru: {
            username: user.username,
            peran: user.peran,
          },
        });

        return {
          id: user.id as unknown as string & number,
          username: user.username,
          nama: user.nama,
          name: user.nama,
          peran: user.peran,
          kodeUnit: user.kodeUnit,
        };
      },
    }),
  ],
});
