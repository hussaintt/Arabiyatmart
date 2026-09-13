import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: ['tests/**', '**/*.d.ts', 'src/app/**', 'src/types/**'],
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 50,
        lines: 50,
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
          setupFiles: ['./tests/setup/vitest.setup.ts'],
        },
        resolve: {
          alias: {
            '@': path.resolve(import.meta.dirname, './src'),
          },
        },
      },
      {
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['tests/component/**/*.{test,spec}.{ts,tsx}'],
          setupFiles: ['./tests/setup/vitest.setup.ts'],
        },
        resolve: {
          alias: {
            '@': path.resolve(import.meta.dirname, './src'),
          },
        },
      },
      {
        test: {
          name: 'contract',
          environment: 'node',
          include: ['tests/contract/**/*.{test,spec}.{ts,tsx}'],
          setupFiles: ['./tests/setup/vitest.setup.ts'],
        },
        resolve: {
          alias: {
            '@': path.resolve(import.meta.dirname, './src'),
          },
        },
      },
    ],
  },
});
