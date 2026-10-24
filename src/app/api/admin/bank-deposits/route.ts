import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSessionPayload } from "@/lib/session";
import {
  DepositMatchError,
  addManualDeposit,
  applyDepositMatch,
  autoMatchPendingDeposits,
  getBankDepositDashboard,
  registerBankWebhookDevice,
  revokeBankWebhookDevice,
  undoDepositMatch,
} from "@/lib/bank-deposits";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function positiveInt(value: unknown): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export async function GET() {
  if (!(await isAdminAuthenticated())) return error("Unauthorized", 401);
  return NextResponse.json(await getBankDepositDashboard());
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) return error("Unauthorized", 401);

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  const actorKakaoId = (await getSessionPayload())?.kakaoId ?? "password-admin";
  const depositId = positiveInt(body.depositId);

  try {
    switch (body.action) {
      case "match": {
        if (!depositId || !Array.isArray(body.targets)) return error("입금과 청구를 선택해 주세요.");
        const targets = body.targets.flatMap((target: unknown) => {
          const item = target as Record<string, unknown>;
          const meetingId = positiveInt(item?.meetingId);
          return meetingId && typeof item.recipientKakaoId === "string"
            ? [{ meetingId, recipientKakaoId: item.recipientKakaoId }]
            : [];
        });
        await applyDepositMatch({
          depositId,
          targets,
          actorKakaoId,
          rememberDepositorName: body.remember === true,
          allowOverpayment: body.allowOverpayment === true,
        });
        break;
      }
      case "undo":
        if (!depositId) return error("입금을 선택해 주세요.");
        await undoDepositMatch(depositId);
        break;
      case "ignore":
        if (!depositId) return error("입금을 선택해 주세요.");
        await prisma.bankDeposit.updateMany({
          where: { id: depositId, status: { in: ["UNMATCHED", "REVIEW"] } },
          data: { status: "IGNORED" },
        });
        break;
      case "restore":
        if (!depositId) return error("입금을 선택해 주세요.");
        await prisma.bankDeposit.updateMany({
          where: { id: depositId, status: "IGNORED", amount: { not: null } },
          data: { status: "REVIEW" },
        });
        break;
      case "delete":
        // 청구 확인에 쓰인 적 없는, 정산과 무관하거나 읽지 못한 알림만 지운다.
        if (!depositId) return error("입금을 선택해 주세요.");
        await prisma.bankDeposit.deleteMany({
          where: { id: depositId, status: { in: ["IGNORED", "UNPARSED"] }, confirmations: { none: {} } },
        });
        break;
      case "add-manual": {
        const name = typeof body.depositorName === "string" ? body.depositorName.trim() : "";
        const amount = positiveInt(body.amount);
        if (!name || !amount) return error("입금자명과 금액을 입력해 주세요.");
        await addManualDeposit(name, amount);
        break;
      }
      case "rematch":
        await autoMatchPendingDeposits();
        break;
      case "delete-alias": {
        const aliasId = positiveInt(body.aliasId);
        if (!aliasId) return error("삭제할 입금자명을 선택해 주세요.");
        await prisma.depositorAlias.deleteMany({ where: { id: aliasId } });
        break;
      }
      case "register-device": {
        const label = typeof body.label === "string" ? body.label.trim().slice(0, 30) : "";
        if (!label) return error("폰 이름을 입력해 주세요.");
        return NextResponse.json({ token: await registerBankWebhookDevice(label), dashboard: await getBankDepositDashboard() });
      }
      case "revoke-device": {
        const deviceId = positiveInt(body.deviceId);
        if (!deviceId) return error("연결을 끊을 폰을 선택해 주세요.");
        await revokeBankWebhookDevice(deviceId);
        break;
      }
      default:
        return error("알 수 없는 요청입니다.");
    }
  } catch (caught) {
    if (caught instanceof DepositMatchError) return error(caught.message, 409);
    throw caught;
  }

  return NextResponse.json({ dashboard: await getBankDepositDashboard() });
}
