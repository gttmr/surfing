import type { AdminMeetingDetail, AdminMeetingParticipant } from "@/lib/admin-page-data";

function nullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isParticipant(value: unknown): value is AdminMeetingParticipant {
  return typeof value === "object" && value !== null
    && "id" in value && typeof value.id === "number"
    && "name" in value && typeof value.name === "string"
    && "kakaoId" in value && typeof value.kakaoId === "string"
    && "kakaoNickname" in value && typeof value.kakaoNickname === "string"
    && "profileImage" in value && nullableString(value.profileImage)
    && "note" in value && nullableString(value.note)
    && "hasLesson" in value && typeof value.hasLesson === "boolean"
    && "hasBus" in value && typeof value.hasBus === "boolean"
    && "hasRental" in value && typeof value.hasRental === "boolean"
    && "status" in value && typeof value.status === "string"
    && "waitlistPosition" in value && (typeof value.waitlistPosition === "number" || value.waitlistPosition === null)
    && "isPenalized" in value && typeof value.isPenalized === "boolean"
    && "cancelledAt" in value && nullableString(value.cancelledAt)
    && "submittedAt" in value && typeof value.submittedAt === "string"
    && "companionId" in value && (typeof value.companionId === "number" || value.companionId === null);
}

export function isAdminMeetingDetail(value: unknown): value is AdminMeetingDetail {
  return typeof value === "object" && value !== null
    && "id" in value && typeof value.id === "number"
    && "date" in value && typeof value.date === "string"
    && "startTime" in value && typeof value.startTime === "string"
    && "endTime" in value && typeof value.endTime === "string"
    && "location" in value && typeof value.location === "string"
    && "description" in value && nullableString(value.description)
    && "isOpen" in value && typeof value.isOpen === "boolean"
    && "meetingType" in value && typeof value.meetingType === "string"
    && "participants" in value && Array.isArray(value.participants) && value.participants.every(isParticipant)
    && "approvedCount" in value && typeof value.approvedCount === "number";
}

export async function meetingResponseError(response: Response, fallback: string): Promise<string> {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
      ? value.error
      : fallback;
  } catch (error) {
    if (error instanceof SyntaxError) return fallback;
    throw error;
  }
}
