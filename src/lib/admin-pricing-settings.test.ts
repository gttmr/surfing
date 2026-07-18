import assert from "node:assert/strict";
import test from "node:test";
import {
  validatePricingDraft,
  validateSettingsDraft,
} from "@/lib/admin-pricing-settings";
import type { AdminPricingState, AdminSettingsFormData } from "@/lib/admin-page-data";
import { DEFAULT_PRICING_SETTINGS, PRICING_SETTING_KEYS } from "@/lib/settings";

const validPricing = {
  [PRICING_SETTING_KEYS.regularBaseFee]: "0",
  [PRICING_SETTING_KEYS.companionBaseFee]: "10000",
  [PRICING_SETTING_KEYS.regularLessonFee]: "20000",
  [PRICING_SETTING_KEYS.companionLessonFee]: "30000",
  [PRICING_SETTING_KEYS.regularRentalFee]: "40000",
  [PRICING_SETTING_KEYS.companionRentalFee]: "50000",
  foodOrderSupportCap: "10000",
} satisfies AdminPricingState;

const validSettings = {
  penaltyMessage: "취소 안내",
  penaltyDays: "2",
  participantOptionPricingGuide: "참가 옵션 안내",
  settlementBankName: "합성은행",
  settlementAccountNumber: "000-0000",
  settlementAccountHolder: "합성클럽",
} satisfies AdminSettingsFormData;

test("default pricing keeps the regular lesson fee at the current policy", () => {
  assert.equal(DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.regularLessonFee], "10000");
});

test("pricing validation rejects empty, non-numeric, negative, and unsafe amounts", () => {
  const cases = [
    { value: "", message: "금액을 입력해 주세요." },
    { value: "1e3", message: "숫자만 입력해 주세요." },
    { value: "-1", message: "0원 이상으로 입력해 주세요." },
    { value: "3002399751580331", message: "금액이 너무 큽니다." },
  ] as const;

  for (const item of cases) {
    const result = validatePricingDraft({ ...validPricing, foodOrderSupportCap: item.value });
    assert.equal(result.valid, false);
    if (!result.valid) assert.equal(result.errors.foodOrderSupportCap, item.message);
  }
});

test("pricing validation normalizes supported numeric strings", () => {
  const result = validatePricingDraft({ ...validPricing, foodOrderSupportCap: "010,000" });
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.value.foodOrderSupportCap, "10000");
});

test("settings validation enforces current day bounds and complete optional account details", () => {
  const outOfRange = validateSettingsDraft({ ...validSettings, penaltyDays: "31" });
  assert.equal(outOfRange.valid, false);
  if (!outOfRange.valid) assert.equal(outOfRange.errors.penaltyDays, "0일부터 30일 사이로 입력해 주세요.");

  const partialAccount = validateSettingsDraft({ ...validSettings, settlementBankName: "" });
  assert.equal(partialAccount.valid, false);
  if (!partialAccount.valid) assert.equal(partialAccount.errors.settlementBankName, "은행명을 입력해 주세요.");

  const emptyAccount = validateSettingsDraft({
    ...validSettings,
    settlementBankName: "   ",
    settlementAccountNumber: "\t",
    settlementAccountHolder: "\n",
  });
  assert.equal(emptyAccount.valid, true);
  if (emptyAccount.valid) {
    assert.equal(emptyAccount.value.settlementBankName, "");
    assert.equal(emptyAccount.value.settlementAccountNumber, "");
    assert.equal(emptyAccount.value.settlementAccountHolder, "");
  }
});

test("settings validation trims account details before validating and returning the payload", () => {
  const partialAccount = validateSettingsDraft({
    ...validSettings,
    settlementBankName: "  합성은행  ",
    settlementAccountNumber: "   ",
    settlementAccountHolder: "  합성클럽  ",
  });
  assert.equal(partialAccount.valid, false);
  if (!partialAccount.valid) {
    assert.equal(partialAccount.errors.settlementAccountNumber, "계좌번호를 입력해 주세요.");
  }

  const completeAccount = validateSettingsDraft({
    ...validSettings,
    settlementBankName: "  합성은행  ",
    settlementAccountNumber: "  000-0000  ",
    settlementAccountHolder: "  합성클럽  ",
  });
  assert.equal(completeAccount.valid, true);
  if (completeAccount.valid) {
    assert.equal(completeAccount.value.settlementBankName, "합성은행");
    assert.equal(completeAccount.value.settlementAccountNumber, "000-0000");
    assert.equal(completeAccount.value.settlementAccountHolder, "합성클럽");
  }
});
