import { Prisma } from "@prisma/client";

function isParticipantIdConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes("id") : target === "id";
}

export async function createParticipantWithRecoveredSequence(
  tx: Prisma.TransactionClient,
  data: Prisma.ParticipantUncheckedCreateInput,
) {
  await tx.$executeRaw`SAVEPOINT participant_id_sp`;
  try {
    const result = await tx.participant.create({ data });
    await tx.$executeRaw`RELEASE SAVEPOINT participant_id_sp`;
    return result;
  } catch (error) {
    // ROLLBACK TO SAVEPOINT는 트랜잭션을 aborted 상태에서 복구시킴
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT participant_id_sp`;
    if (!isParticipantIdConflict(error)) throw error;
    // 동일 tx 안에서 MAX(id)를 읽으면 이전에 insert한 미커밋 행도 포함됨
    await tx.$queryRaw`
      SELECT setval(
        pg_get_serial_sequence('"Participant"', 'id'),
        COALESCE((SELECT MAX(id) FROM "Participant"), 0) + 1,
        false
      )
    `;
    return tx.participant.create({ data });
  }
}

export async function repairParticipantIdSequence(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`
    SELECT setval(
      pg_get_serial_sequence('"Participant"', 'id'),
      COALESCE((SELECT MAX(id) FROM "Participant"), 0) + 1,
      false
    )
  `;
}
