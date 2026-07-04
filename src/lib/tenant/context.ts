import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantContext } from './types';
import { DEFAULT_TENANT } from './default';

const store = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(tenant: TenantContext, fn: () => T): T {
  return store.run(tenant, fn);
}

export function getCurrentTenant(): TenantContext {
  return store.getStore() ?? DEFAULT_TENANT;
}

export function getCurrentTenantId(): string {
  return getCurrentTenant().id;
}
