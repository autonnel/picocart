import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { corePagesDir, derivePattern, enumerateCoreRoutes, filterRoutes } from '@/integration/inject-routes';

describe('inject-routes', () => {
  it('derives Astro patterns from page paths', () => {
    expect(derivePattern('index.astro')).toBe('/');
    expect(derivePattern('orders/index.astro')).toBe('/orders');
    expect(derivePattern('api/settings/users/[id]/role.ts')).toBe('/api/settings/users/[id]/role');
    expect(derivePattern('admin/api/2024-01/graphql.json.ts')).toBe('/admin/api/2024-01/graphql.json');
  });

  it('enumerates the core pages with package entrypoints and skips 404', () => {
    const routes = enumerateCoreRoutes(fileURLToPath(new URL('../../src/pages/', import.meta.url)));
    expect(routes).toContainEqual({ pattern: '/login', entrypoint: 'picocart/pages/login.astro' });
    expect(routes).toContainEqual({ pattern: '/orders/[id]', entrypoint: 'picocart/pages/orders/[id].astro' });
    expect(routes.some((r) => r.pattern === '/404')).toBe(false);
  });

  it('drops excluded patterns', () => {
    const routes = [{ pattern: '/login', entrypoint: 'a' }, { pattern: '/orders', entrypoint: 'b' }];
    expect(filterRoutes(routes, ['/login'])).toEqual([{ pattern: '/orders', entrypoint: 'b' }]);
    expect(filterRoutes(routes, undefined)).toBe(routes);
  });

  it('locates src/pages from both the source and the compiled integration', () => {
    expect(corePagesDir('file:///pkg/src/integration/index.ts')).toBe('/pkg/src/pages/');
    expect(corePagesDir('file:///pkg/dist/integration/index.js')).toBe('/pkg/src/pages/');
  });
});
