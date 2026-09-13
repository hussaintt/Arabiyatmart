import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Eye } from 'lucide-react';
import type { VendorMembershipWithVendor } from '@/types/dealer';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ setVendor: vi.fn(), refresh: vi.fn() }));
vi.mock('@/server/actions/vendors', () => ({ setActiveVendor: (...args: unknown[]) => state.setVendor(...args) }));
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: state.refresh }) }));

import { VendorSwitcher } from '@/components/vendor/vendor-switcher';
import { MetricCard } from '@/components/dashboard/metric-card';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';

const memberships: VendorMembershipWithVendor[] = [{
  vendor: {
    publicId: 'vnd_01', slug: 'dealer-one', legalName: 'Dealer One LLC', displayName: { ar: 'المعرض الأول', en: 'Dealer One' }, description: null, email: 'dealer@example.com', phone: null, logoUrl: null, bannerUrl: null, status: 'APPROVED', approvedAt: '2026-01-01T00:00:00.000Z', storeType: 'COMPANY', businessAddressLine: null, businessCountryId: null, businessCityId: null, businessPostalCode: null, defaultCurrency: 'EGP', createdAt: '2026-01-01T00:00:00.000Z',
  },
  membership: { vendorPublicId: 'vnd_01', role: 'MANAGER', invitedAt: '2026-01-01T00:00:00.000Z', acceptedAt: '2026-01-02T00:00:00.000Z' },
}];

describe('TASK-052: vendor selection and seller dashboard', () => {
  beforeEach(() => state.setVendor.mockResolvedValue({ ok: true, data: { vendorPublicId: 'vnd_01' } }));
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('switches vendor through the server action and refreshes server data', async () => {
    render(<VendorSwitcher memberships={memberships} activeVendorPublicId={null} locale="en" allowPrivate />);
    fireEvent.change(screen.getByLabelText('Active seller account'), { target: { value: 'vnd_01' } });
    await waitFor(() => expect(state.setVendor).toHaveBeenCalledWith({ vendorPublicId: 'vnd_01' }));
    expect(state.refresh).toHaveBeenCalledTimes(1);
  });

  it('renders localized metric values and an accessible channel table', () => {
    render(<><MetricCard label="Total views" value="1,234" Icon={Eye} /><DashboardCharts leadsByChannel={{ WHATSAPP: 7, CHAT: 3 }} locale="en" /></>);
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Inquiry totals by channel' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '7' })).toBeInTheDocument();
  });
});
