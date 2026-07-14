import test from "node:test";
import assert from "node:assert/strict";
import { isProfileDraftDirty, type ProfileDraftComparison } from "./profile-draft";

const unchangedProfile = {
  avatarDraftPending: false,
  draftCompanionId: null,
  draftName: "합성 회원",
  draftPhoneNumber: "010-0000-0000",
  persistedCompanionId: null,
  persistedName: "합성 회원",
  persistedPhoneNumber: "010-0000-0000",
} satisfies ProfileDraftComparison;

test("a staged avatar keeps the profile dirty until explicit save or discard", () => {
  assert.equal(isProfileDraftDirty({ ...unchangedProfile, avatarDraftPending: true }), true);
});

test("an unchanged profile is not dirty", () => {
  assert.equal(isProfileDraftDirty(unchangedProfile), false);
});
