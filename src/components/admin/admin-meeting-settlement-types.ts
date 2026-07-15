export type SettlementDraft = {
  readonly label: string;
  readonly amount: string;
};

export type AdjustmentDeleteTarget = {
  readonly id: number;
  readonly label: string;
  readonly participantName: string;
} | null;

export type SettlementDraftChange = (
  participantId: number,
  field: keyof SettlementDraft,
  value: string
) => void;
