import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/session";
import { getSettlementGroupsForKakaoId } from "@/lib/settlement";
import { formatWon } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { SettlementCompletionControl } from "@/components/settlement/SettlementCompletionControl";
import { getSettlementChargeLines } from "@/lib/settlement-presentation";

export const dynamic = "force-dynamic";

export default async function SettlementPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div className="min-h-screen bg-brand-page text-brand-text">
        <header className="brand-header-surface fixed inset-x-0 top-0 z-50">
          <div className="mx-auto flex h-16 w-full max-w-[430px] items-center justify-between px-4">
            <Link href="/" className="flex h-12 items-center">
              <Image alt="SDS Surfing logo" className="h-auto w-[78px]" height={716} priority src="/logo.png" width={1148} />
            </Link>
          </div>
        </header>
        <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-center px-4 pb-12 pt-24">
          <div className="brand-card-soft rounded-3xl p-6 text-center">
            <h1 className="text-xl font-extrabold text-brand-text">정산 확인</h1>
            <p className="brand-text-muted mt-2 text-sm">정산 금액을 확인하려면 먼저 로그인해 주세요.</p>
            <a
              href={`/api/auth/kakao?returnTo=${encodeURIComponent("/settlement")}`}
              className="brand-button-primary mt-5 inline-flex rounded-2xl px-5 py-3 text-sm font-bold"
            >
              카카오 로그인
            </a>
          </div>
        </main>
      </div>
    );
  }

  const settlementMeetings = await getSettlementGroupsForKakaoId(session.kakaoId);

  return (
    <div className="min-h-screen bg-brand-page text-brand-text">
      <header className="brand-header-surface fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-16 w-full max-w-[430px] items-center justify-between px-4">
          <Link aria-label="프로필로 돌아가기" className="brand-button-secondary flex h-11 w-11 items-center justify-center rounded-full" href="/profile">
            <Icon className="text-[21px]" name="arrow_back" />
          </Link>
          <p className="text-sm font-extrabold text-brand-text">내 정산</p>
          <Link aria-label="모임 홈으로 이동" className="brand-button-secondary flex h-11 w-11 items-center justify-center rounded-full" href="/">
            <Icon className="text-[21px]" name="home" />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-4 pb-12 pt-24">
        <section className="brand-card-soft rounded-3xl p-5">
          <p className="brand-text-subtle text-xs font-bold">개인 정산 내역</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <h1 className="font-headline text-[1.75rem] font-extrabold tracking-[-0.04em] text-brand-text">모임별로 확인하세요</h1>
            {settlementMeetings.length > 0 ? <span className="brand-chip-soft shrink-0 rounded-full px-3 py-1 text-xs font-bold">{settlementMeetings.length}건</span> : null}
          </div>
          <p className="brand-text-subtle mt-2 text-sm leading-6">본인과 내가 신청한 미연결 동반인 금액을 모임 단위로 묶었습니다.</p>
        </section>

        {settlementMeetings.length === 0 ? (
          <div className="brand-card-soft rounded-3xl px-5 py-9 text-center">
            <Icon className="brand-text-subtle text-[34px]" name="receipt_long" />
            <p className="text-base font-bold text-brand-text">정산할 항목이 아직 없습니다.</p>
            <p className="brand-text-muted mt-2 text-sm">운영진이 정산 정보를 입력하면 이 화면에서 확인할 수 있습니다.</p>
            <Link className="brand-button-secondary mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl px-5 text-sm font-bold" href="/profile">프로필로 돌아가기</Link>
          </div>
        ) : (
          settlementMeetings.map(({ meeting, group, isCompleted }) => (
            <section key={meeting.id} className="brand-card-soft rounded-3xl p-5">
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-brand-divider pb-4">
                <div>
                  <p className="brand-text-subtle text-xs font-bold">{meeting.date}</p>
                  <p className="mt-1 text-base font-extrabold text-brand-text">{meeting.location}</p>
                  <p className="brand-text-muted mt-1 text-sm">{meeting.startTime}–{meeting.endTime}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="brand-text-subtle text-[11px] font-bold">보낼 금액</p>
                  <p className="mt-1 text-lg font-extrabold text-brand-text">{formatWon(group.totalFee)}</p>
                </div>
              </div>

              <SettlementCompletionControl initialCompleted={isCompleted} meetingId={meeting.id} />

              <div className="space-y-3">
                {group.items.map((item) => {
                  const chargeLines = getSettlementChargeLines(item);
                  return (
                    <div key={item.participantId} className="brand-panel-white rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-brand-text">
                            {item.participantName}
                            {item.memberType === "COMPANION" ? " (동반)" : ""}
                          </p>
                          <dl className="brand-text-subtle mt-2 space-y-1 text-xs leading-5">
                            {chargeLines.map((line) => (
                              <div className="flex gap-2" key={line.key}>
                                <dt>{line.label}</dt>
                                <dd>{formatWon(line.amount)}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                        <span className="text-sm font-extrabold text-brand-text">{formatWon(item.totalFee)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
