import { NextRequest, NextResponse } from "next/server";
import { authenticateBankWebhookDevice, ingestDepositNotification } from "@/lib/bank-deposits";

// 정산 계좌 폰(안드로이드)의 자동화 앱이 은행 입금 알림을 전달하는 웹훅.
// 인증: Authorization: Bearer <토큰> 또는 X-Webhook-Token 헤더. 토큰은 /admin/deposits 에서 폰마다 발급한다.
// 여러 폰이 같은 알림을 보내도 3분 안의 같은 문구는 한 건으로 저장된다.
// 본문: JSON 또는 form 형식의 { title, text, time? }. time 은 epoch ms 또는 ISO 문자열.

const MAX_BODY_BYTES = 8 * 1024;
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

function readToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  return req.headers.get("x-webhook-token")?.trim() || null;
}

function parseTime(value: unknown): Date {
  const now = Date.now();
  const raw = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  const time = typeof raw === "number" || typeof raw === "string" ? new Date(raw).getTime() : Number.NaN;
  return Number.isFinite(time) && Math.abs(time - now) <= MAX_CLOCK_SKEW_MS ? new Date(time) : new Date(now);
}

async function readFields(req: NextRequest): Promise<Record<string, unknown> | null> {
  const body = await req.text();
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) return null;
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const parsed: unknown = JSON.parse(body);
      return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(body));
  }
  return { text: body };
}

export async function POST(req: NextRequest) {
  const deviceId = await authenticateBankWebhookDevice(readToken(req));
  if (!deviceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fields = await readFields(req);
  if (!fields) return NextResponse.json({ error: "본문을 읽을 수 없습니다." }, { status: 400 });

  const title = typeof fields.title === "string" ? fields.title.trim() : null;
  const text = typeof fields.text === "string" ? fields.text.trim() : "";
  if (!text && !title) return NextResponse.json({ error: "알림 내용이 비어 있습니다." }, { status: 400 });

  const result = await ingestDepositNotification({ title: title || null, text, depositedAt: parseTime(fields.time), deviceId });
  return NextResponse.json({ ok: true, result });
}
