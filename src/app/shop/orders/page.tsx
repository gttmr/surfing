import { redirect } from "next/navigation";

// 주문판은 /shop 으로 옮겼다. 예전 링크와 북마크를 위해 남겨 둔다.
export default async function ShopOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ meetingId?: string }>;
}) {
  const meetingId = Number((searchParams ? await searchParams : undefined)?.meetingId);
  redirect(Number.isInteger(meetingId) ? `/shop?meetingId=${meetingId}` : "/shop");
}
