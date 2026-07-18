import { ShopLayout } from "@/components/shop/ShopLayout";
import { AsyncState } from "@/components/ui/AsyncState";

export default function NotFound() {
  return <ShopLayout><AsyncState kind="not-found" title="샵 페이지를 찾을 수 없어요" description="주문보드에서 다시 시작해 주세요." actionHref="/shop" actionLabel="주문보드로 이동" /></ShopLayout>;
}
