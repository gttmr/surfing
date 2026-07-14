import { ShopLayout } from "@/components/shop/ShopLayout";
import { AsyncState } from "@/components/ui/AsyncState";

export default function Loading() {
  return <ShopLayout><AsyncState kind="loading" title="샵 화면을 준비하고 있어요" description="주문 정보를 불러오는 중입니다." /></ShopLayout>;
}
