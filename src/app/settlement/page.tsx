import Link from "next/link";
import { getSession } from "@/lib/session";
import { getSettlementGroupsForKakaoId } from "@/lib/settlement";
import { formatWon } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { PaymentReportControl } from "@/components/settlement/SettlementCompletionControl";
import { getSettlementChargeLines } from "@/lib/settlement-presentation";
import { BillingAccountActions } from "@/components/settlement/BillingAccountActions";
import { MemberDock, MobileAppHeader } from "@/components/ui/MobileShell";
import { getOvernightMeetingSpan } from "@/lib/meeting-group";

export const dynamic = "force-dynamic";

export default async function SettlementPage() {
  const session = await getSession();
  if (!session) {
    return (
      <div className="min-h-screen bg-brand-page text-brand-text">
        <MobileAppHeader context="청구 내역" />
        <main className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-4 py-10">
          <div className="border-y border-brand-divider py-8 text-center">
            <h1 className="text-xl font-extrabold text-brand-text">청구 내역을 확인하려면 로그인해 주세요</h1>
            <p className="brand-text-muted mt-2 text-sm">공개된 금액과 입금 확인 상태를 볼 수 있습니다.</p>
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
      <MobileAppHeader context="청구 내역" />

      <main className="flex flex-col gap-7 px-4 pb-28 pt-6">
        <section className="border-b border-brand-divider pb-5">
          <p className="brand-text-subtle text-xs font-bold">내가 낼 금액</p>
          <div className="mt-1 flex items-end justify-between gap-4">
            <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.04em] text-brand-text">모임별 청구 내역</h1>
            <span className="brand-chip-soft shrink-0 rounded-full px-3 py-1 text-xs font-bold">{settlementMeetings.length}건</span>
          </div>
          <p className="brand-text-muted mt-2 text-sm leading-6">실제 참석·이용 확인이 끝난 뒤 운영진이 공개한 금액입니다.</p>
        </section>

        {settlementMeetings.length === 0 ? (
          <div className="border-y border-brand-divider px-5 py-10 text-center">
            <Icon className="brand-text-subtle text-[34px]" name="receipt_long" />
            <p className="mt-2 text-base font-bold text-brand-text">공개된 청구가 없습니다</p>
            <p className="brand-text-muted mt-2 text-sm">모임 후 확인이 끝나면 이곳에 금액이 표시됩니다.</p>
            <Link className="brand-button-secondary mt-5 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold" href="/">모임 달력 보기</Link>
          </div>
        ) : (
          settlementMeetings.map(({ meeting, group, paymentStatus, settlementAccount, publicationRevision }) => {
            const overnightSpan = meeting.overnightGroup ? getOvernightMeetingSpan(meeting.overnightGroup) : null;
            return <section key={meeting.id} className="border-b border-brand-divider pb-7 last:border-b-0">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="brand-text-subtle text-xs font-bold">
                      {overnightSpan
                        ? `${overnightSpan.startDate}–${overnightSpan.endDate}`
                        : meeting.date}
                    </p>
                    {meeting.overnightGroup ? <span className="brand-chip-accent rounded-full px-2 py-0.5 text-[10px] font-bold">1박 2일 합산</span> : null}
                  </div>
                  <p className="mt-1 text-base font-extrabold text-brand-text">{meeting.location}</p>
                  {overnightSpan ? (
                    <p className="brand-text-muted mt-1 text-xs leading-5">
                      {overnightSpan.startTime} 시작 · {overnightSpan.endTime} 종료
                    </p>
                  ) : <p className="brand-text-muted mt-1 text-sm">{meeting.startTime}–{meeting.endTime}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="brand-text-subtle text-[11px] font-bold">회원 부담</p>
                  <p className="mt-1 text-xl font-extrabold text-brand-text">{formatWon(group.totalFee)}</p>
                </div>
              </div>

              <div className="space-y-4">
                {group.items.map((item) => {
                  const chargeLines = getSettlementChargeLines(item);
                  return (
                    <div key={item.participantId} className="border-t border-brand-divider pt-4 first:border-t-0 first:pt-0">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-bold text-brand-text">
                            {item.participantName}
                            {item.memberType === "COMPANION" ? " (동반)" : ""}
                          </p>
                          <span className="shrink-0 text-sm font-extrabold text-brand-text">{formatWon(item.totalFee)}</span>
                        </div>
                          {item.dailyBreakdowns ? (
                            <div className="mt-3 space-y-2">
                              {item.dailyBreakdowns.map((day) => (
                                <div className="rounded-xl border border-brand-divider bg-brand-surface-elevated px-3 py-3" key={day.meetingId}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-xs font-extrabold text-brand-text">{day.label} · {day.date}</p>
                                      <p className="brand-text-subtle mt-0.5 text-[10px]">기본 참가비 제외</p>
                                    </div>
                                    <strong className="shrink-0 text-xs text-brand-text">{formatWon(day.totalFee)}</strong>
                                  </div>
                                  <div className="brand-text-muted mt-2 space-y-1 text-xs leading-5">
                                    {day.surfUsageLines.length > 0
                                      ? day.surfUsageLines.map((line) => <p key={line.id}>실제 이용 · {line.usageItemName} × {line.quantity}</p>)
                                      : <p className="brand-text-subtle">실제 이용 없음</p>}
                                    {day.foodOrders.filter((order) => !order.cancelledAt).map((order) => (
                                      <p key={order.id}>식음료 · {order.menuNameSnapshot}{order.optionChoiceLabelSnapshot ? ` · ${order.optionChoiceLabelSnapshot}` : ""} × {order.quantity}</p>
                                    ))}
                                    {day.adjustments.map((adjustment) => <p key={adjustment.id}>{adjustment.label} · {formatWon(adjustment.amount)}</p>)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <p className="brand-text-subtle mt-3 text-[11px] font-bold">청구 구성</p>
                          <dl className="brand-text-muted mt-2 space-y-1.5 text-xs leading-5">
                            {chargeLines.map((line) => (
                              <div className="flex justify-between gap-4" key={line.key}>
                                <dt>{line.label}</dt>
                                <dd className="font-semibold">{formatWon(line.amount)}</dd>
                              </div>
                            ))}
                          </dl>
                      </div>
                    </div>
                  );
                })}
              </div>

              {paymentStatus !== "VERIFIED" && paymentStatus !== "NO_PAYMENT_REQUIRED" ? (
                <div className="mt-5 rounded-2xl bg-brand-primary-soft p-4">
                  <BillingAccountActions account={settlementAccount} amount={group.totalFee} />
                </div>
              ) : null}

              <PaymentReportControl initialStatus={paymentStatus} meetingId={meeting.id} />
              {publicationRevision ? (
                <p className="brand-text-subtle mt-3 text-[11px]">청구 공개본 {publicationRevision} · 공개 당시 금액과 계좌 기준</p>
              ) : null}
            </section>;
          })
        )}
      </main>
      <MemberDock />
    </div>
  );
}
