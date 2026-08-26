import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAdminSettingsFormData, getAdminSettlementData } from "@/lib/admin-page-data";
import { buildMeetingBillingSnapshot } from "@/lib/billing-snapshot";
import { getMeetingBillingReadiness, getMeetingGroupBillingReadiness } from "@/lib/meeting-readiness-data";
import { getSessionPayload } from "@/lib/session";

type BillingMeetingScope = {
  readonly canonicalMeetingId: number;
  readonly meetingIds: readonly number[];
};

async function getBillingMeetingScope(requestedMeetingId: number): Promise<BillingMeetingScope | null> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: requestedMeetingId },
    select: {
      id: true,
      meetingGroup: {
        select: {
          meetings: {
            orderBy: { groupDayIndex: "asc" },
            select: { id: true, groupDayIndex: true },
          },
        },
      },
    },
  });
  if (!meeting) return null;

  const groupMeetings = meeting.meetingGroup?.meetings ?? [];
  const canonicalMeetingId = groupMeetings.find((item) => item.groupDayIndex === 1)?.id ?? meeting.id;
  return {
    canonicalMeetingId,
    meetingIds: groupMeetings.length > 0 ? groupMeetings.map((item) => item.id) : [meeting.id],
  };
}

function getScopedBillingReadiness(scope: BillingMeetingScope) {
  return scope.meetingIds.length > 1
    ? getMeetingGroupBillingReadiness(scope.meetingIds)
    : getMeetingBillingReadiness(scope.canonicalMeetingId);
}

