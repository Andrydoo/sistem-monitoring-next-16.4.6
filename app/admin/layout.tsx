import { requireRole } from "@/lib/auth-guard";
import { CorporateShell } from "@/components/layout/corporate-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["ADMIN"]);

  return <CorporateShell user={session.user}>{children}</CorporateShell>;
}
