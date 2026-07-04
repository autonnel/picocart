// Wires the test Prisma client into the global slot the production
// db.ts looks at, so repository imports work without modification.
import { getTestPrisma, isDbAvailable } from './db';
import type { PrismaClient } from '@prisma/client';

export async function installTestPrisma(): Promise<PrismaClient | null> {
  const ok = await isDbAvailable();
  if (!ok) return null;
  const client = getTestPrisma();
  (globalThis as unknown as { prisma: PrismaClient }).prisma = client;
  return client;
}
