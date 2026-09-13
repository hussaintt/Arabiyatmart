import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import GlobalError from '@/app/global-error';
import LocaleError from '@/app/[locale]/error';
import { PageSkeleton } from '@/components/layout/page-skeleton';
import { buildLocalizedMetadata, canonicalizePublicUrl } from '@/lib/metadata';
import messages from '@/../messages/en.json';
import { reportSafeBoundaryError } from '@/lib/observability/client-error';

afterEach(cleanup);

describe('route boundaries and metadata', () => {
  it('allowlists canonical public query keys and strips private, repeated, tracking, cursor, and unknown keys', () => {
    const query = new URLSearchParams('makeSlug=bmw&cursor=private&utm_source=x&password=secret&makeSlug=audi');
    expect(canonicalizePublicUrl('/en/search', query)).toBe('http://localhost:3000/en/search');
    expect(canonicalizePublicUrl('/en/search', { makeSlug: 'bmw', sort: 'newest', panel: 'private' })).toBe('http://localhost:3000/en/search?makeSlug=bmw&sort=newest');
    expect(() => canonicalizePublicUrl('/en/%252e%252e/private')).toThrow('unsafe segment');
    expect(() => canonicalizePublicUrl('/en/search?token=secret')).toThrow('clean relative pathname');
  });

  it('builds localized canonical/alternate metadata and rejects unapproved social images', () => {
    const metadata = buildLocalizedMetadata({ locale: 'en', path: '/en/search', title: 'Cars', description: 'Find cars', imageUrl: 'https://evil.example/tracker.png', query: { makeSlug: 'bmw', token: 'secret' } });
    expect(metadata.alternates?.canonical).toBe('http://localhost:3000/en/search?makeSlug=bmw');
    expect(metadata.alternates?.languages).toEqual({ ar: 'http://localhost:3000/ar/search?makeSlug=bmw', en: 'http://localhost:3000/en/search?makeSlug=bmw', 'x-default': 'http://localhost:3000/ar/search?makeSlug=bmw' });
    expect(metadata.openGraph?.images).toEqual([{ url: 'http://localhost:3000/images/og-default.jpg' }]);
  });

  it('renders responsive shape-stable loading cards with reduced-motion protection', () => {
    render(<PageSkeleton cards={3} />);
    const skeleton = screen.getByLabelText('Loading');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(skeleton).toHaveClass('motion-reduce:[&_*]:animate-none');
    expect(skeleton.querySelectorAll('.aspect-\\[4\\/3\\]')).toHaveLength(3);
  });

  it('hides raw errors, focuses the alert, emits only a safe digest, and invokes reset once', async () => {
    const reset = vi.fn();
    const reports: unknown[] = [];
    const listener = (event: Event) => reports.push((event as CustomEvent).detail);
    window.addEventListener('arabiyatmart:boundary-error', listener);
    render(<NextIntlClientProvider locale="en" messages={messages}><LocaleError error={Object.assign(new Error('Bearer secret with stack'), { digest: 'safe_digest' })} reset={reset} /></NextIntlClientProvider>);
    expect(screen.queryByText(/Bearer secret|stack/i)).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('alert')));
    expect(reports).toEqual([{ boundary: 'locale', digest: 'safe_digest' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(reset).toHaveBeenCalledOnce();
    window.removeEventListener('arabiyatmart:boundary-error', listener);
  });

  it('drops unsafe digests and raw errors from the global boundary report and DOM', async () => {
    const reports: unknown[] = [];
    const listener = (event: Event) => reports.push((event as CustomEvent).detail);
    window.addEventListener('arabiyatmart:boundary-error', listener);
    const markup = renderToStaticMarkup(<GlobalError error={Object.assign(new Error('password=secret'), { digest: 'unsafe digest with spaces' })} reset={() => {}} />);
    expect(markup).not.toMatch(/password=secret|unsafe digest/i);
    reportSafeBoundaryError({ boundary: 'global', digest: null });
    expect(reports).toEqual([{ boundary: 'global', digest: null }]);
    window.removeEventListener('arabiyatmart:boundary-error', listener);
  });
});
