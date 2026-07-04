import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getEnv, getBinding, isCloudflareRuntime } from '@/lib/runtime/env';
import { createLogger } from '@/lib/logger';

const logger = createLogger('DB');

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var pgPool: any;
}

let _prisma: PrismaClient | null = null;

const _pg: any = isCloudflareRuntime()
  ? null
  : await import('pg').then((m) => m.default ?? m);

// Request-scoped PrismaClient for CF Workers; one client per request via
// AsyncLocalStorage. Hyperdrive handles connection pooling externally.
const _requestStore = new AsyncLocalStorage<{ prisma: PrismaClient | null }>();

function getPrisma(): PrismaClient {
  if (isCloudflareRuntime()) {
    const store = _requestStore.getStore();
    if (store?.prisma) return store.prisma;

    const hyperdrive = getBinding<{ connectionString: string }>('HYPERDRIVE');
    const connectionString = hyperdrive?.connectionString || getEnv('DATABASE_URL');
    if (!connectionString) throw new Error('No database connection string (HYPERDRIVE or DATABASE_URL)');
    const adapter = new PrismaPg({ connectionString });
    const client = new PrismaClient({ adapter });

    if (store) store.prisma = client;
    return client;
  }

  if (_prisma) return _prisma;
  if (globalThis.prisma) {
    _prisma = globalThis.prisma;
    return _prisma;
  }

  const connectionString = getEnv('DATABASE_URL');
  if (!connectionString) {
    logger.error('DATABASE_URL is not set');
    throw new Error('DATABASE_URL environment variable is required');
  }
  if (!globalThis.pgPool) {
    globalThis.pgPool = new _pg.Pool({ connectionString });
  }
  const adapter = new PrismaPg(globalThis.pgPool);
  _prisma = new PrismaClient({ adapter });
  globalThis.prisma = _prisma;
  return _prisma;
}

/** Run a callback within a request-scoped PrismaClient context (CF Workers). */
export function withPrismaRequest<T>(fn: () => T): T {
  return _requestStore.run({ prisma: null }, fn);
}

// Proxy preserves `import { prisma } from '@/lib/db'` compatibility
export const prisma = new Proxy({} as PrismaClient, {
  get: (_, prop) => (getPrisma() as any)[prop],
});

export default prisma;
