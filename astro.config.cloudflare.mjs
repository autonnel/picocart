import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  integrations: [react()],
  output: 'server',
  security: { checkOrigin: false },
  server: {
    port: parseInt(process.env.PORT) || 4322,
  },
  vite: {
    define: { global: 'globalThis' },
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // Prisma 7: the generated client (.prisma/client/default) uses Node.js
        // subpath imports (#main-entry-point) which Rollup can't resolve for
        // workerd. Alias directly to the edge runtime entry.
        '.prisma/client/default': path.resolve(
          __dirname,
          'node_modules/.prisma/client/edge.js',
        ),
      },
    },
    ssr: {
      external: ['ioredis', 'sharp'],
      noExternal: ['@fontsource-variable/*', '@fontsource/*'],
    },
  },
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'auto',
  },
});
