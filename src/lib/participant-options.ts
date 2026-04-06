export type ParticipantOptionInput = {
  hasLesson?: boolean;
  hasBus?: boolean;
  hasRental?: boolean;
};

export type ParticipantOptionState = {
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
};

export class InvalidParticipantOptionsError extends Error {
  constructor() {
    super("강습+장비대여와 장비 대여만은 동시에 선택할 수 없습니다.");
  }
}

export function normalizeParticipantOptions(
  input: ParticipantOptionInput,
): ParticipantOptionState {
  const normalized = {
    hasLesson: !!input.hasLesson,
    hasBus: !!input.hasBus,
    hasRental: !!input.hasRental,
  };

  if (normalized.hasLesson && normalized.hasRental) {
    throw new InvalidParticipantOptionsError();
  }

  return normalized;
}
