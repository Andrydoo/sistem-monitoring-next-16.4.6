"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { PeranPengguna } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Search,
  Shield,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { updatePenggunaAction } from "@/app/admin/actions";
import { formatRupiah, formatTanggalWib } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PenggunaAdminItem {
  id: number;
  username: string;
  nama: string;
  peran: PeranPengguna;
  kodeUnit: string | null;
  isActive: boolean;
  updatedAt: string;
  bebanPiutangAktifCount: number;
  bebanPiutangAktifNominal: string;
}

export interface AdminPenggunaClientProps {
  users: PenggunaAdminItem[];
  currentAdminId: number;
}

export function AdminPenggunaClient({
  users,
  currentAdminId,
}: AdminPenggunaClientProps) {
  const router = useRouter();

  // Filter lokal cepat
  const [searchQuery, setSearchQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("ALL");

  // State Dialog Ubah Pengguna
  const [editTarget, setEditTarget] =
    React.useState<PenggunaAdminItem | null>(null);
  const [editNama, setEditNama] = React.useState("");
  const [editPeran, setEditPeran] = React.useState<PeranPengguna>("PETUGAS");
  const [editKodeUnit, setEditKodeUnit] = React.useState("51304");
  const [editIsActive, setEditIsActive] = React.useState(true);
  const [editPasswordBaru, setEditPasswordBaru] = React.useState("");
  const [showEditPassword, setShowEditPassword] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);

  const filteredUsers = React.useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.peran !== roleFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          u.username.toLowerCase().includes(q) ||
          u.nama.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, roleFilter, searchQuery]);

  const openEditModal = (user: PenggunaAdminItem) => {
    setEditTarget(user);
    setEditNama(user.nama);
    setEditPeran(user.peran);
    setEditKodeUnit(user.kodeUnit ?? "51304");
    setEditIsActive(user.isActive);
    setEditPasswordBaru("");
    setShowEditPassword(false);
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);

    const trimmedNama = editNama.trim();
    const trimmedKodeUnit = editKodeUnit.trim();
    const trimmedPassword = editPasswordBaru.trim();

    if (trimmedNama.length < 2 || trimmedNama.length > 150) {
      setEditError("Nama lengkap personel wajib diisi minimal 2 karakter.");
      return;
    }

    if (trimmedKodeUnit.length > 10) {
      setEditError("Kode Unit maksimal 10 karakter.");
      return;
    }

    if (trimmedPassword.length > 0 && trimmedPassword.length < 6) {
      setEditError("Kata sandi baru minimal harus 6 karakter.");
      return;
    }

    setIsUpdating(true);
    try {
      const res = await updatePenggunaAction({
        id: editTarget.id,
        nama: trimmedNama,
        peran: editPeran,
        kodeUnit: trimmedKodeUnit || "51304",
        isActive: editIsActive,
        passwordBaru: trimmedPassword || undefined,
      });

      if (!res.success) {
        setEditError(res.message);
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setEditTarget(null);
      router.refresh();
    } catch {
      const msg = "Gagal memperbarui data pengguna.";
      setEditError(msg);
      toast.error(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const renderRoleBadge = (peran: PeranPengguna) => {
    switch (peran) {
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
            <Shield className="h-3 w-3" strokeWidth={1.75} />
            <span>ADMIN</span>
          </span>
        );
      case "PIMPINAN":
        return (
          <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            PIMPINAN
          </span>
        );
      case "PETUGAS":
        return (
          <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
            PETUGAS
          </span>
        );
    }
  };

  const isEditingSelf = Boolean(
    editTarget && editTarget.id === currentAdminId
  );

  return (
    <div className="space-y-4">
      {/* Toolbar Pencarian & Filter Peran */}
      <div className="flex flex-col justify-between gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search
              className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400"
              strokeWidth={1.75}
            />
            <Input
              type="text"
              placeholder="Cari username atau nama personel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 rounded-md border-slate-300 pl-9 text-xs"
            />
          </div>

          <select
            aria-label="Filter Peran Pengguna"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:border-sky-600 focus:outline-none"
          >
            <option value="ALL">Semua Peran RBAC</option>
            <option value="ADMIN">ADMIN (Administrator Unit)</option>
            <option value="PIMPINAN">PIMPINAN (Eksekutif Read-Only)</option>
            <option value="PETUGAS">PETUGAS (Petugas Lapangan)</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 tabular-nums">
          Menampilkan{" "}
          <strong className="font-semibold text-slate-900">
            {filteredUsers.length}
          </strong>{" "}
          dari{" "}
          <strong className="font-semibold text-slate-900">
            {users.length}
          </strong>{" "}
          pengguna
        </span>
      </div>

      {/* Tabel Daftar Pengguna & Beban Piutang */}
      <div className="rounded-md border border-slate-200 bg-white shadow-xs">
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Nama Lengkap</th>
                <th className="px-4 py-3">Peran RBAC</th>
                <th className="px-4 py-3">Kode Unit</th>
                <th className="px-4 py-3">Status Akun</th>
                <th className="px-4 py-3 text-right">Beban Piutang Aktif</th>
                <th className="px-4 py-3 text-right">Total Saldo Ditangani</th>
                <th className="px-4 py-3">Pembaruan Terakhir</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-xs text-slate-500"
                  >
                    Tidak ada akun pengguna yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isSelf = user.id === currentAdminId;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900 tabular-nums">
                        @{user.username}
                        {isSelf && (
                          <span className="ml-2 rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-sky-700">
                            Anda
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {user.nama}
                      </td>
                      <td className="px-4 py-3">
                        {renderRoleBadge(user.peran)}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 tabular-nums">
                        {user.kodeUnit ?? "51304"}
                      </td>
                      <td className="px-4 py-3">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                            />
                            <span>Aktif</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                            <XCircle
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                            />
                            <span>Nonaktif</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800 tabular-nums">
                        {user.peran === "PETUGAS" ? (
                          <span>
                            {user.bebanPiutangAktifCount.toLocaleString(
                              "id-ID"
                            )}{" "}
                            Pelanggan
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">
                        {user.peran === "PETUGAS" ? (
                          formatRupiah(user.bebanPiutangAktifNominal)
                        ) : (
                          <span className="font-normal text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 tabular-nums">
                        {formatTanggalWib(user.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(user)}
                          className="h-8 rounded-md border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                        >
                          <Pencil
                            className="h-3.5 w-3.5 text-sky-600"
                            strokeWidth={1.75}
                          />
                          <span>Ubah</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog Ubah Pengguna & Reset Kata Sandi */}
      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
            setEditError(null);
            setShowEditPassword(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-md border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-900">
              Ubah Data Pengguna & Hak Akses
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Perbarui profil personel, status aktif, atau atur ulang kata sandi
              akun.
            </DialogDescription>
          </DialogHeader>

          {editTarget && (
            <form onSubmit={handleEditSubmit} noValidate className="space-y-3.5">
              {editError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
                >
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                    strokeWidth={1.75}
                  />
                  <span>{editError}</span>
                </div>
              )}

              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <span className="text-slate-500">Username: </span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  @{editTarget.username}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-nama"
                  className="text-xs font-semibold text-slate-700"
                >
                  Nama Lengkap Personel
                </Label>
                <Input
                  id="edit-nama"
                  type="text"
                  value={editNama}
                  onChange={(e) => {
                    setEditNama(e.target.value);
                    if (editError) setEditError(null);
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
                    htmlFor="edit-peran"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Peran RBAC
                  </Label>
                  <select
                    id="edit-peran"
                    value={editPeran}
                    disabled={isEditingSelf}
                    onChange={(e) =>
                      setEditPeran(e.target.value as PeranPengguna)
                    }
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-sky-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="PETUGAS">PETUGAS</option>
                    <option value="PIMPINAN">PIMPINAN</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-kode-unit"
                    className="text-xs font-semibold text-slate-700"
                  >
                    Kode Unit ULP
                  </Label>
                  <Input
                    id="edit-kode-unit"
                    type="text"
                    value={editKodeUnit}
                    onChange={(e) => {
                      setEditKodeUnit(e.target.value);
                      if (editError) setEditError(null);
                    }}
                    maxLength={10}
                    required
                    className="h-9 rounded-md border-slate-300 font-mono text-xs tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-password-baru"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                >
                  <KeyRound
                    className="h-3.5 w-3.5 text-slate-500"
                    strokeWidth={1.75}
                  />
                  <span>Reset Kata Sandi (Opsional)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="edit-password-baru"
                    type={showEditPassword ? "text" : "password"}
                    placeholder="Kosongkan jika tidak ingin mengubah kata sandi"
                    value={editPasswordBaru}
                    onChange={(e) => {
                      setEditPasswordBaru(e.target.value);
                      if (editError) setEditError(null);
                    }}
                    className="h-9 rounded-md border-slate-300 pr-9 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((prev) => !prev)}
                    aria-label={
                      showEditPassword
                        ? "Sembunyikan kata sandi baru"
                        : "Lihat kata sandi baru"
                    }
                    className="absolute top-0 right-0 flex h-9 w-9 items-center justify-center text-slate-500 hover:text-slate-800"
                  >
                    {showEditPassword ? (
                      <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                    ) : (
                      <Eye className="h-4 w-4" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <input
                    id="edit-is-active"
                    type="checkbox"
                    checked={editIsActive}
                    disabled={isEditingSelf}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600 disabled:cursor-not-allowed"
                  />
                  <Label
                    htmlFor="edit-is-active"
                    className="cursor-pointer text-xs font-medium text-slate-800"
                  >
                    Status Akun Aktif (Diizinkan Login)
                  </Label>
                </div>
                {isEditingSelf && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Akun Administrator yang sedang Anda gunakan tidak dapat
                    dinonaktifkan atau diturunkan perannya.
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditTarget(null)}
                  className="h-9 rounded-md border-slate-300 text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUpdating}
                  className="h-9 rounded-md bg-sky-600 px-4 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  {isUpdating ? (
                    <>
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        strokeWidth={1.75}
                      />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Perubahan</span>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
