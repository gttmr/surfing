import assert from "node:assert/strict";
import test from "node:test";
import { decodeSession, encodeSession } from "./session";

test("session tokens round-trip and reject tampering", () => {
  const token = encodeSession({ kakaoId: "qa-user", nickname: "QA 회원" });
  assert.deepEqual(decodeSession(token), { kakaoId: "qa-user", nickname: "QA 회원" });

  const [payload, signature] = token.split(".");
  assert.equal(decodeSession(`${payload}x.${signature}`), null);
  assert.equal(decodeSession(`${payload}.${signature}x`), null);
});

test("session signing fails closed without SESSION_SECRET", () => {
  const original = process.env.SESSION_SECRET;
  delete process.env.SESSION_SECRET;
  try {
    assert.throws(
      () => encodeSession({ kakaoId: "qa-user", nickname: "QA 회원" }),
      /SESSION_SECRET is required/,
    );
  } finally {
    if (original === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = original;
  }
});
