import { AdminLayout } from "@/components/admin/AdminLayout";
import { AsyncState } from "@/components/ui/AsyncState";

export default function Loading() {
  return <AdminLayout><AsyncState kind="loading" title="관리 화면을 준비하고 있어요" description="필요한 정보를 불러오는 중입니다." /></AdminLayout>;
}
