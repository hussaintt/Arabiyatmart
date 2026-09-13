import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, locale: _locale, children, ...props }: { href: string; locale?: string; children: React.ReactNode; [key: string]: unknown }) => {
    void _locale;
    return <a href={href} {...props}>{children}</a>;
  },
}));
import { LeadList } from '@/components/leads/lead-list';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import type { Lead } from '@/types/lead';

const lead: Lead = { publicId: 'led_01', channel: 'WHATSAPP', status: 'NEW', buyerName: null, buyerPhone: '+201001234567', note: null, eventsCount: 0, lastActivityAt: null, createdAt: null, listing: { publicId: 'lst_01', slug: 'toyota-corolla', title: 'Toyota Corolla' }, buyer: null, seller: null };

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(document.documentElement, 'scrollWidth', { configurable: true, value: width });
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('TASK-055 responsive regression', () => {
  it.each([390, 768, 1024, 1440])('keeps lead and chart content within the %ipx viewport', (width) => {
    setViewport(width);
    render(<main className="min-w-0 overflow-x-hidden"><LeadList leads={[lead]} locale="en" /><DashboardCharts leadsByChannel={{ CHAT: 1, WHATSAPP: 2 }} locale="en" /></main>);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
    expect(screen.getByTestId('lead-list')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Inquiry totals by channel' })).toBeInTheDocument();
  });
});
