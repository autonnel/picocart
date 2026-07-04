import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { config } from 'dotenv';
config()
import { loadEnv } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

export default defineConfig({
  devToolbar: { enabled: false },
  server: {
    host: true,
    port: parseInt(process.env.PORT) || 4322,
    allowedHosts: ['localhost'],
  },
  security: {
    checkOrigin: false
  },
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [
    react(),
  ],
  output: 'server',
  vite: {
    define: {
      global: 'globalThis',
    },
    server: {
      allowedHosts: true
    },
    preview: {
      allowedHosts: true,
    },
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    ssr: {
      noExternal: ['@fontsource-variable/*', '@fontsource/*'],
    },
  },
  trailingSlash: 'never',
  build:{
    format: 'file',
    inlineStylesheets: 'auto'
  }
});
