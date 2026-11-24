import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRoleHomePath } from "@/lib/auth-guard";

export default async function RootPage() {
  const session = await auth();

  if (!session?.user?.peran) {
    redirect("/login");
  }

  redirect(getRoleHomePath(session.user.peran));
}
