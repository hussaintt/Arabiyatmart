import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lead } from '@/types/lead';

vi.mock('server-only', () => ({}));

const state = vi.hoisted(() => ({ createLead: vi.fn(), createReport: vi.fn(), updateStatus: vi.fn() }));

vi.mock('@/server/actions/leads', () => ({
  createContactLead: (...args: unknown[]) => state.createLead(...args),
  updateSellerLeadStatus: (...args: unknown[]) => state.updateStatus(...args),
}));
vi.mock('@/server/actions/reports', () => ({ createListingReport: (...args: unknown[]) => state.createReport(...args) }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, locale: _locale, children, ...props }: { href: string; locale?: string; children: React.ReactNode; [key: string]: unknown }) => {
    void _locale;
    return <a href={href} {...props}>{children}</a>;
  },
}));

import { CreateLeadDialog } from '@/components/leads/create-lead-dialog';
import { FinanceLeadDialog } from '@/components/leads/finance-lead-dialog';
import { InsuranceLeadDialog } from '@/components/leads/insurance-lead-dialog';
import { LeadList } from '@/components/leads/lead-list';
import { LeadStatusForm } from '@/components/leads/lead-status-form';
import { ReportListingDialog } from '@/components/listing/report-listing-dialog';

const lead: Lead = {
  publicId: 'led_01',
  channel: 'CHAT',
  status: 'NEW',
  buyerName: 'Buyer Name',
  buyerPhone: '+201001234567',
  note: 'Is this car available?',
  eventsCount: 1,
  lastActivityAt: '2026-09-10T10:00:00.000Z',
  createdAt: '2026-09-10T10:00:00.000Z',
  listing: { publicId: 'lst_01', slug: 'toyota-corolla-2024', title: 'Toyota Corolla 2024' },
  buyer: null,
  seller: null,
};

describe('TASK-051: contact leads and listing reports', () => {
  beforeEach(() => {
    state.createLead.mockResolvedValue({ ok: true, data: lead });
    state.createReport.mockResolvedValue({ ok: true, data: { publicId: 'rpt_01' } });
    state.updateStatus.mockResolvedValue({ ok: true, data: { ...lead, status: 'CONTACTED' } });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('sends a buyer message with one listing-scoped lead payload', async () => {
    render(<CreateLeadDialog listingPublicId="lst_01" locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));
    fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'Buyer Name' } });
    fireEvent.change(screen.getByLabelText('Phone number (optional)'), { target: { value: '+201001234567' } });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Is this car available?' } });
    fireEvent.submit(screen.getByTestId('create-lead-form'));
    await waitFor(() => expect(state.createLead).toHaveBeenCalledTimes(1));
    expect(state.createLead.mock.calls[0]?.[0]).toMatchObject({ listingPublicId: 'lst_01', channel: 'CHAT', note: 'Is this car available?' });
    expect(screen.getByRole('status')).toHaveTextContent('Your message was sent');
  });

  it('keeps buyer phone data out of lead list previews', () => {
    render(<LeadList leads={[lead]} locale="en" />);
    expect(screen.getByText(/Buyer Name/)).toBeInTheDocument();
    expect(screen.queryByText('+201001234567')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view details/i })).toHaveAttribute('href', '/me/leads/led_01');
  });

  it('updates status only after an explicit seller submission', async () => {
    render(<LeadStatusForm publicId="led_01" initialStatus="NEW" locale="en" />);
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'CONTACTED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save status' }));
    await waitFor(() => expect(state.updateStatus).toHaveBeenCalledTimes(1));
    expect(state.updateStatus.mock.calls[0]?.slice(0, 2)).toEqual(['led_01', { status: 'CONTACTED', note: null }]);
  });

  it('submits a report with the exact selected reason and details', async () => {
    render(<ReportListingDialog listingPublicId="lst_01" locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Report listing' }));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'OTHER' } });
    fireEvent.change(screen.getByLabelText('Details (required for Other)'), { target: { value: 'The location is not real.' } });
    fireEvent.submit(screen.getByTestId('report-listing-form'));
    await waitFor(() => expect(state.createReport).toHaveBeenCalledTimes(1));
    expect(state.createReport.mock.calls[0]?.[0]).toEqual({ listingPublicId: 'lst_01', category: 'OTHER', details: 'The location is not real.' });
    expect(screen.getByRole('status')).toHaveTextContent('Report received');
  });

  it('submits a finance request lead with down payment, tenure, and partner consent', async () => {
    render(
      <FinanceLeadDialog
        listingPublicId="lst_01"
        vehicleTitle="Toyota Camry"
        vehiclePriceCents={100000000}
        vehicleYear={2024}
        locale="en"
      />,
    );
    fireEvent.click(screen.getByTestId('finance-lead-button'));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Sara Finance' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+201011112222' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(screen.getByTestId('finance-lead-form'));

    await waitFor(() => expect(state.createLead).toHaveBeenCalledTimes(1));
    const payload = state.createLead.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      listingPublicId: 'lst_01',
      channel: 'FINANCE_REQUEST',
      buyerName: 'Sara Finance',
      buyerPhone: '+201011112222',
    });
    expect(payload.meta).toMatchObject({
      tenureMonths: 36,
      consentGiven: true,
      vehicleTitle: 'Toyota Camry',
    });
    expect(screen.getByRole('status')).toHaveTextContent('Financing Request Received');
  });

  it('submits an insurance quote lead with coverage type, city, and partner consent', async () => {
    render(
      <InsuranceLeadDialog
        listingPublicId="lst_01"
        vehicleTitle="Toyota Camry"
        vehiclePriceCents={100000000}
        vehicleYear={2024}
        locale="en"
      />,
    );
    fireEvent.click(screen.getByTestId('insurance-lead-button'));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Omar Insurance' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '+201033334444' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(screen.getByTestId('insurance-lead-form'));

    await waitFor(() => expect(state.createLead).toHaveBeenCalledTimes(1));
    const payload = state.createLead.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      listingPublicId: 'lst_01',
      channel: 'INSURANCE_REQUEST',
      buyerName: 'Omar Insurance',
      buyerPhone: '+201033334444',
    });
    expect(payload.meta).toMatchObject({
      coverageType: 'COMPREHENSIVE',
      city: 'Cairo',
      consentGiven: true,
    });
    expect(screen.getByRole('status')).toHaveTextContent('Insurance Request Received');
  });
});
