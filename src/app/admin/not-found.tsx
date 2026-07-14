import { AdminLayout } from "@/components/admin/AdminLayout";
import { AsyncState } from "@/components/ui/AsyncState";

export default function NotFound() {
  return <AdminLayout><AsyncState kind="not-found" title="관리 항목을 찾을 수 없어요" description="삭제되었거나 잘못된 주소일 수 있습니다." actionHref="/admin/meetings" actionLabel="모임 관리로 이동" /></AdminLayout>;
}
