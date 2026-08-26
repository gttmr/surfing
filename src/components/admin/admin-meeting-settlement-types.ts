export type SettlementDraft = {
  readonly label: string;
  readonly amount: string;
  readonly direction: "increase" | "deduct";
};

export type AdjustmentDeleteTarget = {
  readonly id: number;
  readonly label: string;
  readonly participantName: string;
} | null;

export type SettlementDraftChange = (
  participantId: number,
  change: Partial<SettlementDraft>
) => void;
