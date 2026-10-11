// 은행 앱 입금 알림 문구에서 입금자명과 금액을 추출한다.
// 은행/버전마다 문구가 달라 원문은 항상 따로 보관하고, 여기서는 최대한 보수적으로 해석한다.

export type ParsedDepositNotification =
  | { readonly kind: "deposit"; readonly depositorName: string | null; readonly amount: number }
  | { readonly kind: "ignored"; readonly reason: "outgoing" }
  | { readonly kind: "unparsed" };

const OUTGOING_PATTERN = /출금|결제|님에게|에게\s*보냈|이체\s*완료|자동이체/;
const INCOMING_PATTERN = /입금|님이\s*.*보냈|받았|들어왔/;
const BALANCE_PATTERN = /잔액\s*[:：]?\s*[\d,]+\s*원/g;
const AMOUNT_PATTERN = /(\d{1,3}(?:,\d{3})+|\d+)\s*원/;
const NAME_STOPWORDS = new Set([
  "입금", "입금자", "원", "토스", "토스뱅크", "통장", "모임통장", "계좌", "잔액", "내", "님", "알림", "받았어요", "들어왔어요",
]);

function cleanName(value: string | undefined): string | null {
  const name = value?.replace(/님$/, "").trim();
  if (!name || name.length < 2 || name.length > 20 || NAME_STOPWORDS.has(name)) return null;
  return name;
}

function extractName(text: string): string | null {
  const patterns = [
    /([^\s|·→:：]+?)\s*님이/, // 홍길동님이 50,000원을 보냈어요
    /([^\s|·→:：]+)\s*→/, // 홍길동 → 모임통장
    /입금자(?:명)?\s*[:：]?\s*([^\s|·→]+)/, // 입금자: 홍길동
  ];
  for (const pattern of patterns) {
    const name = cleanName(text.match(pattern)?.[1]);
    if (name) return name;
  }

  const withoutAmounts = text.replace(new RegExp(AMOUNT_PATTERN.source, "g"), " ");
  for (const token of withoutAmounts.split(/[\s|·→:：,()[\]]+/)) {
    if (/^[가-힣A-Za-z][가-힣A-Za-z0-9]*$/.test(token)) {
      const name = cleanName(token);
      if (name) return name;
    }
  }
  return null;
}

export function parseDepositNotification(title: string | null | undefined, text: string): ParsedDepositNotification {
  const full = `${title ?? ""}\n${text}`;
  const incoming = INCOMING_PATTERN.test(full);
  if (!incoming && OUTGOING_PATTERN.test(full)) return { kind: "ignored", reason: "outgoing" };
  if (!incoming) return { kind: "unparsed" };

  const withoutBalance = full.replace(BALANCE_PATTERN, " ");
  const amountMatch = withoutBalance.match(AMOUNT_PATTERN);
  if (!amountMatch) return { kind: "unparsed" };
  const amount = Number(amountMatch[1].replace(/,/g, ""));
  if (!Number.isSafeInteger(amount) || amount <= 0) return { kind: "unparsed" };

  return { kind: "deposit", depositorName: extractName(withoutBalance), amount };
}
