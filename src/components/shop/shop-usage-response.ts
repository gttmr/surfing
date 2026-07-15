import type { ShopMeetingSurfUsageData } from "@/lib/surf-usage-data";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isServiceType(value: unknown): boolean {
  return value === "LESSON_PACKAGE"
    || value === "EQUIPMENT_RENTAL"
    || value === "WETSUIT_ONLY"
    || value === "SHOWER"
    || value === "CUSTOM";
}

function isUsageItem(value: unknown): boolean {
  return isRecord(value)
    && typeof value.id === "number"
    && typeof value.name === "string"
    && isNullableString(value.description)
    && isServiceType(value.serviceType)
    && typeof value.shopPrice === "number"
    && typeof value.isDefault === "boolean"
    && typeof value.isActive === "boolean"
    && typeof value.displayOrder === "number";
}

function isUsageEntry(value: unknown): boolean {
  return isRecord(value)
    && typeof value.id === "number"
    && typeof value.usageItemId === "number"
    && typeof value.usageItemName === "string"
    && isServiceType(value.serviceType)
    && typeof value.quantity === "number"
    && typeof value.shopUnitPrice === "number"
    && typeof value.amount === "number"
    && typeof value.source === "string";
}

function isParticipant(value: unknown): boolean {
  return isRecord(value)
    && typeof value.participantId === "number"
    && typeof value.participantName === "string"
    && (value.companionId === null || typeof value.companionId === "number")
    && typeof value.requestedOptionLabel === "string"
    && (value.submissionStatus === "missing"
      || value.submissionStatus === "submitted"
      || value.submissionStatus === "confirmed")
    && isNullableString(value.submittedAt)
    && isNullableString(value.confirmedAt)
    && typeof value.shopAmount === "number"
    && Array.isArray(value.entries)
    && value.entries.every(isUsageEntry);
}

function isItemRow(value: unknown): boolean {
  return isRecord(value)
    && typeof value.usageItemId === "number"
    && typeof value.name === "string"
    && isServiceType(value.serviceType)
    && typeof value.quantity === "number"
    && typeof value.amount === "number"
    && typeof value.confirmedQuantity === "number"
    && typeof value.confirmedAmount === "number";
}

function isMeeting(value: unknown): boolean {
  return isRecord(value)
    && typeof value.id === "number"
    && typeof value.date === "string"
    && typeof value.startTime === "string"
    && typeof value.endTime === "string"
    && typeof value.location === "string";
}

function isSummary(value: unknown): boolean {
  return isRecord(value)
    && typeof value.approvedCount === "number"
    && typeof value.submittedCount === "number"
    && typeof value.missingCount === "number"
    && typeof value.reviewCount === "number"
    && typeof value.confirmedCount === "number"
    && typeof value.submittedShopAmount === "number"
    && typeof value.confirmedShopAmount === "number";
}

export function isShopMeetingSurfUsageData(value: unknown): value is ShopMeetingSurfUsageData {
  return isRecord(value)
    && isMeeting(value.meeting)
    && isSummary(value.summary)
    && Array.isArray(value.usageItems)
    && value.usageItems.every(isUsageItem)
    && Array.isArray(value.itemRows)
    && value.itemRows.every(isItemRow)
    && Array.isArray(value.participantRows)
    && value.participantRows.every(isParticipant);
}

export function shopUsageErrorMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}
