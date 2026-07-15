export type ExpectedParticipantOrderItem = {
  readonly id: number;
  readonly updatedAt: string;
};

export type ParticipantOrderReplacementItem = {
  readonly menuItemId: number;
  readonly optionChoiceId: number | null;
  readonly quantity: number;
};

export type ParticipantOrderMutation =
  | {
      readonly kind: "replace";
      readonly replacementItems: readonly ParticipantOrderReplacementItem[];
      readonly expectedItems: readonly ExpectedParticipantOrderItem[];
    }
  | {
      readonly kind: "cancel";
      readonly expectedItems: readonly ExpectedParticipantOrderItem[];
    };

export type ParticipantOrderCatalogMenu = {
  readonly id: number;
  readonly name: string;
  readonly price: number;
  readonly optionGroupName: string | null;
  readonly isActive: boolean;
  readonly options: ReadonlyArray<{
    readonly id: number;
    readonly label: string;
    readonly price: number;
  }>;
};

export type ResolvedParticipantOrderReplacement = {
  readonly menuItemId: number;
  readonly menuOptionChoiceId: number | null;
  readonly menuNameSnapshot: string;
  readonly optionGroupNameSnapshot: string | null;
  readonly optionChoiceLabelSnapshot: string | null;
  readonly unitPriceSnapshot: number;
  readonly quantity: number;
};

export type ParticipantOrderSibling = {
  readonly id: number;
  readonly updatedAt: Date | string;
  readonly cancelledAt: Date | string | null;
  readonly preparingQuantity: number;
  readonly servedQuantity: number;
};

export type ParticipantOrderConflictCode =
  | "ORDER_NOT_OPEN"
  | "ORDER_NOT_EDITABLE"
  | "ORDER_VERSION_CONFLICT";

type ParseResult =
  | { readonly ok: true; readonly value: ParticipantOrderMutation }
  | { readonly ok: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isCanonicalIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function parseExpectedItems(value: unknown): ExpectedParticipantOrderItem[] | null {
  if (!Array.isArray(value)) return null;
  const result: ExpectedParticipantOrderItem[] = [];
  const ids = new Set<number>();
  for (const item of value) {
    if (!isRecord(item) || !hasExactKeys(item, ["id", "updatedAt"])) return null;
    if (!isPositiveInteger(item.id) || !isCanonicalIsoDate(item.updatedAt) || ids.has(item.id)) return null;
    ids.add(item.id);
    result.push({ id: item.id, updatedAt: item.updatedAt });
  }
  return result;
}

function parseReplacementItems(value: unknown): ParticipantOrderReplacementItem[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const result: ParticipantOrderReplacementItem[] = [];
  const variants = new Set<string>();
  for (const item of value) {
    if (!isRecord(item) || !hasExactKeys(item, ["menuItemId", "optionChoiceId", "quantity"])) return null;
    if (!isPositiveInteger(item.menuItemId) || !isPositiveInteger(item.quantity)) return null;
    if (item.optionChoiceId !== null && !isPositiveInteger(item.optionChoiceId)) return null;
    const variantKey = `${item.menuItemId}:${item.optionChoiceId ?? "none"}`;
    if (variants.has(variantKey)) return null;
    variants.add(variantKey);
    result.push({
      menuItemId: item.menuItemId,
      optionChoiceId: item.optionChoiceId,
      quantity: item.quantity,
    });
  }
  return result;
}

export function parseParticipantOrderMutation(method: "PATCH" | "DELETE", value: unknown): ParseResult {
  if (!isRecord(value)) return { ok: false };
  if (method === "DELETE") {
    if (!hasExactKeys(value, ["expectedItems"])) return { ok: false };
    const expectedItems = parseExpectedItems(value.expectedItems);
    return expectedItems ? { ok: true, value: { kind: "cancel", expectedItems } } : { ok: false };
  }

  if (!hasExactKeys(value, ["replacementItems", "expectedItems"])) return { ok: false };
  const replacementItems = parseReplacementItems(value.replacementItems);
  const expectedItems = parseExpectedItems(value.expectedItems);
  if (!replacementItems || !expectedItems) return { ok: false };
  return { ok: true, value: { kind: "replace", replacementItems, expectedItems } };
}

export function resolveParticipantOrderReplacements(
  replacements: readonly ParticipantOrderReplacementItem[],
  menus: readonly ParticipantOrderCatalogMenu[],
): ResolvedParticipantOrderReplacement[] | null {
  const menuById = new Map(menus.map((menu) => [menu.id, menu]));
  const resolved: ResolvedParticipantOrderReplacement[] = [];
  for (const replacement of replacements) {
    const menu = menuById.get(replacement.menuItemId);
    if (!menu?.isActive) return null;
    const hasOptions = menu.options.length > 0;
    const option = replacement.optionChoiceId === null
      ? null
      : menu.options.find((candidate) => candidate.id === replacement.optionChoiceId) ?? null;
    if ((hasOptions && !option) || (!hasOptions && replacement.optionChoiceId !== null)) return null;
    resolved.push({
      menuItemId: menu.id,
      menuOptionChoiceId: option?.id ?? null,
      menuNameSnapshot: menu.name,
      optionGroupNameSnapshot: option ? menu.optionGroupName : null,
      optionChoiceLabelSnapshot: option?.label ?? null,
      unitPriceSnapshot: option?.price ?? menu.price,
      quantity: replacement.quantity,
    });
  }
  return resolved;
}

export function getParticipantOrderConflict(
  siblings: readonly ParticipantOrderSibling[],
  expectedItems: readonly ExpectedParticipantOrderItem[],
  orderOpen: boolean,
): ParticipantOrderConflictCode | null {
  if (!orderOpen) return "ORDER_NOT_OPEN";
  if (
    siblings.length === 0
    || siblings.some((item) => item.cancelledAt !== null || item.preparingQuantity !== 0 || item.servedQuantity !== 0)
  ) {
    return "ORDER_NOT_EDITABLE";
  }

  const expectedById = new Map(expectedItems.map((item) => [item.id, item.updatedAt]));
  if (expectedById.size !== expectedItems.length || siblings.length !== expectedItems.length) {
    return "ORDER_VERSION_CONFLICT";
  }
  const exact = siblings.every((item) => {
    const updatedAt = item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt;
    return expectedById.get(item.id) === updatedAt;
  });
  return exact ? null : "ORDER_VERSION_CONFLICT";
}
