import { AsyncState } from "@/components/ui/AsyncState";
import { Icon } from "@/components/ui/Icon";
import type { Ref } from "react";
import type { AdminMemberFilter } from "@/lib/admin-members";
import type { AdminMemberListItem } from "@/lib/admin-page-data";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "관리자",
  SHOP_OWNER: "샵 운영자",
  MEMBER: "일반 회원",
  BANNED: "차단",
};

const ROLE_CLASSES: Record<string, string> = {
  ADMIN: "brand-chip-dark",
  SHOP_OWNER: "brand-chip-accent",
  MEMBER: "brand-chip-soft",
  BANNED: "brand-chip-danger",
};

const TYPE_LABELS: Record<string, string> = {
  REGULAR: "정회원",
  COMPANION: "동반인",
};

export function adminMemberRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function adminMemberTypeLabel(memberType: string): string {
  return TYPE_LABELS[memberType] ?? memberType;
}

function roleFilter(value: string): AdminMemberFilter["role"] {
  if (value === "ADMIN" || value === "SHOP_OWNER" || value === "MEMBER" || value === "BANNED") return value;
  return "ALL";
}

function memberTypeFilter(value: string): AdminMemberFilter["memberType"] {
  if (value === "REGULAR" || value === "COMPANION") return value;
  return "ALL";
}

function statusFilter(value: string): AdminMemberFilter["status"] {
  if (value === "ACTIVE" || value === "PENALTY" || value === "BANNED") return value;
  return "ALL";
}

type AdminMemberListPanelProps = {
  readonly allMemberCount: number;
  readonly filter: AdminMemberFilter;
  readonly members: readonly AdminMemberListItem[];
  readonly onFilterChange: (filter: AdminMemberFilter) => void;
  readonly onOpenMember: (member: AdminMemberListItem) => void;
  readonly onResetFilter: () => void;
  readonly searchInputRef?: Ref<HTMLInputElement>;
};

export function AdminMemberListPanel({
  allMemberCount,
  filter,
  members,
  onFilterChange,
  onOpenMember,
  onResetFilter,
  searchInputRef,
}: AdminMemberListPanelProps) {
  const hasFilter = filter.query.length > 0
    || filter.role !== "ALL"
    || filter.memberType !== "ALL"
    || filter.status !== "ALL";

  return (
    <section aria-labelledby="admin-member-list-title" className="brand-admin-section overflow-hidden">
      <div className="brand-admin-section-header space-y-4 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-brand-text" id="admin-member-list-title">회원 찾기</h2>
            <p className="brand-text-subtle mt-1 text-xs">검색하고 조건을 좁힌 뒤 상세 정보를 확인하세요.</p>
          </div>
          <span className="brand-admin-stat shrink-0 rounded-full px-3 py-1.5 text-xs font-bold">
            {members.length}/{allMemberCount}명
          </span>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-brand-text" htmlFor="admin-member-search">회원 검색</label>
          <div className="relative">
            <Icon className="brand-text-subtle pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px]" name="search" />
            <input
              autoComplete="off"
              className="brand-input min-h-11 w-full rounded-2xl py-3 pl-10 pr-4 text-sm outline-none"
              id="admin-member-search"
              onChange={(event) => onFilterChange({ ...filter, query: event.target.value })}
              placeholder="이름, 카카오 ID, 연락처"
              ref={searchInputRef}
              type="search"
              value={filter.query}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="min-w-0 text-[11px] font-bold text-brand-text">
            <span className="mb-1 block">등급</span>
            <select
              aria-label="회원 등급 필터"
              className="brand-input min-h-11 w-full rounded-xl px-2 text-xs"
              onChange={(event) => onFilterChange({ ...filter, role: roleFilter(event.target.value) })}
              value={filter.role}
            >
              <option value="ALL">전체</option>
              <option value="ADMIN">관리자</option>
              <option value="SHOP_OWNER">샵 운영자</option>
              <option value="MEMBER">일반 회원</option>
              <option value="BANNED">차단</option>
            </select>
          </label>
          <label className="min-w-0 text-[11px] font-bold text-brand-text">
            <span className="mb-1 block">유형</span>
            <select
              aria-label="회원 유형 필터"
              className="brand-input min-h-11 w-full rounded-xl px-2 text-xs"
              onChange={(event) => onFilterChange({ ...filter, memberType: memberTypeFilter(event.target.value) })}
              value={filter.memberType}
            >
              <option value="ALL">전체</option>
              <option value="REGULAR">정회원</option>
              <option value="COMPANION">동반인</option>
            </select>
          </label>
          <label className="min-w-0 text-[11px] font-bold text-brand-text">
            <span className="mb-1 block">상태</span>
            <select
              aria-label="회원 상태 필터"
              className="brand-input min-h-11 w-full rounded-xl px-2 text-xs"
              onChange={(event) => onFilterChange({ ...filter, status: statusFilter(event.target.value) })}
              value={filter.status}
            >
              <option value="ALL">전체</option>
              <option value="ACTIVE">정상</option>
              <option value="PENALTY">패널티</option>
              <option value="BANNED">차단</option>
            </select>
          </label>
        </div>

        {hasFilter && members.length > 0 ? (
          <button className="brand-link inline-flex min-h-11 items-center gap-1 text-xs font-bold" onClick={onResetFilter} type="button">
            <Icon className="text-[18px]" name="filter_alt_off" /> 검색 조건 지우기
          </button>
        ) : null}
      </div>

      {members.length === 0 ? (
        <div className="p-4">
          <AsyncState
            actionLabel={hasFilter ? "검색 조건 지우기" : undefined}
            description={hasFilter ? "다른 이름이나 조건으로 다시 찾아보세요." : "카카오 로그인한 회원이 등록되면 여기에 표시됩니다."}
            kind="empty"
            onAction={hasFilter ? onResetFilter : undefined}
            title={hasFilter ? "검색 결과가 없습니다" : "등록된 회원이 없습니다"}
          />
        </div>
      ) : (
        <ul aria-label="회원 검색 결과">
          {members.map((member) => (
            <li className="brand-list-row last:border-b-0" key={member.id}>
              <button
                aria-haspopup="dialog"
                className="brand-touch-target flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-brand-primary-soft"
                onClick={() => onOpenMember(member)}
                type="button"
              >
                <span className="brand-avatar-shell flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full">
                  {member.profileImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-full w-full object-cover" src={member.profileImage} />
                  ) : (
                    <Icon className="text-[24px]" name="person" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-extrabold leading-5 text-brand-text">
                    {member.name ?? "이름 없음"}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${ROLE_CLASSES[member.role] ?? "brand-chip-soft"}`}>
                      {adminMemberRoleLabel(member.role)}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${member.memberType === "COMPANION" ? "brand-chip-companion" : "brand-chip-soft"}`}>
                      {adminMemberTypeLabel(member.memberType)}
                    </span>
                    {member.penaltyCount > 0 ? (
                      <span className="brand-chip-danger rounded px-1.5 py-0.5 text-[10px] font-bold">패널티 {member.penaltyCount}</span>
                    ) : null}
                  </span>
                  <span className="brand-text-subtle mt-1.5 block text-xs">모임 {member._count.participants}회 · {member.kakaoId}</span>
                </span>
                <Icon className="brand-text-subtle shrink-0 text-[22px]" name="chevron_right" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
