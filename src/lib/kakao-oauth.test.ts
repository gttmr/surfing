import assert from "node:assert/strict";
import test from "node:test";
import { resolveKakaoAuthOrigin, resolveKakaoRedirectUri } from "@/lib/kakao-oauth";

const CALLBACK_PATH = "/api/auth/kakao/callback";

test("production requests refuse a configured loopback Kakao callback", () => {
  assert.equal(
    resolveKakaoRedirectUri(
      "https://sdssurfing.vercel.app",
      `http://localhost:3001${CALLBACK_PATH}`,
    ),
    `https://sdssurfing.vercel.app${CALLBACK_PATH}`,
  );
  assert.equal(
    resolveKakaoAuthOrigin(
      "https://sdssurfing.vercel.app",
      `http://localhost:3001${CALLBACK_PATH}`,
    ),
    "https://sdssurfing.vercel.app",
  );
});

test("local requests retain an explicitly configured local Kakao callback", () => {
  assert.equal(
    resolveKakaoRedirectUri(
      "http://127.0.0.1:3100",
      `http://localhost:3001${CALLBACK_PATH}`,
    ),
    `http://localhost:3001${CALLBACK_PATH}`,
  );
});

test("production requests retain a valid non-loopback Kakao callback", () => {
  assert.equal(
    resolveKakaoRedirectUri(
      "https://sdssurfing.vercel.app",
      `https://surfing.example.com${CALLBACK_PATH}`,
    ),
    `https://surfing.example.com${CALLBACK_PATH}`,
  );
});

test("missing or invalid configuration falls back to the request origin", () => {
  const expected = `https://sdssurfing.vercel.app${CALLBACK_PATH}`;
  assert.equal(resolveKakaoRedirectUri("https://sdssurfing.vercel.app", undefined), expected);
  assert.equal(resolveKakaoRedirectUri("https://sdssurfing.vercel.app", "not a URL"), expected);
});
