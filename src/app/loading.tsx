import { AsyncState } from "@/components/ui/AsyncState";
import { RouteStateShell } from "@/components/ui/MobileShell";

export default function Loading() {
  return <RouteStateShell><AsyncState kind="loading" title="화면을 준비하고 있어요" description="모임 정보를 불러오는 중입니다." /></RouteStateShell>;
}
