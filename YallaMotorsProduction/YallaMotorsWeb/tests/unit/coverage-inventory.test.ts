import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const requiredRegressionSuites = [
  'tests/unit/auth-primitives.test.ts',
  'tests/unit/cache-query.test.ts',
  'tests/unit/seo-routes.test.ts',
  'tests/component/accessibility-regression.test.tsx',
  'tests/component/responsive-regression.test.tsx',
  'tests/component/hydration-regression.test.tsx',
  'tests/contract/security-gates.test.ts',
] as const;

describe('TASK-055 regression coverage inventory', () => {
  it('keeps required security, route, interaction, responsive, and hydration suites active', () => {
    for (const relativePath of requiredRegressionSuites) {
      const source = readFileSync(resolve(relativePath), 'utf8');
      expect(source, relativePath).not.toMatch(/\b(?:it|describe|test)\.(?:skip|todo|only)\b/);
    }
  });

  it('keeps coverage configuration on V8 with reports for CI enforcement', () => {
    const config = readFileSync(resolve('vitest.config.mts'), 'utf8');
    expect(config).toContain("provider: 'v8'");
    expect(config).toContain("json-summary");
  });
});
