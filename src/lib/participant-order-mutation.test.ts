import assert from "node:assert/strict";
import test from "node:test";
import {
  getParticipantOrderConflict,
  parseParticipantOrderMutation,
  resolveParticipantOrderReplacements,
  type ParticipantOrderCatalogMenu,
  type ParticipantOrderSibling,
} from "./participant-order-mutation";

const UPDATED_AT = "2026-07-15T01:02:03.000Z";

const menus: ParticipantOrderCatalogMenu[] = [
  {
    id: 1,
    name: "해장국",
    price: 8_000,
    optionGroupName: null,
    isActive: true,
    options: [],
  },
  {
    id: 2,
    name: "라면",
    price: 5_000,
    optionGroupName: "맵기",
    isActive: true,
    options: [
      { id: 21, label: "보통", price: 5_000 },
      { id: 22, label: "매움", price: 5_500 },
    ],
  },
  {
    id: 3,
    name: "판매 종료",
    price: 4_000,
    optionGroupName: null,
    isActive: false,
    options: [],
  },
];

function siblings(overrides: Partial<ParticipantOrderSibling> = {}): ParticipantOrderSibling[] {
  return [
    {
      id: 101,
      updatedAt: UPDATED_AT,
      cancelledAt: null,
      preparingQuantity: 0,
      servedQuantity: 0,
      ...overrides,
    },
  ];
}

test("participant order mutation parser accepts only the exact replace and cancel contracts", () => {
  assert.deepEqual(
    parseParticipantOrderMutation("PATCH", {
      replacementItems: [{ menuItemId: 1, optionChoiceId: null, quantity: 2 }],
      expectedItems: [{ id: 101, updatedAt: UPDATED_AT }],
    }),
    {
      ok: true,
      value: {
        kind: "replace",
        replacementItems: [{ menuItemId: 1, optionChoiceId: null, quantity: 2 }],
        expectedItems: [{ id: 101, updatedAt: UPDATED_AT }],
      },
    },
  );
  assert.deepEqual(
    parseParticipantOrderMutation("DELETE", {
      expectedItems: [{ id: 101, updatedAt: UPDATED_AT }],
    }),
    {
      ok: true,
      value: {
        kind: "cancel",
        expectedItems: [{ id: 101, updatedAt: UPDATED_AT }],
      },
    },
  );
});

test("participant order mutation parser rejects malformed, duplicate, and extra values", () => {
  const invalidBodies: Array<["PATCH" | "DELETE", unknown]> = [
    ["PATCH", { replacementItems: [], expectedItems: [] }],
    ["PATCH", { replacementItems: [{ menuItemId: 1, optionChoiceId: null, quantity: 0 }], expectedItems: [] }],
    ["PATCH", { replacementItems: [{ menuItemId: 1, optionChoiceId: null, quantity: 1, extra: true }], expectedItems: [] }],
    ["PATCH", { replacementItems: [{ menuItemId: 1, optionChoiceId: null, quantity: 1 }], expectedItems: [], extra: true }],
    ["PATCH", { replacementItems: [{ menuItemId: 1, optionChoiceId: null, quantity: 1 }, { menuItemId: 1, optionChoiceId: null, quantity: 2 }], expectedItems: [] }],
    ["PATCH", { replacementItems: [{ menuItemId: 1, optionChoiceId: null, quantity: 1 }], expectedItems: [{ id: 101, updatedAt: "July 15" }] }],
    ["DELETE", { expectedItems: [{ id: 101, updatedAt: UPDATED_AT }, { id: 101, updatedAt: UPDATED_AT }] }],
    ["DELETE", { expectedItems: [{ id: -1, updatedAt: UPDATED_AT }] }],
    ["DELETE", { expectedItems: [], extra: true }],
  ];

  for (const [method, body] of invalidBodies) {
    assert.deepEqual(parseParticipantOrderMutation(method, body), { ok: false });
  }
});

test("replacement resolver preserves current catalog snapshots", () => {
  assert.deepEqual(
    resolveParticipantOrderReplacements(
      [
        { menuItemId: 1, optionChoiceId: null, quantity: 2 },
        { menuItemId: 2, optionChoiceId: 22, quantity: 1 },
      ],
      menus,
    ),
    [
      {
        menuItemId: 1,
        menuOptionChoiceId: null,
        menuNameSnapshot: "해장국",
        optionGroupNameSnapshot: null,
        optionChoiceLabelSnapshot: null,
        unitPriceSnapshot: 8_000,
        quantity: 2,
      },
      {
        menuItemId: 2,
        menuOptionChoiceId: 22,
        menuNameSnapshot: "라면",
        optionGroupNameSnapshot: "맵기",
        optionChoiceLabelSnapshot: "매움",
        unitPriceSnapshot: 5_500,
        quantity: 1,
      },
    ],
  );
});

test("replacement resolver rejects unknown, inactive, missing, and foreign options", () => {
  const invalid = [
    [{ menuItemId: 99, optionChoiceId: null, quantity: 1 }],
    [{ menuItemId: 3, optionChoiceId: null, quantity: 1 }],
    [{ menuItemId: 2, optionChoiceId: null, quantity: 1 }],
    [{ menuItemId: 1, optionChoiceId: 21, quantity: 1 }],
    [{ menuItemId: 2, optionChoiceId: 999, quantity: 1 }],
  ];
  for (const replacement of invalid) {
    assert.equal(resolveParticipantOrderReplacements(replacement, menus), null);
  }
});

test("participant order conflict precedence is closed, non-editable, then stale", () => {
  const stale = [{ id: 101, updatedAt: "2026-07-15T02:00:00.000Z" }];
  assert.equal(
    getParticipantOrderConflict(siblings({ cancelledAt: UPDATED_AT }), stale, false),
    "ORDER_NOT_OPEN",
  );
  assert.equal(
    getParticipantOrderConflict(siblings({ preparingQuantity: 1 }), stale, true),
    "ORDER_NOT_EDITABLE",
  );
  assert.equal(getParticipantOrderConflict(siblings(), stale, true), "ORDER_VERSION_CONFLICT");
});

test("participant order versions require the complete exact sibling set", () => {
  const current = [
    ...siblings(),
    { ...siblings()[0], id: 102, updatedAt: "2026-07-15T01:02:04.000Z" },
  ];
  assert.equal(
    getParticipantOrderConflict(current, [{ id: 101, updatedAt: UPDATED_AT }], true),
    "ORDER_VERSION_CONFLICT",
  );
  assert.equal(
    getParticipantOrderConflict(current, [
      { id: 101, updatedAt: UPDATED_AT },
      { id: 102, updatedAt: "2026-07-15T01:02:04.000Z" },
    ], true),
    null,
  );
});
