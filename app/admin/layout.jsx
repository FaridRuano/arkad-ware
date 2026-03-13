import { auth } from "@auth";
import { redirect } from "next/navigation";
import AdminShell from "@public/components/admin/AdminShell";

export default async function ClientLayout({ children }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  if (session.user.role !== "admin") {
    redirect("/client");
  }

  return <AdminShell>{children}</AdminShell>;
}