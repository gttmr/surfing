import type { AdminSettlementData, AdminSettlementRecipient } from "@/lib/admin-page-data";
import { AdminMeetingSettlementRecipientAccordion } from "./AdminMeetingSettlementRecipientAccordion";
import type {
  AdjustmentDeleteTarget,
  SettlementDraft,
  SettlementDraftChange,
} from "./admin-meeting-settlement-types";

function recipientKey(recipient: AdminSettlementRecipient): string {
  return `${recipient.recipientKakaoId}-${recipient.recipientType}`;
}

function RecipientSection({
  title,
  recipients,
  data,
  selectedRecipientKey,
  showAmounts,
  drafts,
  submittingFor,
  onToggle,
  onDraftChange,
  onAddAdjustment,
  onRequestDelete,
}: {
  readonly title: string;
  readonly recipients: readonly AdminSettlementRecipient[];
  readonly data: AdminSettlementData;
  readonly selectedRecipientKey: string | null;
  readonly showAmounts: boolean;
  readonly drafts: Readonly<Record<number, SettlementDraft>>;
  readonly submittingFor: number | null;
  readonly onToggle: (key: string) => void;
  readonly onDraftChange: SettlementDraftChange;
  readonly onAddAdjustment: (participantId: number) => void;
  readonly onRequestDelete: (target: NonNullable<AdjustmentDeleteTarget>) => void;
}) {
  if (recipients.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <h3 className="text-sm font-extrabold text-[var(--brand-text)]">{title}</h3>
        <span className="brand-text-subtle text-xs font-bold">{recipients.length}명</span>
      </div>
      {recipients.map((recipient) => {
        const key = recipientKey(recipient);
        const participantIds = new Set(recipient.items.map((item) => item.participantId));
        const participants = data.participants.filter((participant) => participantIds.has(participant.id));
        return (
          <AdminMeetingSettlementRecipientAccordion
            key={key}
            recipient={recipient}
            participants={participants}
            expanded={selectedRecipientKey === key}
            showAmounts={showAmounts}
            drafts={drafts}
            submittingFor={submittingFor}
            onToggle={() => onToggle(key)}
            onDraftChange={onDraftChange}
            onAddAdjustment={onAddAdjustment}
            onRequestDelete={onRequestDelete}
          />
        );
      })}
    </section>
  );
}

export function AdminMeetingSettlementRecipients({
  data,
  selectedRecipientKey,
  showAmounts,
  drafts,
  submittingFor,
  onToggle,
  onDraftChange,
  onAddAdjustment,
  onRequestDelete,
}: {
  readonly data: AdminSettlementData;
  readonly selectedRecipientKey: string | null;
  readonly showAmounts: boolean;
  readonly drafts: Readonly<Record<number, SettlementDraft>>;
  readonly submittingFor: number | null;
  readonly onToggle: (key: string) => void;
  readonly onDraftChange: SettlementDraftChange;
  readonly onAddAdjustment: (participantId: number) => void;
  readonly onRequestDelete: (target: NonNullable<AdjustmentDeleteTarget>) => void;
}) {
  const pendingRecipients = data.recipients.filter((recipient) => !recipient.completed);
  const completedRecipients = data.recipients.filter((recipient) => recipient.completed);

  if (data.recipients.length === 0) {
    return (
      <div className="brand-panel-white rounded-3xl px-5 py-10 text-center" role="status">
        <p className="text-sm font-bold text-[var(--brand-text)]">정산 수신자가 없습니다.</p>
        <p className="brand-text-subtle mt-1 text-xs">참가자 정산 정보가 준비되면 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RecipientSection
        title="정산 대기"
        recipients={pendingRecipients}
        data={data}
        selectedRecipientKey={selectedRecipientKey}
        showAmounts={showAmounts}
        drafts={drafts}
        submittingFor={submittingFor}
        onToggle={onToggle}
        onDraftChange={onDraftChange}
        onAddAdjustment={onAddAdjustment}
        onRequestDelete={onRequestDelete}
      />
      <RecipientSection
        title="송금 완료"
        recipients={completedRecipients}
        data={data}
        selectedRecipientKey={selectedRecipientKey}
        showAmounts={showAmounts}
        drafts={drafts}
        submittingFor={submittingFor}
        onToggle={onToggle}
        onDraftChange={onDraftChange}
        onAddAdjustment={onAddAdjustment}
        onRequestDelete={onRequestDelete}
      />
    </div>
  );
}
