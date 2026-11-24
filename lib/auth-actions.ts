"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { auth, signIn, signOut } from "@/auth";
import { createAuditLog } from "@/lib/audit";
import { getRoleHomePath } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface LoginActionState {
  error?: string;
  success?: boolean;
  redirectTo?: string;
}

const loginFormSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username wajib diisi (minimal 3 karakter)."),
  password: z
    .string()
    .min(6, "Kata sandi wajib diisi (minimal 6 karakter)."),
});

/**
 * Server Action untuk autentikasi pengguna menggunakan Credentials Provider.
 */
export async function loginAction(
  _prevState: LoginActionState | undefined,
  formData: FormData
): Promise<LoginActionState> {
  const rawUsername = formData.get("username");
  const rawPassword = formData.get("password");

  const parsed = loginFormSchema.safeParse({
    username: typeof rawUsername === "string" ? rawUsername : "",
    password: typeof rawPassword === "string" ? rawPassword : "",
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      error: firstIssue?.message ?? "Username atau kata sandi tidak valid.",
    };
  }

  const { username, password } = parsed.data;

  try {
    await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    const user = await prisma.pengguna.findUnique({
      where: { username },
      select: { peran: true },
    });

    const redirectTo = user ? getRoleHomePath(user.peran) : "/";

    return {
      success: true,
      redirectTo,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "Username atau kata sandi tidak valid.",
      };
    }
    throw error;
  }
}

/**
 * Server Action untuk keluar dari sesi aktif dan mencatat aktivitas LOGOUT ke AuditLog.
 */
export async function logoutAction(): Promise<void> {
  const session = await auth();

  if (session?.user?.id) {
    await createAuditLog({
      idPengguna: session.user.id,
      entitas: "AUTH",
      idRekaman: String(session.user.id),
      aksi: "LOGOUT",
      nilaiLama: {
        username: session.user.username,
        peran: session.user.peran,
      },
    });
  }

  await signOut({ redirectTo: "/login" });
}
