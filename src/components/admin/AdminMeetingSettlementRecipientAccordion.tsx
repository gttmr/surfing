import { Icon } from "@/components/ui/Icon";
import type { AdminSettlementParticipant, AdminSettlementRecipient } from "@/lib/admin-page-data";
import { formatWon } from "@/lib/format";
import { AdminMeetingSettlementParticipant } from "./AdminMeetingSettlementParticipant";
import type {
  AdjustmentDeleteTarget,
  SettlementDraft,
  SettlementDraftChange,
} from "./admin-meeting-settlement-types";

export function AdminMeetingSettlementRecipientAccordion({
  recipient,
  participants,
  expanded,
  showAmounts,
  editable,
  drafts,
  submittingFor,
  onToggle,
  onDraftChange,
  onAddAdjustment,
  onRequestDelete,
}: {
  readonly recipient: AdminSettlementRecipient;
  readonly participants: readonly AdminSettlementParticipant[];
  readonly expanded: boolean;
  readonly showAmounts: boolean;
  readonly editable: boolean;
  readonly drafts: Readonly<Record<number, SettlementDraft>>;
  readonly submittingFor: number | null;
  readonly onToggle: () => void;
  readonly onDraftChange: SettlementDraftChange;
  readonly onAddAdjustment: (participantId: number) => void;
  readonly onRequestDelete: (target: NonNullable<AdjustmentDeleteTarget>) => void;
}) {
  const detailsId = `settlement-recipient-${recipient.recipientKakaoId}-${recipient.recipientType}`;

  return (
    <article className="brand-panel-white overflow-hidden rounded-3xl">
      <button
        type="button"
        aria-controls={detailsId}
        aria-expanded={expanded}
        onClick={onToggle}
        className="w-full p-4 text-left transition-colors hover:bg-brand-primary-soft"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-bold text-brand-text">{recipient.recipientName}</p>
              <span className="brand-chip-soft shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">청구 대상</span>
            </div>
            <p className="brand-text-subtle mt-1 text-xs">
              {showAmounts ? `${recipient.items.length}명 참가분` : "금액 비공개"}
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <span className="text-sm font-extrabold text-brand-text">
              {showAmounts ? formatWon(recipient.totalFee) : "금액 비공개"}
            </span>
            <Icon className="mt-0.5 text-[20px] text-brand-text-subtle" name={expanded ? "expand_less" : "expand_more"} />
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-brand-divider px-4 pb-4 pt-4" id={detailsId}>
          {!showAmounts ? <p className="brand-text-muted mb-4 text-xs">청구 준비 중 · 금액 비공개</p> : null}
          <div className="divide-y divide-brand-divider">
            {participants.map((participant, index) => (
              <div key={participant.id} className={index === 0 ? "" : "pt-5"}>
                <AdminMeetingSettlementParticipant
                  participant={participant}
                  showAmounts={showAmounts}
                  editable={editable}
                  draft={drafts[participant.id] ?? { label: "", amount: "", direction: "increase" }}
                  submitting={submittingFor === participant.id}
                  onDraftChange={onDraftChange}
                  onAddAdjustment={onAddAdjustment}
                  onRequestDelete={onRequestDelete}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
