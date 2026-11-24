"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { PeranPengguna } from "@prisma/client";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Pencil,
  Search,
  Shield,
  UserPlus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPenggunaAction,
  updatePenggunaAction,
} from "@/app/admin/actions";
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

  // State Dialog Tambah Pengguna
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createUsername, setCreateUsername] = React.useState("");
  const [createNama, setCreateNama] = React.useState("");
  const [createPassword, setCreatePassword] = React.useState("");
  const [createPeran, setCreatePeran] =
    React.useState<PeranPengguna>("PETUGAS");
  const [createKodeUnit, setCreateKodeUnit] = React.useState("51304");
  const [createIsActive, setCreateIsActive] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);

  // State Dialog Ubah Pengguna
  const [editTarget, setEditTarget] =
    React.useState<PenggunaAdminItem | null>(null);
  const [editNama, setEditNama] = React.useState("");
  const [editPeran, setEditPeran] = React.useState<PeranPengguna>("PETUGAS");
  const [editKodeUnit, setEditKodeUnit] = React.useState("51304");
  const [editIsActive, setEditIsActive] = React.useState(true);
  const [editPasswordBaru, setEditPasswordBaru] = React.useState("");
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

  const openCreateModal = () => {
    setCreateUsername("");
    setCreateNama("");
    setCreatePassword("");
    setCreatePeran("PETUGAS");
    setCreateKodeUnit("51304");
    setCreateIsActive(true);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await createPenggunaAction({
        username: createUsername.trim(),
        nama: createNama.trim(),
        password: createPassword,
        peran: createPeran,
        kodeUnit: createKodeUnit.trim() || "51304",
        isActive: createIsActive,
      });

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setIsCreateOpen(false);
      router.refresh();
    } catch {
      toast.error("Gagal menambahkan pengguna baru.");
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (user: PenggunaAdminItem) => {
    setEditTarget(user);
    setEditNama(user.nama);
    setEditPeran(user.peran);
    setEditKodeUnit(user.kodeUnit ?? "51304");
    setEditIsActive(user.isActive);
    setEditPasswordBaru("");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    setIsUpdating(true);
    try {
      const res = await updatePenggunaAction({
        id: editTarget.id,
        nama: editNama.trim(),
        peran: editPeran,
        kodeUnit: editKodeUnit.trim() || "51304",
        isActive: editIsActive,
        passwordBaru: editPasswordBaru.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setEditTarget(null);
      router.refresh();
    } catch {
      toast.error("Gagal memperbarui data pengguna.");
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
      {/* Toolbar Pencarian, Filter Peran, dan Tombol Tambah Pengguna */}
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

        <Button
          type="button"
          size="sm"
          onClick={openCreateModal}
          className="h-9 rounded-md bg-sky-600 px-3.5 text-xs font-semibold text-white hover:bg-sky-700"
        >
          <UserPlus className="h-4 w-4" strokeWidth={1.75} />
          <span>Tambah Pengguna</span>
        </Button>
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

      {/* Dialog Tambah Pengguna Baru */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-md border-slate-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-900">
              Tambah Akun Pengguna Baru
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Daftarkan personel baru ULP Kraksaan dengan otorisasi peran
              (RBAC) yang sesuai.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label
                htmlFor="create-username"
                className="text-xs font-semibold text-slate-700"
              >
                Username Login
              </Label>
              <Input
                id="create-username"
                type="text"
                placeholder="Contoh: ptg_03"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
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
                Nama Lengkap Personel
              </Label>
              <Input
                id="create-nama"
                type="text"
                placeholder="Contoh: Hendro Siswanto"
                value={createNama}
                onChange={(e) => setCreateNama(e.target.value)}
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
                  Peran RBAC
                </Label>
                <select
                  id="create-peran"
                  value={createPeran}
                  onChange={(e) =>
                    setCreatePeran(e.target.value as PeranPengguna)
                  }
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                >
                  <option value="PETUGAS">PETUGAS</option>
                  <option value="PIMPINAN">PIMPINAN</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="create-kode-unit"
                  className="text-xs font-semibold text-slate-700"
                >
                  Kode Unit ULP
                </Label>
                <Input
                  id="create-kode-unit"
                  type="text"
                  value={createKodeUnit}
                  onChange={(e) => setCreateKodeUnit(e.target.value)}
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
                Kata Sandi Awal (Minimal 6 Karakter)
              </Label>
              <Input
                id="create-password"
                type="password"
                placeholder="Masukkan kata sandi..."
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                required
                minLength={6}
                className="h-9 rounded-md border-slate-300 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <input
                id="create-is-active"
                type="checkbox"
                checked={createIsActive}
                onChange={(e) => setCreateIsActive(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 text-sky-600"
              />
              <Label
                htmlFor="create-is-active"
                className="cursor-pointer text-xs font-medium text-slate-800"
              >
                Aktifkan akun segera setelah dibuat
              </Label>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="h-9 rounded-md border-slate-300 text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreating}
                className="h-9 rounded-md bg-sky-600 px-4 text-xs font-semibold text-white hover:bg-sky-700"
              >
                {isCreating ? (
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

      {/* Dialog Ubah Pengguna & Reset Kata Sandi */}
      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="rounded-md border-slate-200 bg-white sm:max-w-md">
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
            <form onSubmit={handleEditSubmit} className="space-y-3.5">
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
                  onChange={(e) => setEditNama(e.target.value)}
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
                    onChange={(e) => setEditKodeUnit(e.target.value)}
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
                <Input
                  id="edit-password-baru"
                  type="password"
                  placeholder="Kosongkan jika tidak ingin mengubah kata sandi"
                  value={editPasswordBaru}
                  onChange={(e) => setEditPasswordBaru(e.target.value)}
                  className="h-9 rounded-md border-slate-300 text-xs"
                />
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
