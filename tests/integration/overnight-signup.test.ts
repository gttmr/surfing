import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "../../scripts/qa/local-db";
import { POST as createSignup } from "../../src/app/api/participants/route";
import { addDaysToDate } from "../../src/lib/meeting-days";
import { getTodayInSeoul } from "../../src/lib/date";
import { prisma } from "../../src/lib/db";
import { encodeSession } from "../../src/lib/session";

function signupRequest(meetingId: number) {
  const token = encodeSession({ kakaoId: "qa-user-01", nickname: "합성 회원 01" });
  return new NextRequest("http://127.0.0.1:3100/api/participants", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `__session=${token}` },
    body: JSON.stringify({
      meetingId,
      name: "합성 회원 01",
      note: "1박2일 신청",
      hasLesson: true,
      hasBus: true,
      hasRental: false,
      day2HasRental: true,
      usesClubLodging: true,
      companionIds: [],
      companionOptions: {},
      newCompanions: [{
        name: "1박 동반인",
        hasLesson: false,
        hasBus: true,
        hasRental: true,
        day2HasRental: false,
        usesClubLodging: true,
      }],
    }),
  });
}

test("overnight signup creates one row per person with day-two rental and lodging", async () => {
  const ownerToken = process.env.SURFING_QA_OWNER_TOKEN ?? "";
  const evidenceDirectory = process.env.EVIDENCE_DIR ?? "";
  const client = new PrismaClient();
  try {
    await db.start(ownerToken);
    await db.reset(ownerToken, evidenceDirectory);
    const startDate = addDaysToDate(getTodayInSeoul(), 10);
    const meeting = await client.meeting.create({
      data: {
        date: startDate,
        endDate: addDaysToDate(startDate, 1),
        startTime: "07:00",
        endTime: "16:00",
        location: "QA 해변",
        regularFee: 60_000,
        companionFee: 75_000,
        lodgingFee: 50_000,
      },
    });

    const response = await createSignup(signupRequest(meeting.id));
    assert.equal(response.status, 201);
    const rows = await client.participant.findMany({
      where: { meetingId: meeting.id, kakaoId: "qa-user-01" },
      orderBy: { companionId: "asc" },
    });
    assert.equal(rows.length, 2);

    const self = rows.find((row) => row.companionId === null);
    assert.ok(self);
    assert.equal(self.hasLesson, true);
    assert.equal(self.hasRental, false);
    assert.equal(self.hasDay2Rental, true);
    assert.equal(self.usesClubLodging, true);

    const companion = rows.find((row) => row.companionId !== null);
    assert.ok(companion);
    assert.equal(companion.hasRental, true);
    assert.equal(companion.hasDay2Rental, false);
    assert.equal(companion.usesClubLodging, true);

    const duplicate = await createSignup(signupRequest(meeting.id));
    assert.equal(duplicate.status, 409);
    assert.equal(await client.participant.count({ where: { meetingId: meeting.id, kakaoId: "qa-user-01" } }), 2);
  } finally {
    await Promise.all([client.$disconnect(), prisma.$disconnect()]);
    await db.down(ownerToken);
  }
});
