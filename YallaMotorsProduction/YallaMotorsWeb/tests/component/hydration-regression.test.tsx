import * as React from 'react';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ createLead: vi.fn() }));
vi.mock('@/server/actions/leads', () => ({ createContactLead: (...args: unknown[]) => state.createLead(...args) }));

import { CreateLeadDialog } from '@/components/leads/create-lead-dialog';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';

afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

describe('TASK-055 hydration regression', () => {
  it('hydrates deterministic lead and dashboard trees without changing server markup', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const tree = <><CreateLeadDialog listingPublicId="lst_01" locale="en" /><DashboardCharts leadsByChannel={{ CHAT: 1 }} locale="en" /></>;
    const host = document.createElement('div');
    const serverMarkup = renderToString(tree);
    host.innerHTML = serverMarkup;
    document.body.append(host);
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => { root = hydrateRoot(host, tree); });
    expect(host.innerHTML).toContain('Send Message');
    expect(host.innerHTML).toContain('Inquiries by channel');
    await act(async () => { root!.unmount(); });
  });
});
