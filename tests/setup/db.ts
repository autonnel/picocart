// Test DB helpers. Uses TEST_DATABASE_URL (or falls back to DATABASE_URL)
// against an isolated Postgres database. Tests skip themselves if no test
// connection is available so the suite stays runnable in environments
// without a database.

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const TEST_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';

let _client: PrismaClient | null = null;
let _checked = false;
let _available = false;

export function getTestPrisma(): PrismaClient {
  if (_client) return _client;
  if (!TEST_URL) {
    throw new Error('No TEST_DATABASE_URL / DATABASE_URL set');
  }
  const pool = new pg.Pool({ connectionString: TEST_URL });
  const adapter = new PrismaPg(pool);
  _client = new PrismaClient({ adapter });
  return _client;
}

export async function isDbAvailable(): Promise<boolean> {
  if (_checked) return _available;
  _checked = true;
  if (!TEST_URL) {
    _available = false;
    return false;
  }
  try {
    const client = getTestPrisma();
    await client.$queryRaw`SELECT 1`;
    _available = true;
  } catch {
    _available = false;
  }
  return _available;
}

export async function resetDb(prisma: PrismaClient): Promise<void> {
  // Order matters: respect FK constraints by clearing leaves first.
  await prisma.orderRefund.deleteMany();
  await prisma.orderLineItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.variantPrice.deleteMany();
  await prisma.variantOption.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
}
