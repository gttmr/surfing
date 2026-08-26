import { Icon } from "@/components/ui/Icon";
import { formatRelativeTimeKo, formatWon } from "@/lib/format";
import type { ShopMeetingSurfUsageData } from "@/lib/surf-usage-data";
import {
  SHOP_USAGE_STATUS_LABELS,
  hasShopUsageVariance,
  type ShopUsageDrafts,
  type ShopUsageParticipant,
} from "./shop-usage-review";

const STATUS_CLASS = {
  missing: "brand-chip-danger",
  submitted: "brand-chip-soft",
  confirmed: "brand-chip-success",
} as const satisfies Record<ShopUsageParticipant["submissionStatus"], string>;

export type ShopUsageActionError = {
  readonly action: "save" | "confirm";
  readonly message: string;
  readonly participantId: number;
};

type UsageItem = ShopMeetingSurfUsageData["usageItems"][number];
type UsageEntry = ShopMeetingSurfUsageData["participantRows"][number]["entries"][number];

function ReadOnlyUsage({ entries }: {
  readonly entries: readonly UsageEntry[];
}) {
  const usedEntries = entries.filter((entry) => entry.quantity > 0);
  if (usedEntries.length === 0) {
    return <p className="brand-text-subtle px-4 py-5 text-center text-xs">기록된 이용 항목이 없습니다.</p>;
  }
  return (
    <dl className="divide-y divide-brand-divider">
      {usedEntries.map((entry) => (
        <div className="flex items-center justify-between gap-3 px-4 py-3" key={entry.id}>
          <dt className="min-w-0 text-sm font-semibold text-brand-text">{entry.usageItemName}</dt>
          <dd className="shrink-0 text-sm font-extrabold text-brand-text">
            {entry.quantity}개 · {formatWon(entry.amount)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function UsageEditor({ items, onQuantityChange, participant, values }: {
  readonly items: readonly UsageItem[];
  readonly onQuantityChange: (participantId: number, usageItemId: number, quantity: number) => void;
  readonly participant: ShopUsageParticipant;
  readonly values: ShopUsageDrafts[number];
}) {
  return (
    <div className="divide-y divide-brand-divider">
      {items.map((item) => {
        const quantity = values[item.id] ?? 0;
        return (
          <div className="flex items-center justify-between gap-3 px-4 py-3" key={item.id}>
            <div className="min-w-0">
              <p className="text-sm font-bold text-brand-text">{item.name}</p>
              <p className="brand-text-subtle mt-0.5 text-[11px]">{formatWon(item.shopPrice)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                aria-label={`${participant.participantName} ${item.name} 수량 줄이기`}
                className="brand-button-secondary flex h-11 w-11 items-center justify-center rounded-full"
                disabled={quantity === 0}
                onClick={() => onQuantityChange(participant.participantId, item.id, quantity - 1)}
                type="button"
              >
                <Icon className="text-[20px]" name="remove" />
              </button>
              <output
                aria-label={`${participant.participantName} ${item.name} 수량`}
                className="w-8 text-center text-sm font-extrabold tabular-nums text-brand-text"
              >
                {quantity}
              </output>
              <button
                aria-label={`${participant.participantName} ${item.name} 수량 늘리기`}
                className="brand-button-secondary flex h-11 w-11 items-center justify-center rounded-full"
                disabled={quantity === 20}
                onClick={() => onQuantityChange(participant.participantId, item.id, quantity + 1)}
                type="button"
              >
                <Icon className="text-[20px]" name="add" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ShopUsageParticipantRow({
  actionError,
  dirty,
  items,
  lockedAction,
  onConfirm,
  onQuantityChange,
  onSave,
  onToggle,
  open,
  participant,
  values,
}: {
  readonly actionError: ShopUsageActionError | null;
  readonly dirty: boolean;
  readonly items: readonly UsageItem[];
  readonly lockedAction: "save" | "confirm" | null;
  readonly onConfirm: (participantId: number) => void;
  readonly onQuantityChange: (participantId: number, usageItemId: number, quantity: number) => void;
  readonly onSave: (participantId: number) => void;
  readonly onToggle: (participantId: number) => void;
  readonly open: boolean;
  readonly participant: ShopUsageParticipant;
  readonly values: ShopUsageDrafts[number];
}) {
  const confirmed = participant.submissionStatus === "confirmed";
  const canSave = !confirmed && lockedAction === null && (dirty || participant.submissionStatus === "missing");
  const canConfirm = participant.submissionStatus === "submitted" && !dirty && lockedAction === null;
  const submittedAt = participant.submittedAt ? formatRelativeTimeKo(participant.submittedAt) : null;
  const hasVariance = hasShopUsageVariance(participant);
  const actualUsageLabel = items
    .filter((item) => (values[item.id] ?? 0) > 0)
    .map((item) => `${item.name} ${values[item.id]}`)
    .join(" · ") || "이용 없음";
  const draftShopAmount = items.reduce(
    (total, item) => total + item.shopPrice * (values[item.id] ?? 0),
    0
  );

  return (
    <article className={`brand-panel-white overflow-hidden rounded-[1.6rem] ${open ? "brand-list-item-active" : ""}`} data-participant-id={participant.participantId}>
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => onToggle(participant.participantId)}
        type="button"
      >
        <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${participant.submissionStatus === "confirmed" ? "brand-status-dot-success" : participant.submissionStatus === "submitted" ? "brand-status-dot-info" : "brand-status-dot-dimmed"}`} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-extrabold text-brand-text">{participant.participantName}</span>
            <span className={`${STATUS_CLASS[participant.submissionStatus]} rounded-full px-2 py-0.5 text-[10px] font-bold`}>
              {SHOP_USAGE_STATUS_LABELS[participant.submissionStatus]}
            </span>
            {dirty ? <span className="brand-chip-preparing rounded-full px-2 py-0.5 text-[10px] font-bold">저장 안 됨</span> : null}
            {hasVariance ? <span className="brand-chip-danger rounded-full px-2 py-0.5 text-[10px] font-bold">예정과 다름</span> : null}
          </span>
          <span className="brand-text-subtle mt-1 block truncate text-xs">
            이용 예정 {participant.requestedOptionLabel}{submittedAt ? ` · ${submittedAt}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="brand-text-subtle block text-[10px] font-bold">샵 청구 예정</span>
          <span className="block text-sm font-extrabold text-brand-text">{formatWon(dirty ? draftShopAmount : participant.shopAmount)}</span>
          <Icon className={`mt-1 text-[20px] text-brand-text-subtle ${open ? "rotate-180" : ""}`} name="expand_more" />
        </span>
      </button>

      {open ? (
        <div className="border-t border-brand-divider">
          <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1 bg-brand-primary-soft px-4 py-3 text-xs">
            <dt className="brand-text-subtle font-semibold">이용 예정</dt>
            <dd className="font-bold text-brand-text">{participant.requestedOptionLabel}</dd>
            <dt className="brand-text-subtle font-semibold">실제 이용</dt>
            <dd className="font-bold text-brand-text">{actualUsageLabel}</dd>
          </dl>
          {confirmed ? (
            <ReadOnlyUsage entries={participant.entries} />
          ) : (
            <UsageEditor items={items} onQuantityChange={onQuantityChange} participant={participant} values={values} />
          )}

          {actionError ? (
            <div className="brand-alert-error mx-4 mb-3 rounded-2xl px-3 py-2 text-xs" role="alert">
              <p className="font-bold">{actionError.action === "save" ? "저장 실패" : "확정 실패"}</p>
              <p className="mt-0.5">{actionError.message}</p>
            </div>
          ) : null}

          {!confirmed ? (
            <div className="border-t border-brand-divider px-4 py-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="brand-button-secondary rounded-2xl px-3 py-3 text-sm font-bold"
                  disabled={!canSave}
                  onClick={() => onSave(participant.participantId)}
                  type="button"
                >
                  {lockedAction === "save" ? "저장 중…" : "저장"}
                </button>
                <button
                  className="brand-button-confirm rounded-2xl px-3 py-3 text-sm font-bold disabled:opacity-50"
                  disabled={!canConfirm}
                  onClick={() => onConfirm(participant.participantId)}
                  type="button"
                >
                  {lockedAction === "confirm" ? "확정 중…" : "확정"}
                </button>
              </div>
              {!canConfirm && lockedAction === null ? (
                <p className="brand-text-subtle mt-2 text-center text-[11px]">
                  {participant.submissionStatus === "missing" ? "미제출 내역은 먼저 저장해 주세요." : dirty ? "변경을 저장하면 확정할 수 있습니다." : ""}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="brand-chip-dimmed border-t border-brand-divider px-4 py-3 text-center text-xs font-bold">확정된 내역은 읽기 전용입니다.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}
