import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "../../scripts/qa/local-db";
import { POST as createOvernightSignup } from "../../src/app/api/participants/overnight/route";
import { addDaysToDate } from "../../src/lib/meeting-group";
import { getTodayInSeoul } from "../../src/lib/date";
import { prisma } from "../../src/lib/db";
import { encodeSession } from "../../src/lib/session";

function signupRequest(meetingId: number) {
  const token = encodeSession({ kakaoId: "qa-user-01", nickname: "합성 회원 01" });
  return new NextRequest("http://127.0.0.1:3100/api/participants/overnight", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `__session=${token}` },
    body: JSON.stringify({
      meetingId,
      name: "합성 회원 01",
      note: "1박2일 통합 신청",
      hasLesson: true,
      hasBus: true,
      hasRental: false,
      day2HasRental: true,
      usesClubLodging: true,
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

test("overnight signup atomically creates one person and companion on both linked dates", async () => {
  const ownerToken = process.env.SURFING_QA_OWNER_TOKEN ?? "";
  const evidenceDirectory = process.env.EVIDENCE_DIR ?? "";
  const client = new PrismaClient();
  try {
    await db.start(ownerToken);
    await db.reset(ownerToken, evidenceDirectory);
    const day1Date = addDaysToDate(getTodayInSeoul(), 10);
    const day2Date = addDaysToDate(day1Date, 1);
    const group = await client.meetingGroup.create({
      data: {
        kind: "OVERNIGHT",
        regularBaseFee: 35_000,
        companionBaseFee: 45_000,
        lodgingFee: 50_000,
        meetings: {
          create: [
            { date: day1Date, startTime: "07:00", endTime: "22:00", location: "QA 해변", groupDayIndex: 1 },
            { date: day2Date, startTime: "08:00", endTime: "16:00", location: "QA 해변", groupDayIndex: 2 },
          ],
        },
      },
      include: { meetings: { orderBy: { groupDayIndex: "asc" } } },
    });
    const [day1, day2] = group.meetings;

    const response = await createOvernightSignup(signupRequest(day1.id));
    assert.equal(response.status, 201);
    const rows = await client.participant.findMany({
      where: { meetingId: { in: [day1.id, day2.id] }, kakaoId: "qa-user-01" },
      orderBy: [{ companionId: "asc" }, { meetingId: "asc" }],
    });
    assert.equal(rows.length, 4);

    const selfDay1 = rows.find((row) => row.meetingId === day1.id && row.companionId === null);
    const selfDay2 = rows.find((row) => row.meetingId === day2.id && row.companionId === null);
    assert.ok(selfDay1);
    assert.ok(selfDay2);
    assert.equal(selfDay1.hasLesson, true);
    assert.equal(selfDay1.hasRental, false);
    assert.equal(selfDay2.hasLesson, false);
    assert.equal(selfDay2.hasRental, true);
    assert.equal(selfDay1.usesClubLodging, true);
    assert.equal(selfDay2.usesClubLodging, true);

    const companionRows = rows.filter((row) => row.companionId !== null);
    assert.equal(companionRows.length, 2);
    assert.equal(companionRows.every((row) => row.usesClubLodging), true);
    assert.equal(companionRows.find((row) => row.meetingId === day1.id)?.hasRental, true);
    assert.equal(companionRows.find((row) => row.meetingId === day2.id)?.hasRental, false);

    const duplicate = await createOvernightSignup(signupRequest(day2.id));
    assert.equal(duplicate.status, 409);
    assert.equal(await client.participant.count({ where: { meetingId: { in: [day1.id, day2.id] }, kakaoId: "qa-user-01" } }), 4);
  } finally {
    await Promise.all([client.$disconnect(), prisma.$disconnect()]);
    await db.down(ownerToken);
  }
});
