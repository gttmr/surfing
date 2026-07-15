import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogSummary,
  countCatalogChanges,
  createCatalogDraft,
  searchCatalog,
  type SearchFocus,
} from "./food-menu-editor";
import { validateCatalog } from "./food-menu-editor-validation";
import type { AdminFoodMenuSettingsData } from "./food-ordering-data";

const INITIAL_DATA: AdminFoodMenuSettingsData = {
  categories: [{
    id: 1,
    name: "음료",
    displayOrder: 0,
    menus: [{
      id: 10,
      categoryId: 1,
      categoryName: "음료",
      categoryDisplayOrder: 0,
      name: "아메리카노",
      price: 4_000,
      optionGroupName: "온도",
      options: [
        { id: 100, label: "ICE", price: 4_500, displayOrder: 0 },
        { id: 101, label: "HOT", price: 4_000, displayOrder: 1 },
      ],
      isActive: true,
      displayOrder: 0,
    }],
  }],
};

test("catalog validation rejects malformed prices without coercing them", () => {
  const initial = createCatalogDraft(INITIAL_DATA);
  const category = initial[0];
  const menu = category?.menus[0];
  const option = menu?.options[0];
  assert.ok(category && menu && option);
  const invalid = [{
    ...category,
    menus: [{ ...menu, options: [{ ...option, price: "4천원" }, ...menu.options.slice(1)] }],
  }];

  assert.deepEqual(validateCatalog(invalid), {
    valid: false,
    categoryKey: category.key,
    fieldId: `option-price-${option.key}`,
    message: "옵션 가격은 0 이상의 정수로 입력해 주세요.",
  });
});

test("catalog validation preserves the existing nested API payload", () => {
  const result = validateCatalog(createCatalogDraft(INITIAL_DATA));
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(result.payload.categories[0]?.menus[0], {
    id: 10,
    name: "아메리카노",
    price: 4_500,
    optionGroupName: "온도",
    options: [
      { id: 100, label: "ICE", price: 4_500 },
      { id: 101, label: "HOT", price: 4_000 },
    ],
    isActive: true,
  });
});

test("catalog validation rejects broken category and option references", () => {
  const initial = createCatalogDraft(INITIAL_DATA);
  const category = initial[0];
  const menu = category?.menus[0];
  const option = menu?.options[0];
  assert.ok(category && menu && option);

  const wrongCategory = [{ ...category, menus: [{ ...menu, categoryKey: "missing-category" }] }];
  assert.equal(validateCatalog(wrongCategory).valid, false);
  const wrongOption = [{
    ...category,
    menus: [{ ...menu, options: [{ ...option, menuKey: "missing-menu" }, ...menu.options.slice(1)] }],
  }];
  assert.equal(validateCatalog(wrongOption).valid, false);
});

test("dirty count counts each changed, added, or removed row once", () => {
  const saved = createCatalogDraft(INITIAL_DATA);
  const category = saved[0];
  const menu = category?.menus[0];
  assert.ok(category && menu);
  const current = [{
    ...category,
    name: "커피",
    menus: [{ ...menu, name: "아이스 아메리카노", options: menu.options.slice(1) }],
  }];
  assert.equal(countCatalogChanges(saved, current), 3);
});

test("search covers category, menu, and stable option-as-variant labels", () => {
  const draft = createCatalogDraft(INITIAL_DATA);
  assert.equal(searchCatalog(draft, "음료").length, 1);
  assert.equal(searchCatalog(draft, "아메리카노")[0]?.menus.length, 1);
  assert.equal(searchCatalog(draft, "HOT")[0]?.menus[0]?.options[0]?.label, "HOT");
  assert.deepEqual(catalogSummary(draft), {
    categoryCount: 1,
    menuCount: 1,
    activeMenuCount: 1,
    activeVariantCount: 2,
  });
});

const FOCUSED_SEARCH_CASES: readonly {
  readonly name: string;
  readonly query: string;
  readonly focus: SearchFocus;
  readonly rename: (draft: ReturnType<typeof createCatalogDraft>) => ReturnType<typeof createCatalogDraft>;
  readonly expectedMenuCount: number;
  readonly expectedOptionCount: number;
}[] = [
  {
    name: "category",
    query: "음료",
    focus: { kind: "category", key: "category-1" },
    rename: (draft) => draft.map((category) => ({ ...category, name: "차" })),
    expectedMenuCount: 0,
    expectedOptionCount: 0,
  },
  {
    name: "menu",
    query: "아메리카노",
    focus: { kind: "menu", key: "menu-10" },
    rename: (draft) => draft.map((category) => ({
      ...category,
      menus: category.menus.map((menu) => ({ ...menu, name: "라테" })),
    })),
    expectedMenuCount: 1,
    expectedOptionCount: 0,
  },
  {
    name: "option",
    query: "ICE",
    focus: { kind: "option", key: "option-100" },
    rename: (draft) => draft.map((category) => ({
      ...category,
      menus: category.menus.map((menu) => ({
        ...menu,
        options: menu.options.map((option) => (
          option.key === "option-100" ? { ...option, label: "차갑게" } : option
        )),
      })),
    })),
    expectedMenuCount: 1,
    expectedOptionCount: 1,
  },
];

for (const searchCase of FOCUSED_SEARCH_CASES) {
  test(`search retains only the focused ${searchCase.name} result after its matching name changes`, () => {
    const renamed = searchCase.rename(createCatalogDraft(INITIAL_DATA));

    const results = searchCatalog(renamed, searchCase.query, searchCase.focus);

    assert.equal(results.length, 1);
    assert.equal(results[0]?.menus.length, searchCase.expectedMenuCount);
    assert.equal(results[0]?.menus[0]?.options.length ?? 0, searchCase.expectedOptionCount);
    assert.equal(
      results[0]?.menus[0]?.options.some((option) => option.key === "option-101") ?? false,
      false
    );
  });
}
