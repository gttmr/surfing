import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon } from "@/components/ui/Icon";
import type { ParticipantStatus } from "@/lib/types";
import { DAY_KO } from "@/lib/format";

type ConfirmSearchParams = {
  readonly status?: string;
  readonly waitlist?: string;
  readonly meetingId?: string;
  readonly name?: string;
  readonly companions?: string;
};

const KNOWN_STATUSES = ["APPROVED", "WAITLISTED", "CANCELLED"] as const satisfies readonly ParticipantStatus[];

function positiveInteger(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function participantStatus(value: string | undefined): ParticipantStatus | null {
  return KNOWN_STATUSES.find((candidate) => candidate === value) ?? null;
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<ConfirmSearchParams>;
}) {
  const { status, waitlist, meetingId, name, companions } = await searchParams;
  const normalizedStatus = participantStatus(status);
  const waitlistPosition = positiveInteger(waitlist);
  const meetingIdentifier = positiveInteger(meetingId);
  const companionCount = positiveInteger(companions) ?? 0;
  const queryMissing = !status && !meetingId && !name;

  let meetingDisplay = "";
  if (meetingIdentifier !== null) {
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingIdentifier } });
    if (meeting) {
      const date = new Date(`${meeting.date}T00:00:00`);
      const dayName = DAY_KO[date.getDay()];
      const [, month, day] = meeting.date.split("-");
      meetingDisplay = `${Number(month)}월 ${Number(day)}일 (${dayName}) ${meeting.startTime}`;
    }
  }

  const message = queryMissing
    ? "신청 정보가 비어 있습니다. 홈에서 현재 참가 상태를 확인해 주세요."
    : normalizedStatus === "APPROVED"
      ? "모임 참가가 확정되었습니다."
      : normalizedStatus === "WAITLISTED"
        ? waitlistPosition
          ? `대기 ${waitlistPosition}번째로 등록되었습니다.`
          : "대기자로 등록되었습니다."
        : normalizedStatus === "CANCELLED"
          ? "참가 취소가 반영되었습니다."
          : "처리된 신청의 최신 상태는 홈에서 확인할 수 있습니다.";
  const title = queryMissing
    ? "신청 결과를 확인해 주세요"
    : normalizedStatus === "CANCELLED"
      ? "취소가 반영되었습니다"
      : normalizedStatus
        ? "신청이 처리되었습니다"
        : "처리 상태를 확인 중입니다";
  const icon = normalizedStatus === "CANCELLED" || queryMissing ? "info" : normalizedStatus ? "check" : "schedule";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--brand-page)] text-[var(--brand-text)]">
      <header className="brand-header-surface">
        <div className="mx-auto flex h-16 w-full max-w-[430px] items-center px-4">
          <p className="text-sm font-extrabold">신청 결과</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[430px] flex-1 items-center px-4 py-10">
        <section aria-labelledby="confirm-heading" className="brand-card-soft w-full rounded-3xl p-6 text-center">
          <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${normalizedStatus === "APPROVED" ? "brand-alert-success" : "brand-chip-soft"}`}>
            <Icon className="text-[32px]" name={icon} />
          </span>

          <h1 className="mt-5 text-xl font-extrabold" id="confirm-heading">{title}</h1>
          <p className="brand-text-muted mt-2 text-sm leading-6">{message}</p>

          <dl className="brand-inset-panel mt-6 space-y-3 rounded-2xl p-4 text-left">
            {name ? (
              <div className="flex justify-between gap-4 text-sm">
                <dt className="brand-text-subtle">이름</dt>
                <dd className="text-right font-semibold">{name}</dd>
              </div>
            ) : null}
            {meetingDisplay ? (
              <div className="flex justify-between gap-4 text-sm">
                <dt className="brand-text-subtle">모임</dt>
                <dd className="max-w-[70%] text-right font-semibold">{meetingDisplay}</dd>
              </div>
            ) : null}
            {companionCount > 0 ? (
              <div className="flex justify-between gap-4 text-sm">
                <dt className="brand-text-subtle">동반인</dt>
                <dd className="text-right font-semibold text-[var(--brand-companion)]">{companionCount}명 함께 신청</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4 text-sm">
              <dt className="brand-text-subtle">상태</dt>
              <dd>
                {normalizedStatus ? (
                  <StatusBadge size="sm" status={normalizedStatus} waitlistPosition={waitlistPosition} />
                ) : (
                  <span className="brand-chip-soft rounded-full px-2.5 py-1 text-xs font-bold">확인 필요</span>
                )}
              </dd>
            </div>
          </dl>

          <Link className="brand-button-primary mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-5 text-sm font-bold" href="/">
            홈에서 참가 상태 확인하기
          </Link>
          <Link className="brand-link mt-3 inline-flex min-h-11 items-center justify-center px-4 text-sm font-bold" href="/profile">
            내 프로필로 이동
          </Link>
        </section>
      </main>
    </div>
  );
}
