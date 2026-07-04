import type { TenantContext, TenantResolver } from './types';
import { DEFAULT_TENANT } from './default';

let currentResolver: TenantResolver = () => DEFAULT_TENANT;

export function setTenantResolver(fn: TenantResolver): void {
  currentResolver = fn;
}

export function resetTenantResolver(): void {
  currentResolver = () => DEFAULT_TENANT;
}

export async function resolveTenant(request: Request): Promise<TenantContext> {
  return Promise.resolve(currentResolver(request));
}

export function getTenantResolver(): TenantResolver {
  return currentResolver;
}
