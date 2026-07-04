import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { FEATURES, SYSTEM_ROLE_NAMES, type FeatureId } from './config';
import { invalidateAllPermissionCaches } from './cache';
import { runWithTenant, getCurrentTenantId } from '@/lib/tenant/context';
import { DEFAULT_TENANT_ID } from '@/lib/tenant/default';

const logger = createLogger('PermissionsSeed');

const ADMIN_FEATURES: FeatureId[] = Object.values(FEATURES) as FeatureId[];

const VIEWER_FEATURES: FeatureId[] = [
  FEATURES.OVERVIEW,
  FEATURES.PRODUCTS,
  FEATURES.ORDERS,
  FEATURES.CUSTOMERS,
];

interface SystemRoleSpec {
  name: string;
  description: string;
  features: FeatureId[];
}

const SYSTEM_ROLES: SystemRoleSpec[] = [
  {
    name: SYSTEM_ROLE_NAMES.ADMIN,
    description: 'Full access to all features',
    features: ADMIN_FEATURES,
  },
  {
    name: SYSTEM_ROLE_NAMES.VIEWER,
    description: 'Read-only access to overview, products, orders, customers',
    features: VIEWER_FEATURES,
  },
];

async function ensureSystemRole(spec: SystemRoleSpec): Promise<void> {
  const tenantId = getCurrentTenantId();
  const existing = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId, name: spec.name } },
  });

  let roleId: string;
  if (existing) {
    roleId = existing.id;
    if (!existing.isSystem) {
      await prisma.role.update({
        where: { id: existing.id },
        data: { isSystem: true, description: existing.description ?? spec.description },
      });
    }
  } else {
    const created = await prisma.role.create({
      data: {
        tenantId,
        name: spec.name,
        description: spec.description,
        isSystem: true,
      },
    });
    roleId = created.id;
  }

  const currentFeatures = await prisma.roleFeature.findMany({
    where: { roleId },
    select: { featureId: true },
  });
  const currentSet = new Set(currentFeatures.map((f) => f.featureId));
  const desiredSet = new Set<string>(spec.features);

  const toAdd = [...desiredSet].filter((f) => !currentSet.has(f));
  if (toAdd.length === 0) return;

  await prisma.roleFeature.createMany({
    data: toAdd.map((featureId) => ({ tenantId, roleId, featureId })),
    skipDuplicates: true,
  });
}

async function seedForTenant(tenantId: string): Promise<void> {
  await runWithTenant({ id: tenantId }, async () => {
    for (const spec of SYSTEM_ROLES) {
      await ensureSystemRole(spec);
    }
  });
}

let seedPromise: Promise<void> | null = null;

export async function seedSystemRoles(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      await seedForTenant(DEFAULT_TENANT_ID);
      await invalidateAllPermissionCaches();
      logger.info('System roles seeded', { tenantId: DEFAULT_TENANT_ID });
    } catch (err) {
      seedPromise = null;
      logger.error('Failed to seed system roles', { error: err });
      throw err;
    }
  })();
  return seedPromise;
}

export async function seedSystemRolesForTenant(tenantId: string): Promise<void> {
  await seedForTenant(tenantId);
  await invalidateAllPermissionCaches();
}

export function _resetSeedStateForTests(): void {
  seedPromise = null;
}
