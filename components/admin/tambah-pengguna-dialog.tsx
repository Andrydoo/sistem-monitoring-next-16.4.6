"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { PeranPengguna } from "@prisma/client";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { createPenggunaAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const USERNAME_REGEX = /^[a-zA-Z0-9_.-]+$/;

export function TambahPenggunaDialog() {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [nama, setNama] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [peran, setPeran] = React.useState<PeranPengguna>("PETUGAS");
  const [kodeUnit, setKodeUnit] = React.useState("51304");
  const [isActive, setIsActive] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const resetForm = React.useCallback(() => {
    setUsername("");
    setNama("");
    setPassword("");
    setShowPassword(false);
    setPeran("PETUGAS");
    setKodeUnit("51304");
    setIsActive(true);
    setFormError(null);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    } else {
      setFormError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedUsername = username.trim();
    const trimmedNama = nama.trim();
    const trimmedKodeUnit = kodeUnit.trim();

    if (trimmedUsername.length < 3 || trimmedUsername.length > 50) {
      setFormError("Username wajib diisi antara 3 hingga 50 karakter.");
      return;
    }

    if (!USERNAME_REGEX.test(trimmedUsername)) {
      setFormError(
        "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip tanpa spasi."
      );
      return;
    }

    if (trimmedNama.length < 2 || trimmedNama.length > 150) {
      setFormError("Nama lengkap personel wajib diisi minimal 2 karakter.");
      return;
    }

    if (password.length < 6 || password.length > 100) {
      setFormError("Kata sandi awal wajib minimal 6 karakter.");
      return;
    }

    if (trimmedKodeUnit.length > 10) {
      setFormError("Kode Unit maksimal 10 karakter.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createPenggunaAction({
        username: trimmedUsername,
        nama: trimmedNama,
        password,
        peran,
        kodeUnit: trimmedKodeUnit || "51304",
        isActive,
      });

      if (!res.success) {
        setFormError(res.message);
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setOpen(false);
      resetForm();
      router.refresh();
    } catch {
      const msg = "Terjadi kesalahan jaringan saat menambahkan pengguna baru.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          className="h-9 rounded-md bg-sky-600 px-3.5 text-xs font-semibold text-white hover:bg-sky-700"
        >
          <UserPlus className="h-4 w-4" strokeWidth={1.75} />
          <span>Tambah Pengguna</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-md border-slate-200 bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-slate-900">
            Tambah Akun Pengguna Baru
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600">
            Daftarkan personel baru PT PLN (Persero) ULP Kraksaan dengan
            otorisasi peran (RBAC) yang sesuai.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                strokeWidth={1.75}
              />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="create-username"
              className="text-xs font-semibold text-slate-700"
            >
              Username Login <span className="text-red-600">*</span>
            </Label>
            <Input
              id="create-username"
              type="text"
              placeholder="Contoh: ptg_03"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (formError) setFormError(null);
              }}
              required
              minLength={3}
              maxLength={50}
              className="h-9 rounded-md border-slate-300 font-mono text-xs tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="create-nama"
              className="text-xs font-semibold text-slate-700"
            >
              Nama Lengkap Personel <span className="text-red-600">*</span>
            </Label>
            <Input
              id="create-nama"
              type="text"
              placeholder="Contoh: Hendro Siswanto"
              value={nama}
              onChange={(e) => {
                setNama(e.target.value);
                if (formError) setFormError(null);
              }}
              required
              minLength={2}
              maxLength={150}
              className="h-9 rounded-md border-slate-300 text-xs"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="create-peran"
                className="text-xs font-semibold text-slate-700"
              >
                Peran RBAC <span className="text-red-600">*</span>
              </Label>
              <Select
                value={peran}
                onValueChange={(value) => {
                  setPeran(value as PeranPengguna);
                  if (formError) setFormError(null);
                }}
              >
                <SelectTrigger
                  id="create-peran"
                  className="h-9 w-full rounded-md border-slate-300 bg-white text-xs text-slate-900"
                >
                  <SelectValue placeholder="Pilih Peran" />
                </SelectTrigger>
                <SelectContent className="rounded-md border-slate-200 bg-white">
                  <SelectItem value="PETUGAS" className="text-xs">
                    PETUGAS
                  </SelectItem>
                  <SelectItem value="PIMPINAN" className="text-xs">
                    PIMPINAN
                  </SelectItem>
                  <SelectItem value="ADMIN" className="text-xs">
                    ADMIN
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="create-kode-unit"
                className="text-xs font-semibold text-slate-700"
              >
                Kode Unit ULP <span className="text-red-600">*</span>
              </Label>
              <Input
                id="create-kode-unit"
                type="text"
                placeholder="51304"
                value={kodeUnit}
                onChange={(e) => {
                  setKodeUnit(e.target.value);
                  if (formError) setFormError(null);
                }}
                maxLength={10}
                required
                className="h-9 rounded-md border-slate-300 font-mono text-xs tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="create-password"
              className="text-xs font-semibold text-slate-700"
            >
              Kata Sandi Awal (Minimal 6 Karakter){" "}
              <span className="text-red-600">*</span>
            </Label>
            <div className="relative">
              <Input
                id="create-password"
                type={showPassword ? "text" : "password"}
                placeholder="Masukkan kata sandi..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (formError) setFormError(null);
                }}
                required
                minLength={6}
                maxLength={100}
                className="h-9 rounded-md border-slate-300 pr-9 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword
                    ? "Sembunyikan kata sandi"
                    : "Lihat kata sandi"
                }
                className="absolute top-0 right-0 flex h-9 w-9 items-center justify-center text-slate-500 hover:text-slate-800"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <input
              id="create-is-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600"
            />
            <Label
              htmlFor="create-is-active"
              className="cursor-pointer text-xs font-medium text-slate-800"
            >
              Aktifkan akun segera setelah dibuat
            </Label>
          </div>

          <DialogFooter className="gap-2 border-t border-slate-200 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="h-9 rounded-md border-slate-300 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-9 rounded-md bg-sky-600 px-4 text-xs font-semibold text-white hover:bg-sky-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    className="h-3.5 w-3.5 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>Simpan Pengguna</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
