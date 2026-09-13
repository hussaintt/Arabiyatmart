import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { BFF_ALLOWLIST } from '@/lib/security/bff-allowlist';
import { OPERATION_MATRIX } from './operation-matrix';

describe('TASK-054 public BFF operation inventory', () => {
  it('maps every public or optional read to a public cache policy and output schema', () => {
    const publicRows = OPERATION_MATRIX.filter((row) => !row.private && !row.mutation);
    expect(publicRows.length).toBeGreaterThan(20);
    for (const row of publicRows) {
      const operation = BFF_ALLOWLIST.find((entry) => entry.operation === row.operation);
      expect(operation, row.operation).toBeDefined();
      expect(operation?.method).toBe('GET');
      expect(operation?.authMode).toBe(row.authMode);
      expect(operation?.outputSchema, row.operation).toBeDefined();
      const pathParams = Object.fromEntries((operation?.pathParamNames ?? []).map((name) => [name, name === 'code' ? 'EG' : name === 'cityId' ? '1' : 'test-id']));
      const policy = typeof operation?.cachePolicy === 'function'
        ? operation.cachePolicy({ pathParams, query: {}, isPersonalized: false })
        : operation?.cachePolicy;
      expect(policy?.isPrivate, row.operation).toBe(false);
    }
  });
});
