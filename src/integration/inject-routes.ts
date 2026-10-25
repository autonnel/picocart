import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export interface InjectableRoute {
  pattern: string;
  entrypoint: string;
}

// 'overview.astro' -> '/overview'; 'orders/index.astro' -> '/orders'; 'index.astro' -> '/'.
export function derivePattern(relPath: string): string {
  let p = relPath.replace(/\\/g, '/').replace(/\.(astro|ts|js)$/, '');
  p = p.replace(/\/index$/, '');
  if (p === 'index') p = '';
  return '/' + p;
}

function walk(dir: string, base: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) {
      walk(full, rel, out);
      continue;
    }
    if (!/\.(astro|ts|js)$/.test(name)) continue;
    if (/\.test\.(ts|js)$/.test(name) || /\.d\.ts$/.test(name)) continue;
    if (name === '404.astro') continue;
    out.push(rel);
  }
}

export function enumerateCoreRoutes(pagesDir: string): InjectableRoute[] {
  const files: string[] = [];
  walk(pagesDir, '', files);
  return files.sort().map((rel) => ({
    pattern: derivePattern(rel),
    entrypoint: `picocart/pages/${rel.replace(/\\/g, '/')}`,
  }));
}

export function filterRoutes(routes: InjectableRoute[], exclude: string[] | undefined): InjectableRoute[] {
  if (!exclude || exclude.length === 0) return routes;
  const set = new Set(exclude);
  return routes.filter((r) => !set.has(r.pattern));
}

export function corePagesDir(integrationUrl: string): string {
  const rel = integrationUrl.includes('/dist/') ? '../../src/pages/' : '../pages/';
  return fileURLToPath(new URL(rel, integrationUrl));
}
