"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  User,
} from "lucide-react";
import { loginAction } from "@/lib/auth-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      setErrorMessage("Username wajib diisi minimal 3 karakter.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Kata sandi wajib diisi minimal 6 karakter.");
      return;
    }

    const formData = new FormData();
    formData.set("username", trimmedUsername);
    formData.set("password", password);

    startTransition(async () => {
      try {
        const result = await loginAction(undefined, formData);
        if (result.error) {
          setErrorMessage(result.error);
          return;
        }

        if (result.success) {
          router.push(result.redirectTo ?? "/");
          router.refresh();
        }
      } catch {
        setErrorMessage(
          "Terjadi gangguan komunikasi server. Silakan coba kembali."
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {errorMessage && (
        <Alert
          variant="destructive"
          className="rounded-md border-red-200 bg-red-50 text-red-800"
        >
          <AlertCircle
            className="h-4 w-4 text-red-700"
            strokeWidth={1.75}
          />
          <AlertTitle className="text-xs font-semibold tracking-wide text-red-800 uppercase">
            Autentikasi Ditolak
          </AlertTitle>
          <AlertDescription className="text-xs text-red-700">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label
          htmlFor="username"
          className="text-xs font-semibold tracking-wide text-slate-700 uppercase"
        >
          Username Pegawai / Petugas
        </Label>
        <div className="relative">
          <User
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={1.75}
          />
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="Masukkan username (contoh: admin_kraksaan)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isPending}
            required
            className="h-11 rounded-md border-slate-300 bg-white pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-sky-600 focus-visible:ring-sky-600/20"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="password"
          className="text-xs font-semibold tracking-wide text-slate-700 uppercase"
        >
          Kata Sandi
        </Label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={1.75}
          />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Masukkan kata sandi akun"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
            required
            className="h-11 rounded-md border-slate-300 bg-white pr-11 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-sky-600 focus-visible:ring-sky-600/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            disabled={isPending}
            aria-label={
              showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
            }
            className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Eye className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="min-h-11 w-full rounded-md bg-sky-600 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-sky-700"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            <span>Memverifikasi Kredensial...</span>
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" strokeWidth={1.75} />
            <span>Masuk ke Sistem Monitoring</span>
          </>
        )}
      </Button>
    </form>
  );
}
