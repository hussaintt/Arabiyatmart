import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { BFF_ALLOWLIST } from '@/lib/security/bff-allowlist';
import { OPERATION_MATRIX } from './operation-matrix';

describe('TASK-054 private account operation contracts', () => {
  it('marks private reads no-store and requires protected authentication', () => {
    const rows = OPERATION_MATRIX.filter((row) => row.private && !row.mutation);
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      const operation = BFF_ALLOWLIST.find((entry) => entry.operation === row.operation);
      expect(operation?.authMode, row.operation).toBe(row.authMode);
      const policy = typeof operation?.cachePolicy === 'function'
        ? operation.cachePolicy({ pathParams: {}, query: {}, isPersonalized: true })
        : operation?.cachePolicy;
      expect(policy?.isPrivate, row.operation).toBe(true);
      expect(policy?.cache, row.operation).toBe('no-store');
    }
  });

  it('requires idempotency and validated bodies for account mutations', () => {
    for (const row of OPERATION_MATRIX.filter((item) => item.mutation && item.operation !== 'removeFavorite')) {
      const operation = BFF_ALLOWLIST.find((entry) => entry.operation === row.operation);
      expect(operation?.requiresIdempotency, row.operation).toBe(row.idempotent);
      if (['addFavorite', 'markNotificationRead', 'refreshSession'].includes(row.operation)) continue;
      expect(operation?.bodySchema ?? operation?.querySchema ?? operation?.pathParamsSchema, row.operation).toBeDefined();
    }
  });
});
