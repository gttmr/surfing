import { redirect } from "next/navigation";
import { canAccessShopPortal, getCurrentUserRole } from "@/lib/auth";
import { getSessionPayload } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ShopRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionPayload();

  if (!session?.kakaoId) {
    redirect("/api/auth/kakao?returnTo=/shop");
  }

  if (!(await canAccessShopPortal())) {
    const role = await getCurrentUserRole();
    redirect(role === "ADMIN" ? "/admin" : "/");
  }

  return children;
}
