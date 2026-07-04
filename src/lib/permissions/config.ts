import { getEnv } from '@/lib/runtime/env';
import { getPermissionsAdminIdsRaw } from '@/lib/config/keys';

export const FEATURES = {
  OVERVIEW: 'overview',

  PRODUCTS: 'products',
  PRODUCTS_WRITE: 'products.write',

  ORDERS: 'orders',
  ORDERS_REFUND: 'orders.refund',

  CUSTOMERS: 'customers',

  SETTINGS: 'settings',
  SETTINGS_API_KEYS: 'settings.api-keys',
  SETTINGS_USERS: 'settings.users',
  SETTINGS_PERMISSIONS: 'settings.permissions',
  SETTINGS_CURRENCIES: 'settings.currencies',
  SETTINGS_STORAGE: 'settings.storage',
} as const;

export type FeatureId = (typeof FEATURES)[keyof typeof FEATURES];

export const FEATURE_LABELS: Record<FeatureId, string> = {
  [FEATURES.OVERVIEW]: 'Overview',

  [FEATURES.PRODUCTS]: 'Products',
  [FEATURES.PRODUCTS_WRITE]: 'Products: Write',

  [FEATURES.ORDERS]: 'Orders',
  [FEATURES.ORDERS_REFUND]: 'Orders: Refund',

  [FEATURES.CUSTOMERS]: 'Customers',

  [FEATURES.SETTINGS]: 'Settings',
  [FEATURES.SETTINGS_API_KEYS]: 'Settings: API Keys',
  [FEATURES.SETTINGS_USERS]: 'Settings: Users',
  [FEATURES.SETTINGS_PERMISSIONS]: 'Settings: Roles & Permissions',
  [FEATURES.SETTINGS_CURRENCIES]: 'Settings: Currencies',
  [FEATURES.SETTINGS_STORAGE]: 'Settings: Storage',
};

export const FEATURE_DESCRIPTIONS: Record<FeatureId, string> = {
  [FEATURES.OVERVIEW]: 'Access the Overview dashboard',

  [FEATURES.PRODUCTS]: 'View products',
  [FEATURES.PRODUCTS_WRITE]: 'Create, edit and delete products',

  [FEATURES.ORDERS]: 'View orders',
  [FEATURES.ORDERS_REFUND]: 'Issue refunds against orders',

  [FEATURES.CUSTOMERS]: 'View customers',

  [FEATURES.SETTINGS]: 'Access global settings',
  [FEATURES.SETTINGS_API_KEYS]: 'Manage API keys',
  [FEATURES.SETTINGS_USERS]: 'Manage users and invitations',
  [FEATURES.SETTINGS_PERMISSIONS]: 'Manage roles and permissions',
  [FEATURES.SETTINGS_CURRENCIES]: 'Configure supported currencies',
  [FEATURES.SETTINGS_STORAGE]: 'Configure S3 / CDN storage',
};

export const NAV_FEATURE_MAP: Record<string, FeatureId> = {
  overview: FEATURES.OVERVIEW,
  products: FEATURES.PRODUCTS,
  orders: FEATURES.ORDERS,
  customers: FEATURES.CUSTOMERS,
  settings: FEATURES.SETTINGS,
};

export const SYSTEM_ROLE_NAMES = {
  ADMIN: 'admin',
  VIEWER: 'viewer',
} as const;

export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[keyof typeof SYSTEM_ROLE_NAMES];

export const DEFAULT_ROLE_NAME = SYSTEM_ROLE_NAMES.VIEWER;

function parseIds(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

// Sync env-only — kept for callers that cannot await.
export function getPermissionAdminIds(): string[] {
  return parseIds(getEnv('PERMISSIONS_ADMIN_USER_IDS'));
}

export async function getPermissionAdminIdsAsync(): Promise<string[]> {
  const raw = await getPermissionsAdminIdsRaw();
  return parseIds(raw);
}
