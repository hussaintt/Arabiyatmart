import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { BFF_ALLOWLIST, matchBffOperation } from '@/lib/security/bff-allowlist';
import { isAllowedBffPath } from '@/lib/api/endpoints';
import { OPERATION_MATRIX, READINESS_GATES } from './operation-matrix';

describe('TASK-054 readiness gates', () => {
  it('keeps the explicit matrix in exact lockstep with the default-deny allowlist', () => {
    expect(new Set(OPERATION_MATRIX.map((row) => row.operation)).size).toBe(OPERATION_MATRIX.length);
    expect(OPERATION_MATRIX.map((row) => row.operation).sort()).toEqual(BFF_ALLOWLIST.map((operation) => operation.operation).sort());
    for (const row of OPERATION_MATRIX) {
      const operation = BFF_ALLOWLIST.find((entry) => entry.operation === row.operation);
      expect(operation?.method, row.operation).toBe(row.method);
      expect(operation?.pathTemplate, row.operation).toBe(row.path);
      expect(operation?.authMode, row.operation).toBe(row.authMode);
      expect(operation?.requiresIdempotency, row.operation).toBe(row.idempotent);
      expect(operation?.outputSchema, row.operation).toBeDefined();
    }
  });

  it.each(READINESS_GATES)('%s has at least one enforced invariant in the matrix gateway', (gate) => {
    if (gate === 'IDEM-01') expect(OPERATION_MATRIX.some((row) => row.idempotent)).toBe(true);
    if (gate === 'AUTH-01') expect(OPERATION_MATRIX.some((row) => row.authMode === 'S' || row.authMode === 'M' || row.authMode === 'U')).toBe(true);
    if (gate === 'CACHE-01') expect(OPERATION_MATRIX.some((row) => row.private)).toBe(true);
    if (gate === 'FLOW-01') expect(OPERATION_MATRIX.some((row) => row.operation === 'updateSellerLeadStatus')).toBe(true);
    if (gate === 'FAV-01') expect(OPERATION_MATRIX.some((row) => row.operation === 'getFavorites')).toBe(true);
    if (gate === 'ERR-01' || gate === 'OUT-01' || gate === 'OBS-01') expect(BFF_ALLOWLIST.every((operation) => operation.outputSchema)).toBe(true);
  });

  it('fails closed for removed buyer-offer and arbitrary proxy routes', () => {
    expect(isAllowedBffPath('/api/bff/me/offers')).toBe(false);
    expect(matchBffOperation('POST', '/api/bff/me/offers').type).toBe('security_violation');
    expect(matchBffOperation('GET', '/api/bff/admin/users').type).toBe('security_violation');
  });
});
