// Astro middleware. Resolves request tenant, runs handlers under that tenant
// context, and ensures the default Tenant row exists for FK targets.

import { defineMiddleware } from 'astro:middleware';
import { withPrismaRequest } from './lib/db';
import { createLogger } from './lib/logger';
import { isCloudflareRuntime } from '@/lib/runtime/env';
import { seedSystemRoles } from './lib/permissions/seed';
import { resolveTenant } from './lib/tenant/resolver';
import { runWithTenant, getCurrentTenantId } from './lib/tenant/context';
import { ensureDefaultTenant } from './lib/tenant/bootstrap';
import { DEFAULT_TENANT_ID } from './lib/tenant/default';

const logger = createLogger('Middleware');

let permissionsSeeded = false;
let tenantBootstrapped = false;

async function handleRequest(
  context: Parameters<Parameters<typeof defineMiddleware>[0]>[0],
  next: Parameters<Parameters<typeof defineMiddleware>[0]>[1],
): Promise<Response> {
  if (!permissionsSeeded) {
    permissionsSeeded = true;
    seedSystemRoles().catch((err) => {
      permissionsSeeded = false;
      logger.error('Permission seed failed', { error: err });
    });
  }

  context.locals.tenantId = getCurrentTenantId();
  return next();
}

export const onRequest = defineMiddleware(async (context, next) => {
  const tenant = await resolveTenant(context.request);

  if (!tenantBootstrapped && tenant.id === DEFAULT_TENANT_ID) {
    try {
      await ensureDefaultTenant();
      tenantBootstrapped = true;
    } catch (err) {
      logger.error('Default tenant bootstrap failed', { error: err });
    }
  }

  const exec = async () => {
    try {
      return await runWithTenant(tenant, () => handleRequest(context, next));
    } catch (error) {
      logger.error('Unhandled middleware error', { error, tenantId: getCurrentTenantId() });
      return new Response('Internal Server Error', { status: 500 });
    }
  };

  return isCloudflareRuntime() ? withPrismaRequest(exec) : exec();
});
