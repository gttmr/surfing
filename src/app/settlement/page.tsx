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
  const unpaid = settlementMeetings.filter((item) => item.paymentStatus === "PAYMENT_REQUIRED" || item.paymentStatus === "REPORTED");
  const settled = settlementMeetings.filter((item) => !unpaid.includes(item));
  const unpaidTotal = unpaid.reduce((sum, item) => sum + item.group.totalFee, 0);

  return (
    <div className="min-h-screen bg-brand-page text-brand-text">
      <MobileAppHeader context="청구 내역" />

      <main className="flex flex-col gap-6 px-4 pb-28 pt-6">
        <section>
          <p className="brand-text-subtle text-xs font-bold">내가 낼 금액</p>
          {unpaid.length > 0 ? (
            <>
              <h1 className="mt-1 font-headline text-[2rem] font-extrabold tracking-[-0.04em] text-brand-text">{formatWon(unpaidTotal)}</h1>
              <p className="brand-text-muted mt-1 text-sm">입금할 청구 {unpaid.length}건</p>
            </>
          ) : (
            <>
              <h1 className="mt-1 font-headline text-[1.7rem] font-extrabold tracking-[-0.04em] text-brand-text">낼 돈이 없어요</h1>
              <p className="brand-text-muted mt-1 text-sm">{settled.length > 0 ? "모든 청구가 정산되었습니다." : "모임 후 운영진이 청구를 공개하면 이곳에 표시됩니다."}</p>
            </>
          )}
        </section>

        {settlementMeetings.length === 0 ? (
          <div className="brand-card-soft rounded-3xl px-5 py-10 text-center">
            <Icon className="brand-text-subtle text-[34px]" name="receipt_long" />
            <p className="mt-2 text-base font-bold text-brand-text">공개된 청구가 없습니다</p>
            <Link className="brand-button-secondary mt-5 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold" href="/">모임 달력 보기</Link>
          </div>
        ) : null}

        {unpaid.map((item) => (
          <section className="brand-card rounded-3xl p-4" key={item.meeting.id}>
            <MeetingHeading item={item} />
            {unpaid.length > 1 ? (
              <p className="mt-3 text-[1.6rem] font-extrabold tracking-[-0.03em] text-brand-text">{formatWon(item.group.totalFee)}</p>
            ) : null}
            <div className="mt-3">
              <BillingAccountActions account={item.settlementAccount} amount={item.group.totalFee} />
            </div>
            <PaymentReportControl initialStatus={item.paymentStatus} meetingId={item.meeting.id} />
            <details className="mt-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-bold text-brand-text">
                청구 상세 보기
                <Icon className="brand-text-subtle text-[20px]" name="expand_more" />
              </summary>
              <SettlementBreakdown item={item} />
            </details>
          </section>
        ))}

        {settled.length > 0 ? (
          <section className="space-y-2">
            <h2 className="px-1 text-base font-extrabold text-brand-text">지난 청구</h2>
            {settled.map((item) => (
              <details className="brand-card-soft rounded-2xl px-4 py-3" key={item.meeting.id}>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
                  <MeetingHeading item={item} compact />
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-extrabold text-brand-text">{formatWon(item.group.totalFee)}</span>
                    <span className="brand-chip-success mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold">
                      {item.paymentStatus === "NO_PAYMENT_REQUIRED" ? "납부 없음" : "입금 완료"}
                    </span>
                  </span>
                </summary>
                <SettlementBreakdown item={item} />
              </details>
            ))}
          </section>
        ) : null}
      </main>
      <MemberDock />
    </div>
  );
}

type SettlementItem = Awaited<ReturnType<typeof getSettlementGroupsForKakaoId>>[number];

function MeetingHeading({ item, compact = false }: { readonly item: SettlementItem; readonly compact?: boolean }) {
  const { meeting } = item;
  const span = meeting.overnightGroup ? getOvernightMeetingSpan(meeting.overnightGroup) : null;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="brand-text-subtle text-xs font-bold">{span ? `${span.startDate}–${span.endDate}` : meeting.date}</p>
        {meeting.overnightGroup ? <span className="brand-chip-accent rounded-full px-2 py-0.5 text-[10px] font-bold">1박 2일</span> : null}
      </div>
      <p className={`${compact ? "text-sm" : "text-base"} mt-0.5 truncate font-extrabold text-brand-text`}>{meeting.location}</p>
    </div>
  );
}

function SettlementBreakdown({ item }: { readonly item: SettlementItem }) {
  const { group, publicationRevision } = item;
  return (
    <div className="space-y-4 border-t border-brand-divider pt-3">
      {group.items.map((participant) => {
        const chargeLines = getSettlementChargeLines(participant);
        return (
          <div key={participant.participantId}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold text-brand-text">
                {participant.participantName}
                {participant.memberType === "COMPANION" ? " (동반)" : ""}
              </p>
              <span className="shrink-0 text-sm font-extrabold text-brand-text">{formatWon(participant.totalFee)}</span>
            </div>
            <dl className="brand-text-muted mt-2 space-y-1.5 text-xs leading-5">
              {chargeLines.map((line) => (
                <div className="flex justify-between gap-4" key={line.key}>
                  <dt>{line.label}</dt>
                  <dd className="font-semibold">{formatWon(line.amount)}</dd>
                </div>
              ))}
            </dl>
            {participant.dailyBreakdowns ? (
              <div className="brand-text-muted mt-2 space-y-1 border-l-2 border-brand-divider pl-3 text-xs leading-5">
                {participant.dailyBreakdowns.map((day) => (
                  <div key={day.meetingId}>
                    <p className="font-bold text-brand-text">{day.label} · {day.date}</p>
                    {day.surfUsageLines.map((line) => <p key={line.id}>이용 · {line.usageItemName} × {line.quantity}</p>)}
                    {day.foodOrders.filter((order) => !order.cancelledAt).map((order) => (
                      <p key={order.id}>식음료 · {order.menuNameSnapshot}{order.optionChoiceLabelSnapshot ? ` · ${order.optionChoiceLabelSnapshot}` : ""} × {order.quantity}</p>
                    ))}
                    {day.adjustments.map((adjustment) => <p key={adjustment.id}>{adjustment.label} · {formatWon(adjustment.amount)}</p>)}
                    {day.surfUsageLines.length === 0 && day.foodOrders.every((order) => order.cancelledAt) && day.adjustments.length === 0
                      ? <p className="brand-text-subtle">추가 이용 없음</p>
                      : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      {publicationRevision ? (
        <p className="brand-text-subtle text-[11px]">청구 공개본 {publicationRevision} · 공개 당시 금액과 계좌 기준</p>
      ) : null}
    </div>
  );
}
