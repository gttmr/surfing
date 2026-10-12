import { redirect } from "next/navigation";
import SchedulePageContent from "@/components/schedule/SchedulePageContent";
import { getCurrentUserRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const { date, view } = await searchParams;

  // 샵 계정은 앱을 열면 바로 주문판으로 간다. 회원 화면은 내 정보의 화면 전환(?view=member)으로 본다.
  if (!date && view !== "member" && (await getCurrentUserRole()) === "SHOP_OWNER") {
    redirect("/shop");
  }

  return <SchedulePageContent initialSelectedDate={date ?? null} />;
}
