/**
 * Tenant-scoped Prisma client extension.
 *
 * Wraps a Prisma client so every read operation (`findFirst`, `findMany`,
 * `count`, `aggregate`, `groupBy`) automatically merges
 * `{ tenantId: getCurrentTenantId() }` into the `where` clause.
 *
 * Writes (`create` / `update` / `upsert`) are NOT auto-injected — use
 * `withTenantData(...)` from `tenant-helpers.ts` explicitly.
 */
import { Prisma } from '@prisma/client';
import { getCurrentTenantId } from '@/lib/tenant/context';

const READ_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

export const withTenantPrisma = Prisma.defineExtension({
  name: 'picocart-with-tenant',
  query: {
    $allModels: {
      async $allOperations({ args, query, operation }) {
        if (!READ_OPS.has(operation)) {
          return query(args);
        }
        const tenantId = getCurrentTenantId();
        const a = args as { where?: Record<string, unknown> } | undefined;
        const existingWhere = (a && a.where) ?? {};
        if ('tenantId' in existingWhere) {
          return query(args);
        }
        return query({
          ...(a ?? {}),
          where: { ...existingWhere, tenantId },
        } as typeof args);
      },
    },
  },
});
