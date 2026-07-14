import { AsyncState } from "@/components/ui/AsyncState";
import { RouteStateShell } from "@/components/ui/MobileShell";

export default function NotFound() {
  return <RouteStateShell><AsyncState kind="not-found" title="페이지를 찾을 수 없어요" description="주소를 확인하거나 홈에서 다시 시작해 주세요." actionHref="/" actionLabel="홈으로 이동" /></RouteStateShell>;
}
