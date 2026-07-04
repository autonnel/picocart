import { getCache, CACHE_TTL } from '@/lib/adapters/cache';
import { getPermissionRepository } from './repository';
import {
  DEFAULT_ROLE_NAME,
  getPermissionAdminIds,
  getPermissionAdminIdsAsync,
  FEATURES,
  type FeatureId,
} from './config';
import {
  buildUserRolesCacheKey,
  buildUserFeaturesCacheKey,
  invalidateUserRolesCache,
  invalidateAllPermissionCaches,
} from './cache';

export { invalidateUserRolesCache, invalidateAllPermissionCaches };

export async function getUserRoles(userId: string): Promise<string[]> {
  const cache = getCache();
  const cacheKey = buildUserRolesCacheKey(userId);

  const cached = await cache.get<string[]>(cacheKey);
  if (cached !== null) return cached;

  const repo = getPermissionRepository();
  const roles = await repo.getUserRoleNames(userId);

  await cache.set(cacheKey, roles, CACHE_TTL.SHORT);
  return roles;
}

async function loadFeaturesForRoleNames(roleNames: string[]): Promise<Set<FeatureId>> {
  const repo = getPermissionRepository();
  const featureSet = new Set<FeatureId>();

  for (const name of roleNames) {
    const role = await repo.getRoleByName(name);
    if (!role) continue;
    const features = await repo.listRoleFeatures(role.id);
    for (const f of features) featureSet.add(f);
  }
  return featureSet;
}

export async function getUserFeatures(userId: string): Promise<FeatureId[]> {
  const cache = getCache();
  const cacheKey = buildUserFeaturesCacheKey(userId);

  const cached = await cache.get<FeatureId[]>(cacheKey);
  if (cached !== null) return cached;

  const dbRoles = await getUserRoles(userId);
  const effectiveRoles = dbRoles.length === 0 ? [DEFAULT_ROLE_NAME] : dbRoles;
  const featureSet = await loadFeaturesForRoleNames(effectiveRoles);
  const features = Array.from(featureSet);

  await cache.set(cacheKey, features, CACHE_TTL.SHORT);
  return features;
}

export async function userHasFeature(
  userId: string,
  feature: FeatureId
): Promise<boolean> {
  const features = await getUserFeatures(userId);
  return features.includes(feature);
}

// Sync env-only check; preserved for callers that cannot await.
export function canAccessPermissionsPage(userId: string, providerId?: string): boolean {
  const allowedIds = getPermissionAdminIds();
  if (allowedIds.includes(userId)) return true;
  if (providerId && allowedIds.includes(providerId)) return true;
  return false;
}

// DB-driven check with env fallback as OR. Grants access when the user has
// SETTINGS_PERMISSIONS via any role OR is listed in PERMISSIONS_ADMIN_USER_IDS.
export async function canAccessPermissionsPageAsync(
  userId: string,
  providerId?: string
): Promise<boolean> {
  if (await userHasFeature(userId, FEATURES.SETTINGS_PERMISSIONS)) return true;
  const allowedIds = await getPermissionAdminIdsAsync();
  if (allowedIds.includes(userId)) return true;
  if (providerId && allowedIds.includes(providerId)) return true;
  return false;
}

export function deriveAccessibleNavIds(
  features: FeatureId[],
  userId: string,
  providerId?: string
): string[] {
  const featureSet = new Set(features);

  const NAV_ORDER: { id: string; features: FeatureId[] }[] = [
    { id: 'overview', features: [FEATURES.OVERVIEW] },
    { id: 'products', features: [FEATURES.PRODUCTS, FEATURES.PRODUCTS_WRITE] },
    { id: 'orders', features: [FEATURES.ORDERS, FEATURES.ORDERS_REFUND] },
    { id: 'customers', features: [FEATURES.CUSTOMERS] },
    {
      id: 'settings',
      features: [
        FEATURES.SETTINGS,
        FEATURES.SETTINGS_CURRENCIES,
        FEATURES.SETTINGS_STORAGE,
        FEATURES.SETTINGS_API_KEYS,
        FEATURES.SETTINGS_USERS,
      ],
    },
  ];

  const navIds: string[] = [];
  for (const nav of NAV_ORDER) {
    if (nav.features.some((f) => featureSet.has(f))) {
      navIds.push(nav.id);
    }
  }

  if (featureSet.has(FEATURES.SETTINGS_PERMISSIONS) || canAccessPermissionsPage(userId, providerId)) {
    if (!navIds.includes('settings')) navIds.push('settings');
  }

  return navIds;
}

export async function getAccessibleNavIds(userId: string, providerId?: string): Promise<string[]> {
  const features = await getUserFeatures(userId);
  return deriveAccessibleNavIds(features, userId, providerId);
}

export async function getNavMenuForUser(userId: string, providerId?: string): Promise<string[]> {
  return getAccessibleNavIds(userId, providerId);
}
