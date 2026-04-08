import Link from "next/link";
import Image from "next/image";
import { getSession } from "@/lib/session";
import { getSettlementGroupsForKakaoId } from "@/lib/settlement";
import { formatWon } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SettlementPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div className="min-h-screen bg-[var(--brand-page)] text-[var(--brand-text)]">
        <header className="brand-header-surface fixed inset-x-0 top-0 z-50">
          <div className="mx-auto flex h-16 w-full max-w-[390px] items-center justify-between px-4">
            <Link href="/" className="flex h-12 items-center">
              <Image alt="Surfing club logo" className="h-auto w-[64px]" height={64} priority src="/logo.png" width={64} />
            </Link>
          </div>
        </header>
        <main className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col justify-center px-4 pb-12 pt-24">
          <div className="brand-card-soft rounded-3xl p-6 text-center">
            <h1 className="text-xl font-extrabold text-[var(--brand-text)]">정산 확인</h1>
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
    <div className="min-h-screen bg-[var(--brand-page)] text-[var(--brand-text)]">
      <header className="brand-header-surface fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-16 w-full max-w-[390px] items-center justify-between px-4">
          <Link href="/" className="flex h-12 items-center">
            <Image alt="Surfing club logo" className="h-auto w-[64px]" height={64} priority src="/logo.png" width={64} />
          </Link>
          <Link href="/" className="brand-link text-sm font-bold">홈</Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[390px] flex-col gap-4 px-4 pb-12 pt-24">
        <section>
          <h1 className="font-headline text-[1.8rem] font-extrabold tracking-[-0.05em] text-[var(--brand-text)]">정산 확인</h1>
          <p className="brand-text-subtle mt-1 text-sm">본인 또는 연결된 동반인 기준 정산 금액을 확인할 수 있습니다.</p>
        </section>

        {settlementMeetings.length === 0 ? (
          <div className="brand-card-soft rounded-3xl px-5 py-8 text-center">
            <p className="text-base font-bold text-[var(--brand-text)]">정산할 항목이 아직 없습니다.</p>
            <p className="brand-text-muted mt-2 text-sm">운영진이 정산 정보를 입력하면 이 화면에서 확인할 수 있습니다.</p>
          </div>
        ) : (
          settlementMeetings.map(({ meeting, group }) => (
            <section key={meeting.id} className="brand-card-soft rounded-3xl p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-extrabold text-[var(--brand-text)]">{meeting.date}</p>
                  <p className="brand-text-muted mt-1 text-sm">{meeting.startTime}–{meeting.endTime} · {meeting.location}</p>
                </div>
                <span className="brand-chip-dark rounded-full px-2 py-1 text-xs font-bold">
                  총 {formatWon(group.totalFee)}
                </span>
              </div>

              <div className="space-y-3">
                {group.items.map((item) => (
                  <div key={item.participantId} className="brand-panel-white rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[var(--brand-text)]">
                          {item.participantName}
                          {item.memberType === "COMPANION" ? " (동반)" : ""}
                        </p>
                        <div className="brand-text-subtle mt-1 space-y-1 text-xs">
                          <p>참가 {formatWon(item.baseFee)} · 강습 {formatWon(item.lessonFee)} · 대여 {formatWon(item.rentalFee)}</p>
                          {item.adjustments.map((adjustment) => (
                            <p key={adjustment.id}>
                              {adjustment.label} {adjustment.amount >= 0 ? "+" : ""}{formatWon(adjustment.amount)}
                            </p>
                          ))}
                        </div>
                      </div>
                      <span className="text-sm font-extrabold text-[var(--brand-text)]">{formatWon(item.totalFee)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
