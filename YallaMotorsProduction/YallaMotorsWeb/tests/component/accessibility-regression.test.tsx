import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ createLead: vi.fn(), setVendor: vi.fn(), refresh: vi.fn() }));
vi.mock('@/server/actions/leads', () => ({ createContactLead: (...args: unknown[]) => state.createLead(...args) }));
vi.mock('@/server/actions/vendors', () => ({ setActiveVendor: (...args: unknown[]) => state.setVendor(...args) }));
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: state.refresh }) }));

import { CreateLeadDialog } from '@/components/leads/create-lead-dialog';
import { VendorSwitcher } from '@/components/vendor/vendor-switcher';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import type { VendorMembershipWithVendor } from '@/types/dealer';

const memberships: VendorMembershipWithVendor[] = [{
  vendor: { publicId: 'vnd_01', slug: 'dealer-one', legalName: 'Dealer One', displayName: { ar: 'المعرض', en: 'Dealer One' }, description: null, email: 'dealer@example.com', phone: null, logoUrl: null, bannerUrl: null, status: 'APPROVED', approvedAt: null, storeType: 'COMPANY', businessAddressLine: null, businessCountryId: null, businessCityId: null, businessPostalCode: null, defaultCurrency: 'EGP', createdAt: '2026-01-01T00:00:00.000Z' },
  membership: { vendorPublicId: 'vnd_01', role: 'MANAGER', invitedAt: '2026-01-01T00:00:00.000Z', acceptedAt: null },
}];

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('TASK-055 accessibility regression', () => {
  it('opens, labels, and restores focus for the buyer-message dialog', async () => {
    render(<CreateLeadDialog listingPublicId="lst_01" locale="en" />);
    const trigger = screen.getByRole('button', { name: 'Send Message' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByRole('dialog')).toHaveAccessibleName('Message the seller');
    expect(screen.getByLabelText('Your message')).toBeRequired();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('has no critical axe violations in vendor controls and accessible chart fallback', async () => {
    const { container } = render(<><VendorSwitcher memberships={memberships} activeVendorPublicId="vnd_01" locale="en" /><DashboardCharts leadsByChannel={{ CHAT: 2, WHATSAPP: 4 }} locale="en" /></>);
    expect(screen.getByLabelText('Active seller account')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Inquiry totals by channel' })).toBeInTheDocument();
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))).toEqual([]);
  });
});
