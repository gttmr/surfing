import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAdminSettingsFormData, getAdminSettlementData } from "@/lib/admin-page-data";
import { buildMeetingBillingSnapshot } from "@/lib/billing-snapshot";
import { getMeetingBillingReadiness } from "@/lib/meeting-readiness-data";
import { getSessionPayload } from "@/lib/session";
import { billingDateLabel, unverifyPaymentOperations, verifyPaymentOperations } from "@/lib/payment-verification";

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
  const meetingId = Number(id);
  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "잘못된 모임 ID입니다." }, { status: 400 });
  }
  const exists = await prisma.meeting.findUnique({ where: { id: meetingId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });

  const body: unknown = await req.json().catch(() => null);
  const payload = typeof body === "object" && body !== null ? body : {};
  const requestedAction = "action" in payload && typeof payload.action === "string" ? payload.action : null;
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
    if (!data.meeting.billingPublished) {
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
      await prisma.$transaction(await unverifyPaymentOperations(meetingId, recipientKakaoId));
    } else {
      await prisma.$transaction([
        ...verifyPaymentOperations({
          meetingId,
          recipientKakaoId,
          actorKakaoId,
          dateLabel: billingDateLabel(data.meeting),
          totalFee: recipient.totalFee,
        }),
      ]);
    }

    return NextResponse.json({ action: requestedAction, data: await getAdminSettlementData(meetingId) });
  }

  if (requestedAction === "record-payout") {
    // 장비와 식음료는 같은 샵에 한 번에 지급한다. 실제 지급한 합계를 기록한다.
    const amount = "amount" in payload ? Number(payload.amount) : Number.NaN;
    if (!Number.isInteger(amount) || amount < 0) {
      return NextResponse.json({ error: "0원 이상의 실제 지급액이 필요합니다." }, { status: 400 });
    }
    const current = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { billingPublishedAt: true },
    });
    if (!current?.billingPublishedAt) {
      return NextResponse.json({ error: "청구 공개 후 실제 지급액을 기록할 수 있습니다." }, { status: 409 });
    }
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { shopPaidAt: new Date(), shopPaidAmount: amount, settlementCompletedAt: null, settlementCompletedByKakaoId: null },
    });
    return NextResponse.json({ action: requestedAction, data: await getAdminSettlementData(meetingId) });
  }

  if (requestedAction === "complete-settlement") {
    const data = await getAdminSettlementData(meetingId);
    if (!data) return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
    if (!data.meeting.billingPublished) {
      return NextResponse.json({ error: "청구 공개 후 정산을 완료할 수 있습니다." }, { status: 409 });
    }
    const blockers = [
      data.verifiedRecipientCount < data.recipients.length ? "회원 입금 확인" : null,
      !data.billing.shopTotal.complete ? "샵 지급 기록" : null,
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

  if (requestedAction === "reopen") {
    const correctionReason = "correctionReason" in payload && typeof payload.correctionReason === "string"
      ? payload.correctionReason.trim().slice(0, 200)
      : "";
    if (!correctionReason) {
      return NextResponse.json({ error: "청구 정정 사유를 입력해 주세요." }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.meeting.update({
        where: { id: meetingId },
        data: {
          billingPublishedAt: null,
          billingPublishedByKakaoId: null,
          billingCorrectionReason: correctionReason,
          shopPaidAt: null,
          shopPaidAmount: null,
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
    return NextResponse.json({ id: meetingId, billingPublished: false, action: requestedAction });
  }

  if (requestedAction !== "publish") {
    return NextResponse.json({ error: "지원하지 않는 청구 작업입니다." }, { status: 400 });
  }

  const readiness = await getMeetingBillingReadiness(meetingId);
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
  const publishedDateLabel = billingDateLabel(data.meeting);
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
    await tx.meeting.update({
      where: { id: meetingId },
      data: {
        isOpen: false, // 청구를 공개하면 신청도 자동 마감한다.
        billingPublishedAt: publishedAt,
        billingPublishedByKakaoId: actorKakaoId,
        billingCorrectionReason: null,
      },
    });
    return tx.meeting.findUniqueOrThrow({ where: { id: meetingId } });
  });

  return NextResponse.json({
    id: meeting.id,
    billingPublished: meeting.billingPublishedAt !== null,
    action: requestedAction,
    revision: nextRevision,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = Number(id);
  if (!Number.isInteger(meetingId)) {
    return NextResponse.json({ error: "잘못된 모임 ID입니다." }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { billingPublishedAt: true },
  });
  if (!meeting) return NextResponse.json({ error: "모임을 찾을 수 없습니다." }, { status: 404 });
  if (meeting.billingPublishedAt) {
    return NextResponse.json({ error: "공개된 청구는 정정 절차를 시작한 뒤 수정할 수 있습니다." }, { status: 409 });
  }

  const body: unknown = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
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
