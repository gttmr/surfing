export type ProfileDraftComparison = {
  readonly avatarDraftPending: boolean;
  readonly draftCompanionId: number | null;
  readonly draftName: string;
  readonly draftPhoneNumber: string;
  readonly persistedCompanionId: number | null;
  readonly persistedName: string;
  readonly persistedPhoneNumber: string;
};

export function isProfileDraftDirty(comparison: ProfileDraftComparison): boolean {
  return comparison.draftName !== comparison.persistedName
    || comparison.draftPhoneNumber !== comparison.persistedPhoneNumber
    || comparison.draftCompanionId !== comparison.persistedCompanionId
    || comparison.avatarDraftPending;
}
