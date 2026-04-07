import { Prisma } from "@prisma/client";

async function resetParticipantIdSequence(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`
    SELECT setval(
      pg_get_serial_sequence('"Participant"', 'id'),
      COALESCE((SELECT MAX(id) FROM "Participant"), 0) + 1,
      false
    )
  `;
}

function isParticipantIdConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;

  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("id");
  }

  return target === "id";
}

export async function createParticipantWithRecoveredSequence(
  tx: Prisma.TransactionClient,
  data: Prisma.ParticipantUncheckedCreateInput,
) {
  try {
    return await tx.participant.create({ data });
  } catch (error) {
    if (!isParticipantIdConflict(error)) {
      throw error;
    }

    await resetParticipantIdSequence(tx);
    return tx.participant.create({ data });
  }
}

export async function repairParticipantIdSequence(tx: Prisma.TransactionClient) {
  await resetParticipantIdSequence(tx);
}
