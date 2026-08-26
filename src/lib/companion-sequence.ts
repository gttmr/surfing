import { Prisma } from "@prisma/client";

function isCompanionIdConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes("id") : target === "id";
}

export async function createCompanionWithRecoveredSequence(
  tx: Prisma.TransactionClient,
  data: Prisma.CompanionUncheckedCreateInput,
) {
  await tx.$executeRaw`SAVEPOINT companion_id_sp`;
  try {
    const result = await tx.companion.create({ data });
    await tx.$executeRaw`RELEASE SAVEPOINT companion_id_sp`;
    return result;
  } catch (error) {
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT companion_id_sp`;
    if (!isCompanionIdConflict(error)) throw error;
    await tx.$queryRaw`
      SELECT setval(
        pg_get_serial_sequence('"Companion"', 'id'),
        COALESCE((SELECT MAX(id) FROM "Companion"), 0) + 1,
        false
      )
    `;
    return tx.companion.create({ data });
  }
}
