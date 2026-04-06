import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

const SERIALIZABLE_RETRY_LIMIT = 2;

export async function runSerializableTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  client: PrismaClient = prisma,
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await client.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const shouldRetry =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < SERIALIZABLE_RETRY_LIMIT;

      if (!shouldRetry) {
        throw error;
      }
    }
  }
}
