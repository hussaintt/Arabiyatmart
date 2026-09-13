import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { BFF_ALLOWLIST } from '@/lib/security/bff-allowlist';
import { OPERATION_MATRIX } from './operation-matrix';

describe('TASK-054 seller lead and dashboard contracts', () => {
  it('contains only contact-lead operations and no buyer price-offer operation', () => {
    const names = OPERATION_MATRIX.map((row) => row.operation);
    expect(names).toEqual(expect.arrayContaining(['createLead', 'listSellerLeads', 'getSellerLead', 'updateSellerLeadStatus', 'createListingReport', 'getDashboardOverview']));
    expect(names.some((name) => /offer/i.test(name))).toBe(false);
  });

  it('requires idempotency and no-store responses for lead/report mutations', () => {
    for (const name of ['createLead', 'updateSellerLeadStatus', 'createListingReport']) {
      const operation = BFF_ALLOWLIST.find((entry) => entry.operation === name);
      expect(operation?.authMode).toBe(name === 'createLead' ? 'O' : 'M');
      expect(operation?.requiresIdempotency).toBe(true);
      expect(operation?.bodySchema).toBeDefined();
      expect(operation?.successStatus).toBe(name === 'updateSellerLeadStatus' ? undefined : 201);
    }
  });

  it('prevents dashboard vendor scope from originating in path or query parameters', () => {
    const operation = BFF_ALLOWLIST.find((entry) => entry.operation === 'getDashboardOverview');
    expect(operation?.pathTemplate).toBe('/api/bff/me/dashboard');
    expect(operation?.pathParamNames).toEqual([]);
    expect(operation?.buildUpstreamQuery?.({ pathParams: {}, query: { range: '30d' } })).toEqual({ days: 30 });
  });
});