function billingDateLabel(data: Awaited<ReturnType<typeof getAdminSettlementData>>): string {
  if (!data) return "";
  const days = data.meeting.overnightGroup?.days;
  return days ? `${days[0].date}~${days[1].date}` : data.meeting.date;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const requestedMeetingId = Number(id);
  if (!Number.isInteger(requestedMeetingId)) {
    return NextResponse.json({ error: "잘못된 모임 ID입니다." }, { status: 400 });
  }

  const data = await getAdminSettlementData(requestedMeetingId);
  if (!data) {
    return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const requestedMeetingId = Number(id);
  if (!Number.isInteger(requestedMeetingId)) {
    return NextResponse.json({ error: "잘못된 모임 ID입니다." }, { status: 400 });
  }
  const scope = await getBillingMeetingScope(requestedMeetingId);
  if (!scope) return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  const meetingId = scope.canonicalMeetingId;

  const body: unknown = await req.json().catch(() => null);
  const payload = typeof body === "object" && body !== null ? body : {};
  const requestedAction = "action" in payload && typeof payload.action === "string"
    ? payload.action
    : "settlementOpen" in payload
      ? payload.settlementOpen ? "publish" : "reopen"
      : null;
  const actor = await getSessionPayload();
  const actorKakaoId = actor?.kakaoId ?? "password-admin";

  if (requestedAction === "verify-payment" || requestedAction === "unverify-payment") {
    const recipientKakaoId = "recipientKakaoId" in payload && typeof payload.recipientKakaoId === "string"
      ? payload.recipientKakaoId.trim()
      : "";
    if (!recipientKakaoId) {
      return NextResponse.json({ error: "입금 확인 대상이 필요합니다." }, { status: 400 });
    }
    const data = await getAdminSettlementData(meetingId);
    if (!data) return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
    if (!data.meeting.settlementOpen) {
      return NextResponse.json({ error: "청구 공개 후 입금을 확인할 수 있습니다." }, { status: 409 });
    }
    const recipient = data.recipients.find((item) => item.recipientKakaoId === recipientKakaoId);
    if (!recipient) {
      return NextResponse.json({ error: "청구 대상자를 찾을 수 없습니다." }, { status: 404 });
    }
    if (recipient.totalFee === 0) {
      return NextResponse.json({ error: "회원 부담이 0원인 청구는 입금 확인이 필요하지 않습니다." }, { status: 409 });
    }

    if (requestedAction === "unverify-payment") {
      await prisma.$transaction([
        prisma.settlementConfirmation.updateMany({
          where: { meetingId, recipientKakaoId },
          data: { verifiedAt: null, verifiedByKakaoId: null },
        }),
        prisma.userNotification.deleteMany({
          where: { meetingId, recipientKakaoId, type: "PAYMENT_VERIFIED" },
        }),
        prisma.meeting.update({
          where: { id: meetingId },
          data: { settlementCompletedAt: null, settlementCompletedByKakaoId: null },
        }),
      ]);
    } else {
      const verifiedAt = new Date();
      await prisma.$transaction([
        prisma.settlementConfirmation.upsert({
          where: {
            meetingId_recipientKakaoId: { meetingId, recipientKakaoId },
          },
          create: {
            meetingId,
            recipientKakaoId,
            confirmedAt: verifiedAt,
            verifiedAt,
            verifiedByKakaoId: actorKakaoId,
          },
          update: {
            verifiedAt,
            verifiedByKakaoId: actorKakaoId,
          },
        }),
        prisma.userNotification.deleteMany({
          where: { meetingId, recipientKakaoId, type: "PAYMENT_VERIFIED" },
        }),
        prisma.userNotification.create({
          data: {
            meetingId,
            recipientKakaoId,
            type: "PAYMENT_VERIFIED",
            title: `${billingDateLabel(data)} 입금이 확인되었습니다`,
            body: `입금 완료 · ${recipient.totalFee.toLocaleString("ko-KR")}원`,
          },
        }),
      ]);
    }

    return NextResponse.json({ action: requestedAction, data: await getAdminSettlementData(meetingId) });
  }

  if (requestedAction === "record-payout") {
    const payoutType = "payoutType" in payload && (payload.payoutType === "shop" || payload.payoutType === "food")
      ? payload.payoutType
      : null;
    const amount = "amount" in payload ? Number(payload.amount) : Number.NaN;
    if (!payoutType || !Number.isInteger(amount) || amount < 0) {
      return NextResponse.json({ error: "지급 구분과 0원 이상의 실제 지급액이 필요합니다." }, { status: 400 });
    }
    const current = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { settlementOpen: true },
    });
    if (!current) return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
    if (!current.settlementOpen) {
      return NextResponse.json({ error: "청구 공개 후 실제 지급액을 기록할 수 있습니다." }, { status: 409 });
    }
    await prisma.meeting.update({
      where: { id: meetingId },
      data: payoutType === "shop"
        ? { shopPaidAt: new Date(), shopPaidAmount: amount, settlementCompletedAt: null, settlementCompletedByKakaoId: null }
        : { foodPaidAt: new Date(), foodPaidAmount: amount, settlementCompletedAt: null, settlementCompletedByKakaoId: null },
    });
    return NextResponse.json({ action: requestedAction, data: await getAdminSettlementData(meetingId) });
  }

  if (requestedAction === "complete-settlement") {
    const data = await getAdminSettlementData(meetingId);
    if (!data) return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
    if (!data.meeting.settlementOpen) {
      return NextResponse.json({ error: "청구 공개 후 정산을 완료할 수 있습니다." }, { status: 409 });
    }
    const blockers = [
      data.verifiedRecipientCount < data.recipients.length ? "회원 입금 확인" : null,
      data.billing.totals.shopPayableTotal > 0 && !data.billing.shopPayout.paidAt ? "샵 지급 기록" : null,
      data.billing.totals.foodPayableTotal > 0 && !data.billing.foodPayout.paidAt ? "식음료 지급 기록" : null,
    ].filter((item): item is string => item !== null);
    if (blockers.length > 0) {
      return NextResponse.json({
        error: "최종 정산 전에 남은 작업을 완료해 주세요.",
        blockers,
      }, { status: 409 });
    }
    const note = "note" in payload && typeof payload.note === "string"
      ? payload.note.trim().slice(0, 300) || null
      : null;
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        settlementCompletedAt: new Date(),
        settlementCompletedByKakaoId: actorKakaoId,
        settlementNote: note,
      },
    });
    return NextResponse.json({ action: requestedAction, data: await getAdminSettlementData(meetingId) });
  }

  if (requestedAction === "confirm-review") {
    const readiness = await getScopedBillingReadiness(scope);
    if (!readiness) return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
    const operationalBlockers = readiness.checks.filter(
      (check) => check.id !== "billing-reviewed" && !check.complete
    );
    if (operationalBlockers.length > 0) {
      return NextResponse.json({
        error: "청구 검토 전에 운영 확인을 완료해 주세요.",
        readiness,
      }, { status: 409 });
    }

    await prisma.meeting.updateMany({
      where: { id: { in: [...scope.meetingIds] } },
      data: {
        billingReviewConfirmedAt: new Date(),
        billingReviewConfirmedByKakaoId: actorKakaoId,
      },
    });
    return NextResponse.json({ action: requestedAction, readiness: await getScopedBillingReadiness(scope) });
  }

  if (requestedAction === "unconfirm-review") {
    const current = await prisma.meeting.findMany({
      where: { id: { in: [...scope.meetingIds] } },
      select: { settlementOpen: true },
    });
    if (current.some((item) => item.settlementOpen)) {
      return NextResponse.json({ error: "공개된 청구는 청구 정정 절차로만 변경할 수 있습니다." }, { status: 409 });
    }
    await prisma.meeting.updateMany({
      where: { id: { in: [...scope.meetingIds] } },
      data: {
        billingReviewConfirmedAt: null,
        billingReviewConfirmedByKakaoId: null,
      },
    });
    return NextResponse.json({ action: requestedAction, readiness: await getScopedBillingReadiness(scope) });
  }

  if (requestedAction === "reopen") {
    const correctionReason = "correctionReason" in payload && typeof payload.correctionReason === "string"
      ? payload.correctionReason.trim().slice(0, 200)
      : "";
    if (!correctionReason) {
      return NextResponse.json({ error: "청구 정정 사유를 입력해 주세요." }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.meeting.updateMany({
        where: { id: { in: [...scope.meetingIds] } },
        data: {
          settlementOpen: false,
          billingReviewConfirmedAt: null,
          billingReviewConfirmedByKakaoId: null,
          billingPublishedAt: null,
          billingPublishedByKakaoId: null,
          billingCorrectionReason: correctionReason,
        },
      }),
      prisma.meeting.update({
        where: { id: meetingId },
        data: {
          shopPaidAt: null,
          shopPaidAmount: null,
          foodPaidAt: null,
          foodPaidAmount: null,
          settlementCompletedAt: null,
          settlementCompletedByKakaoId: null,
          settlementNote: null,
        },
      }),
      prisma.settlementConfirmation.deleteMany({ where: { meetingId } }),
      prisma.userNotification.deleteMany({
        where: { meetingId, type: { in: ["BILLING_PUBLISHED", "PAYMENT_VERIFIED"] } },
      }),
    ]);
    return NextResponse.json({ id: meetingId, settlementOpen: false, action: requestedAction });
  }

  if (requestedAction !== "publish") {
    return NextResponse.json({ error: "지원하지 않는 청구 작업입니다." }, { status: 400 });
  }

  const readiness = await getScopedBillingReadiness(scope);
  if (!readiness) return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  if (!readiness.ready) {
    return NextResponse.json({
      error: "청구 공개 준비가 완료되지 않았습니다.",
      readiness,
    }, { status: 409 });
  }

  const [data, settings, existingSnapshot] = await Promise.all([
    getAdminSettlementData(meetingId),
    getAdminSettingsFormData(),
    prisma.meetingBillingSnapshot.findUnique({ where: { meetingId }, select: { revision: true } }),
  ]);
  if (!data) return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });

  const { payload: snapshotPayload, totals } = buildMeetingBillingSnapshot(data);
  const publishedAt = new Date();
  const nextRevision = (existingSnapshot?.revision ?? 0) + 1;
  const publishedDateLabel = billingDateLabel(data);
  const notificationRows = snapshotPayload.recipients.map((recipient) => ({
    recipientKakaoId: recipient.recipientKakaoId,
    type: "BILLING_PUBLISHED",
    meetingId,
    title: `${publishedDateLabel} 청구 내역이 공개되었습니다`,
    body: `낼 금액 ${recipient.totalFee.toLocaleString("ko-KR")}원`,
  }));

  const meeting = await prisma.$transaction(async (tx) => {
    await tx.meetingBillingSnapshot.upsert({
      where: { meetingId },
      create: {
        meetingId,
        revision: nextRevision,
        accountBankName: settings.settlementBankName || null,
        accountNumber: settings.settlementAccountNumber || null,
        accountHolder: settings.settlementAccountHolder || null,
        memberChargeTotal: totals.memberChargeTotal,
        shopPayableTotal: totals.shopPayableTotal,
        foodPayableTotal: totals.foodPayableTotal,
        clubSupportTotal: totals.clubSupportTotal,
        data: snapshotPayload as unknown as Prisma.InputJsonValue,
        publishedAt,
        publishedByKakaoId: actorKakaoId,
      },
      update: {
        revision: nextRevision,
        accountBankName: settings.settlementBankName || null,
        accountNumber: settings.settlementAccountNumber || null,
        accountHolder: settings.settlementAccountHolder || null,
        memberChargeTotal: totals.memberChargeTotal,
        shopPayableTotal: totals.shopPayableTotal,
        foodPayableTotal: totals.foodPayableTotal,
        clubSupportTotal: totals.clubSupportTotal,
        data: snapshotPayload as unknown as Prisma.InputJsonValue,
        publishedAt,
        publishedByKakaoId: actorKakaoId,
      },
    });
    await tx.settlementConfirmation.deleteMany({ where: { meetingId } });
    await tx.userNotification.deleteMany({ where: { meetingId, type: "BILLING_PUBLISHED" } });
    if (notificationRows.length > 0) await tx.userNotification.createMany({ data: notificationRows });
    await tx.meeting.updateMany({
      where: { id: { in: [...scope.meetingIds] } },
      data: {
        settlementOpen: true,
        billingPublishedAt: publishedAt,
        billingPublishedByKakaoId: actorKakaoId,
        billingCorrectionReason: null,
      },
    });
    return tx.meeting.findUniqueOrThrow({ where: { id: meetingId } });
  });

  return NextResponse.json({
    id: meeting.id,
    settlementOpen: meeting.settlementOpen,
    action: requestedAction,
    revision: nextRevision,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const requestedMeetingId = Number(id);
  if (!Number.isInteger(requestedMeetingId)) {
    return NextResponse.json({ error: "잘못된 모임 ID입니다." }, { status: 400 });
  }
  const scope = await getBillingMeetingScope(requestedMeetingId);
  if (!scope) return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  const meetingId = scope.canonicalMeetingId;

  const publications = await prisma.meeting.findMany({
    where: { id: { in: [...scope.meetingIds] } },
    select: { settlementOpen: true, billingReviewConfirmedAt: true },
  });
  if (publications.some((publication) => publication.settlementOpen)) {
    return NextResponse.json({ error: "공개된 청구는 정정 절차를 시작한 뒤 수정할 수 있습니다." }, { status: 409 });
  }
  if (publications.some((publication) => publication.billingReviewConfirmedAt)) {
    return NextResponse.json({ error: "청구 검토 완료를 취소한 뒤 조정할 수 있습니다." }, { status: 409 });
  }

  const body: unknown = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if ("action" in body && body.action === "batch-lodging") {
    const participantIds = "participantIds" in body && Array.isArray(body.participantIds)
      ? Array.from(new Set(body.participantIds.map(Number).filter(Number.isInteger)))
      : [];
    const label = "label" in body && typeof body.label === "string" ? body.label.trim().slice(0, 60) : "";
    const amount = "amount" in body ? Number(body.amount) : Number.NaN;
    if (participantIds.length === 0 || !label || !Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: "숙박 이용 회원, 항목명, 0원보다 큰 금액이 필요합니다." }, { status: 400 });
    }
    const participants = await prisma.participant.findMany({
      where: {
        id: { in: participantIds },
        meetingId,
        status: "APPROVED",
        usesClubLodging: true,
      },
      select: { id: true },
    });
    if (participants.length !== participantIds.length) {
      return NextResponse.json({ error: "선택한 숙박 이용 회원을 다시 확인해 주세요." }, { status: 409 });
    }
    const adjustments = await prisma.$transaction(async (tx) => {
      await tx.participantChargeAdjustment.createMany({
        data: participantIds.map((participantId) => ({ meetingId, participantId, label, amount })),
      });
      await tx.settlementConfirmation.deleteMany({ where: { meetingId } });
      return tx.participantChargeAdjustment.findMany({
        where: { meetingId, participantId: { in: participantIds }, label, amount },
        orderBy: { createdAt: "desc" },
        take: participantIds.length,
      });
    });
    return NextResponse.json({ adjustments }, { status: 201 });
  }

  const participantId = "participantId" in body ? Number(body.participantId) : Number.NaN;
  const label = "label" in body ? String(body.label ?? "").trim() : "";
  const amount = "amount" in body ? Number(body.amount) : Number.NaN;

  if (!Number.isInteger(participantId) || !label || !Number.isInteger(amount)) {
    return NextResponse.json({ error: "participantId, label, amount가 필요합니다." }, { status: 400 });
  }

  const participant = await prisma.participant.findFirst({
    where: {
      id: participantId,
      meetingId,
      status: "APPROVED",
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "청구할 참가자를 찾지 못했습니다." }, { status: 404 });
  }

  const adjustment = await prisma.participantChargeAdjustment.create({
    data: {
      meetingId,
      participantId,
      label,
      amount,
    },
  });

  await prisma.settlementConfirmation.deleteMany({
    where: { meetingId },
  });

  return NextResponse.json(adjustment, { status: 201 });
}
