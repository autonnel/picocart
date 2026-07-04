// Default-tenant bootstrap. OSS deployments expect a Tenant row with
// id="default" to satisfy FKs. Idempotent and cached per-process.

import { prisma } from '@/lib/db';
import { DEFAULT_TENANT_ID } from './default';
import { createLogger } from '@/lib/logger';

const logger = createLogger('TenantBootstrap');

let bootstrapPromise: Promise<void> | null = null;

export async function ensureDefaultTenant(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    try {
      await prisma.tenant.upsert({
        where: { id: DEFAULT_TENANT_ID },
        create: { id: DEFAULT_TENANT_ID },
        update: {},
      });
      logger.info('Default tenant ensured', { tenantId: DEFAULT_TENANT_ID });
    } catch (error) {
      bootstrapPromise = null;
      logger.error('Failed to ensure default tenant', { error });
      throw error;
    }
  })();

  return bootstrapPromise;
}

export function _resetBootstrap(): void {
  bootstrapPromise = null;
}
