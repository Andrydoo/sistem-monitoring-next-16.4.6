import { requireRole } from "@/lib/auth-guard";
import { PetugasShell } from "@/components/layout/petugas-shell";

export default async function PetugasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["PETUGAS"]);

  return <PetugasShell user={session.user}>{children}</PetugasShell>;
}
