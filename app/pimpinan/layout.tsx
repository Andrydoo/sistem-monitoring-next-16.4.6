import { requireRole } from "@/lib/auth-guard";
import { CorporateShell } from "@/components/layout/corporate-shell";

export default async function PimpinanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["PIMPINAN"]);

  return <CorporateShell user={session.user}>{children}</CorporateShell>;
}
