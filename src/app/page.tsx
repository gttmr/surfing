import SchedulePageContent from "@/components/schedule/SchedulePageContent";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;

  return <SchedulePageContent initialSelectedDate={date ?? null} />;
}
