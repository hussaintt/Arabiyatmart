import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

describe('TASK 1.3: TypeScript AST Client Boundary Scanner', () => {
  const testDir = join(process.cwd(), 'src/__boundary_test_tmp__');

  it('detects a forbidden server-only import hidden through a barrel re-export', () => {
    mkdirSync(testDir, { recursive: true });
    const barrelFile = join(testDir, 'barrel.ts');
    const clientFile = join(testDir, 'leak-component.tsx');

    try {
      // Barrel re-exports server authentication module
      writeFileSync(barrelFile, `export * from '@/lib/auth/session';`);

      // Client component imports from barrel
      writeFileSync(
        clientFile,
        `'use client';
import { requireSession } from './barrel';
export function LeakComponent() { return <div>leak</div>; }`
      );

      let errorOutput = '';
      try {
        execSync('node scripts/check-client-boundaries.mjs', { encoding: 'utf8', stdio: 'pipe' });
      } catch (err: unknown) {
        const error = err as { stderr?: string; stdout?: string };
        errorOutput = error.stderr || error.stdout || '';
      }

      expect(errorOutput).toContain('Client boundary check failed:');
      expect(errorOutput).toContain('barrel.ts');
      expect(errorOutput).toContain('server authentication primitive');
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('permits type-only imports of server modules without failing', () => {
    mkdirSync(testDir, { recursive: true });
    const clientFile = join(testDir, 'safe-type-component.tsx');

    try {
      // Client component uses only type import from server module
      writeFileSync(
        clientFile,
        `'use client';
import type { ServerEnv } from '@/lib/env/server';
export function SafeTypeComponent() { return <div>safe</div>; }`
      );

      let passed = false;
      try {
        const out = execSync('node scripts/check-client-boundaries.mjs', { encoding: 'utf8', stdio: 'pipe' });
        passed = out.includes('Client boundary check passed');
      } catch {
        passed = false;
      }

      expect(passed).toBe(true);
    } finally {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});
