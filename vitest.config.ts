import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    include: [
      'tests/**/*.test.ts',
      'src/**/*.test.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.astro/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.astro',
        'src/pages/**',
        'src/components/**',
        'src/cli/**',
        'src/integration/**',
        'src/env.d.ts',
      ],
      thresholds: {
        lines: 30,
        functions: 50,
        statements: 30,
        branches: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
