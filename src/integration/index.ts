// Picocart Astro Integration entry point.
//
// Registers the picocart middleware and injects the core pages, so a host project
// (an overlay deployment) only adds or replaces the routes it customises.

import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TenantResolver } from '../lib/tenant/types';
import { corePagesDir, enumerateCoreRoutes, filterRoutes } from './inject-routes';

export interface PicocartOptions {
  tenantResolver?: TenantResolver;
  // Core route patterns (e.g. '/login') the host serves itself instead.
  excludeRoutes?: string[];
}

const PACKAGE_NAME = 'picocart';

function readPackageVersion(packageRoot: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export default function picocart(options: PicocartOptions = {}): AstroIntegration {
  const here = dirname(fileURLToPath(import.meta.url));
  const distDir = dirname(here);
  const packageRoot = dirname(distDir);
  const version = readPackageVersion(packageRoot);
  const middlewareSpecifier = `${PACKAGE_NAME}/middleware`;

  return {
    name: 'picocart',
    hooks: {
      'astro:config:setup': async ({ addMiddleware, injectRoute, logger }) => {
        logger.info(`picocart v${version} initializing`);

        try {
          const { ensureDefaultTenant } = await import('../lib/tenant/bootstrap');
          await ensureDefaultTenant();
        } catch (err) {
          logger.warn(`picocart: default tenant bootstrap deferred (${(err as Error).message})`);
        }

        if (options.tenantResolver) {
          const { setTenantResolver } = await import('../lib/tenant/resolver');
          setTenantResolver(options.tenantResolver);
        }

        addMiddleware({ entrypoint: middlewareSpecifier, order: 'pre' });

        // Injected pages are core source files importing via `@/...`; the host resolves that
        // alias to the package src (definePicocartCloudflareConfig in ./cloudflare-preset does it).
        for (const route of filterRoutes(enumerateCoreRoutes(corePagesDir(import.meta.url)), options.excludeRoutes)) {
          injectRoute({ pattern: route.pattern, entrypoint: route.entrypoint });
        }
      },
    },
  };
}

export type { TenantResolver };
