export {
  FEATURES,
  FEATURE_LABELS,
  FEATURE_DESCRIPTIONS,
  NAV_FEATURE_MAP,
  SYSTEM_ROLE_NAMES,
  DEFAULT_ROLE_NAME,
  getPermissionAdminIds,
  getPermissionAdminIdsAsync,
  type FeatureId,
  type SystemRoleName,
} from './config';

export {
  getPermissionRepository,
  setPermissionRepository,
  PrismaPermissionRepository,
  type IPermissionRepository,
  type RoleRecord,
  type RoleWithFeatures,
  type UserWithRoles,
} from './repository';

export {
  getUserRoles,
  getUserFeatures,
  userHasFeature,
  canAccessPermissionsPage,
  canAccessPermissionsPageAsync,
  getAccessibleNavIds,
  getNavMenuForUser,
  deriveAccessibleNavIds,
  invalidateUserRolesCache,
  invalidateAllPermissionCaches,
} from './service';

export { seedSystemRoles, seedSystemRolesForTenant } from './seed';
