import { Icon } from "@/components/ui/Icon";
import type { AdminNoticeItem } from "@/lib/admin-page-data";

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

type NoticeListProps = {
  readonly notices: readonly AdminNoticeItem[];
  readonly loading: boolean;
  readonly error: string;
  readonly onCreate: () => void;
  readonly onRead: (noticeId: number) => void;
  readonly onRetry: () => void;
};

export function AdminNoticeList({ notices, loading, error, onCreate, onRead, onRetry }: NoticeListProps) {
  return (
    <section aria-labelledby="notice-list-title" className="brand-admin-section overflow-hidden">
      <div className="brand-admin-section-header flex items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-[var(--brand-text)]" id="notice-list-title">공지 목록</h2>
          <p className="brand-text-subtle mt-1 text-xs">공지 하나를 열어 읽고 필요한 작업을 선택하세요.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button aria-label="공지 새로고침" className="brand-button-secondary flex h-11 w-11 items-center justify-center rounded-full" onClick={onRetry} type="button">
            <Icon className="text-[19px]" name="refresh" />
          </button>
          <button className="brand-button-primary inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold" onClick={onCreate} type="button">
            <Icon className="text-[18px]" name="add" /> 새 공지
          </button>
        </div>
      </div>

      {loading ? <p aria-live="polite" className="brand-admin-empty px-5 py-12 text-sm">공지를 불러오는 중입니다.</p> : null}
      {!loading && error ? (
        <div className="px-5 py-10 text-center" role="alert">
          <Icon className="text-[32px] text-[var(--brand-danger)]" name="error" />
          <p className="mt-2 text-sm font-bold text-[var(--brand-text)]">공지를 불러오지 못했어요</p>
          <p className="brand-text-subtle mt-1 text-xs">{error}</p>
          <button className="brand-button-secondary mt-4 rounded-2xl px-4 py-2 text-sm font-bold" onClick={onRetry} type="button">다시 시도</button>
        </div>
      ) : null}
      {!loading && !error && notices.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Icon className="text-[36px] text-[var(--brand-primary-text)]" name="campaign" />
          <p className="mt-2 text-sm font-bold text-[var(--brand-text)]">아직 등록된 공지가 없어요</p>
          <p className="brand-text-subtle mt-1 text-xs">첫 공지를 작성해 회원들에게 운영 소식을 알려 주세요.</p>
          <button className="brand-button-primary mt-4 rounded-2xl px-4 py-2 text-sm font-bold" onClick={onCreate} type="button">첫 공지 작성</button>
        </div>
      ) : null}
      {!loading && !error && notices.length > 0 ? (
        <div className="divide-y divide-[var(--brand-divider)]">
          {notices.map((notice) => (
            <button
              className="brand-list-item brand-list-item-hover flex w-full items-start gap-3 px-5 py-4 text-left"
              key={notice.id}
              onClick={() => onRead(notice.id)}
              type="button"
            >
              <Icon className="mt-0.5 shrink-0 text-[22px]" name={notice.isPinned ? "keep" : "article"} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  {notice.isPinned ? <span className="brand-chip-strong rounded-full px-2 py-1 text-xs font-bold">최상단 고정</span> : null}
                  <span className="brand-text-subtle text-xs">{formatTimestamp(notice.updatedAt)}</span>
                </span>
                <span className="mt-2 block text-pretty text-sm font-bold text-[var(--brand-text)]">{notice.title}</span>
                <span className="brand-text-muted mt-1 line-clamp-2 block text-pretty text-sm leading-5">{notice.body}</span>
              </span>
              <Icon className="mt-1 shrink-0 text-[20px]" name="chevron_right" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

type NoticeReaderProps = {
  readonly notice: AdminNoticeItem;
  readonly working: boolean;
  readonly onBack: () => void;
  readonly onDelete: () => void;
  readonly onEdit: () => void;
  readonly onPinToggle: () => void;
};

export function AdminNoticeReader({ notice, working, onBack, onDelete, onEdit, onPinToggle }: NoticeReaderProps) {
  return (
    <article aria-labelledby="notice-reader-title" className="brand-admin-section overflow-hidden">
      <div className="brand-admin-section-header px-5 py-4">
        <button className="brand-link inline-flex items-center gap-1 text-sm font-bold" onClick={onBack} type="button">
          <Icon className="text-[18px]" name="arrow_back" /> 공지 목록
        </button>
      </div>
      <div className="px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={notice.isPinned ? "brand-chip-strong rounded-full px-2 py-1 text-xs font-bold" : "brand-chip-accent rounded-full px-2 py-1 text-xs font-bold"}>
            {notice.isPinned ? "최상단 고정" : "일반 공지"}
          </span>
          <span className="brand-text-subtle text-xs">수정 {formatTimestamp(notice.updatedAt)}</span>
        </div>
        <h2 className="mt-4 text-pretty text-xl font-extrabold leading-8 text-[var(--brand-text)]" id="notice-reader-title">{notice.title}</h2>
        <p className="brand-text-muted mt-4 whitespace-pre-line text-pretty text-sm leading-7">{notice.body}</p>
      </div>
      <div className="brand-admin-inline-panel grid grid-cols-3 gap-2 px-5 py-4">
        <button className="brand-button-secondary rounded-2xl px-2 py-3 text-xs font-bold" disabled={working} onClick={onPinToggle} type="button">
          {notice.isPinned ? "고정 해제" : "최상단 고정"}
        </button>
        <button className="brand-button-secondary rounded-2xl px-2 py-3 text-xs font-bold" disabled={working} onClick={onEdit} type="button">수정</button>
        <button className="brand-button-danger rounded-2xl px-2 py-3 text-xs font-bold" disabled={working} onClick={onDelete} type="button">삭제</button>
      </div>
    </article>
  );
}
