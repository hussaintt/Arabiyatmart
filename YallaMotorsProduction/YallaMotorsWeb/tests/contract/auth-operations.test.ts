import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { BFF_ALLOWLIST } from '@/lib/security/bff-allowlist';
import { OPERATION_MATRIX } from './operation-matrix';

describe('TASK-054 authentication operation contracts', () => {
  it('keeps every authentication/session operation private and explicitly typed', () => {
    const authNames = new Set(['getSession', 'loginWithGoogle', 'loginWithApple', 'refreshSession', 'verifyFirebasePhone', 'getProfile']);
    const rows = OPERATION_MATRIX.filter((row) => authNames.has(row.operation));
    expect(rows).toHaveLength(authNames.size);
    for (const row of rows) {
      const operation = BFF_ALLOWLIST.find((entry) => entry.operation === row.operation);
      expect(operation?.authMode).toBe(row.authMode);
      expect(operation?.outputSchema).toBeDefined();
      const policy = typeof operation?.cachePolicy === 'function'
        ? operation.cachePolicy({ pathParams: {}, query: {}, isPersonalized: true })
        : operation?.cachePolicy;
      expect(policy?.isPrivate).toBe(true);
      expect(policy?.cache).toBe('no-store');
    }
  });

  it('requires a request body schema for credential or phone mutations', () => {
    for (const name of ['loginWithGoogle', 'loginWithApple', 'verifyFirebasePhone']) {
      expect(BFF_ALLOWLIST.find((entry) => entry.operation === name)?.bodySchema, name).toBeDefined();
    }
  });
});
