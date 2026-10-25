// Astro config for a host project that mounts picocart on Cloudflare Workers.
// Holds every workerd build fix so deployments never copy them.

import type { AstroIntegration, AstroUserConfig } from 'astro';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import picocart, { type PicocartOptions } from './index';

type VitePlugin = NonNullable<NonNullable<AstroUserConfig['vite']>['plugins']>[number];

export interface PicocartCloudflareOptions extends PicocartOptions {
  // Host project root (pass `import.meta.url` of the astro config).
  root: string | URL;
  integrations?: AstroIntegration[];
  vitePlugins?: VitePlugin[];
  aliases?: Record<string, string>;
}

export const CORE_SRC_DIR = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src'));

const REACT_DEPS = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'];

function toDir(root: string | URL): string {
  const p = root instanceof URL || root.startsWith('file:') ? fileURLToPath(root) : root;
  return path.extname(p) ? path.dirname(p) : p;
}

// Build tooling comes from the host so the build matches its lockfile; picocart's copy is a fallback.
async function fromHost<T>(require: NodeRequire, id: string): Promise<T> {
  let file: string;
  try {
    file = require.resolve(id);
  } catch {
    file = createRequire(path.join(CORE_SRC_DIR, '../package.json')).resolve(id);
  }
  const mod = await import(pathToFileURL(file).href);
  return (mod.default ?? mod) as T;
}

// Prisma 7: `.prisma/client/default` uses Node subpath imports Rollup can't resolve for workerd.
// The core src imports `@prisma/client` from its own install, so its generated client is used.
function prismaEdgeEntry(): string {
  const clientPkg = createRequire(path.join(CORE_SRC_DIR, '../package.json')).resolve('@prisma/client/package.json');
  return path.resolve(path.dirname(clientPkg), '../../.prisma/client/edge.js');
}

function isUnderCore(file: string): boolean {
  return file.replace(/\\/g, '/').startsWith(CORE_SRC_DIR.replace(/\\/g, '/') + '/');
}

// Core files import via `@/...`. Entries without an importer (client islands) are core too,
// so a host must not use the `@/` prefix for its own modules.
export function coreAtAlias(): VitePlugin {
  return {
    name: 'picocart:core-at-alias',
    enforce: 'pre',
    async resolveId(this: any, id: string, importer: string | undefined, options: any) {
      if (!id.startsWith('@/')) return null;
      if (importer && !isUnderCore(importer)) return null;
      return this.resolve(path.resolve(CORE_SRC_DIR, id.slice(2)), importer, { ...options, skipSelf: true });
    },
  } as VitePlugin;
}

export async function definePicocartCloudflareConfig(opts: PicocartCloudflareOptions): Promise<AstroUserConfig> {
  const { root, integrations, vitePlugins, aliases, ...picocartOptions } = opts;
  const require = createRequire(path.join(toDir(root), 'package.json'));
  const cloudflare = await fromHost<(o?: unknown) => AstroIntegration>(require, '@astrojs/cloudflare');
  const react = await fromHost<() => AstroIntegration>(require, '@astrojs/react');
  const tailwindcss = await fromHost<() => VitePlugin>(require, '@tailwindcss/vite');
  return {
    output: 'server',
    security: { checkOrigin: false },
    adapter: cloudflare() as AstroUserConfig['adapter'],
    integrations: [react(), picocart(picocartOptions), ...(integrations ?? [])],
    vite: {
      define: { global: 'globalThis' },
      // Without React dedupe the core's islands get a second React copy and hydration crashes.
      optimizeDeps: { include: REACT_DEPS },
      resolve: {
        alias: { '.prisma/client/default': prismaEdgeEntry(), ...aliases },
        dedupe: ['react', 'react-dom'],
      },
      ssr: {
        external: ['ioredis', 'sharp'],
        noExternal: [/[\\/]picocart[\\/]src[\\/]/, '@fontsource-variable/*', '@fontsource/*'],
      },
      plugins: [coreAtAlias(), ...(vitePlugins ?? []), tailwindcss()] as any,
    },
    trailingSlash: 'never',
    build: { format: 'file', inlineStylesheets: 'auto' },
  };
}
