import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "../../scripts/qa/local-db";
import { POST as createCompanion } from "../../src/app/api/companions/route";
import { POST as createSignup } from "../../src/app/api/participants/route";
import { prisma } from "../../src/lib/db";
import { encodeSession } from "../../src/lib/session";

function authenticatedRequest(path: string, kakaoId: string, nickname: string, body: unknown) {
  const token = encodeSession({ kakaoId, nickname });
  return new NextRequest(`http://127.0.0.1:3100${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `__session=${token}` },
    body: JSON.stringify(body),
  });
}

test("companion creation repairs an occupied id sequence in signup and profile flows", async () => {
  const ownerToken = process.env.SURFING_QA_OWNER_TOKEN ?? "";
  const evidenceDirectory = process.env.EVIDENCE_DIR ?? "";
  const client = new PrismaClient();
  try {
    await db.start(ownerToken);
    await db.reset(ownerToken, evidenceDirectory);

    await client.$executeRaw`SELECT setval(pg_get_serial_sequence('"Companion"', 'id'), 8702, false)`;
    const signupResponse = await createSignup(authenticatedRequest(
      "/api/participants",
      "qa-user-01",
      "합성 회원 01",
      {
        meetingId: 8104,
        name: "합성 회원 01",
        hasLesson: false,
        hasBus: true,
        hasRental: false,
        companionIds: [],
        companionOptions: {},
        newCompanions: [{ name: "신규 합성 동반인", hasLesson: false, hasBus: true, hasRental: false }],
      },
    ));
    assert.equal(signupResponse.status, 201);
    const signupBody = await signupResponse.json() as { id: number; companions: Array<{ companionId: number }> };
    assert.equal(signupBody.companions.length, 1);
    assert.equal(await client.participant.count({ where: { meetingId: 8104, kakaoId: "qa-user-01" } }), 2);

    const recoveredCompanion = await client.companion.findFirstOrThrow({
      where: { ownerKakaoId: "qa-user-01", name: "신규 합성 동반인" },
      select: { id: true },
    });
    assert.equal(recoveredCompanion.id, 8703);

    await client.$executeRaw`SELECT setval(pg_get_serial_sequence('"Companion"', 'id'), ${recoveredCompanion.id}, false)`;
    const profileResponse = await createCompanion(authenticatedRequest(
      "/api/companions",
      "qa-user-01",
      "합성 회원 01",
      { name: "프로필 신규 동반인" },
    ));
    assert.equal(profileResponse.status, 201);
    const profileBody = await profileResponse.json() as { id: number; name: string };
    assert.equal(profileBody.id, 8704);
    assert.equal(profileBody.name, "프로필 신규 동반인");
  } finally {
    await Promise.all([client.$disconnect(), prisma.$disconnect()]);
    await db.down(ownerToken);
  }
});
