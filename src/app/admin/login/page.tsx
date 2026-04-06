import { redirect } from "next/navigation";
import { AdminLoginPageClient } from "@/components/admin/AdminLoginPageClient";
import { getActiveSession } from "@/lib/active-session";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  const session = await getActiveSession();
  let shouldAutoLogin = false;

  if (session) {
    const user = await prisma.user.findUnique({
      where: { kakaoId: session.kakaoId },
      select: { role: true },
    });

    shouldAutoLogin = user?.role === "ADMIN";
  }

  return <AdminLoginPageClient shouldAutoLogin={shouldAutoLogin} />;
}
