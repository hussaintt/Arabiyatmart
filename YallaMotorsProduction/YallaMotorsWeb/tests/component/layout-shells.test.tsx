import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routing = vi.hoisted(() => ({ pathname: '/profile' }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, locale, children, onClick, prefetch: _prefetch, ...props }: { href: string; locale?: string; children: React.ReactNode; onClick?: React.MouseEventHandler<HTMLAnchorElement>; prefetch?: boolean; [key: string]: unknown }) => {
    void _prefetch;
    return (
      <a
        href={href}
        data-locale={locale}
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event);
        }}
        {...props}
      >
        {children}
      </a>
    );
  },
  usePathname: () => routing.pathname,
}));

import { AccountSidebar } from '@/components/layout/account-sidebar';
import { AccountTabletNav } from '@/components/layout/account-tablet-nav';
import { ConnectivityStatus } from '@/components/layout/connectivity-status';
import { DesktopNav } from '@/components/layout/desktop-nav';
import { MobileNav } from '@/components/layout/mobile-nav';
import { SiteHeader } from '@/components/layout/site-header';
import { AppProviders } from '@/providers/app-providers';

afterEach(cleanup);
beforeEach(() => { routing.pathname = '/profile'; });

function Shell() {
  return <AppProviders initialSession={null}><SiteHeader locale="en" /><main id="main-content" className="mx-auto w-full max-w-7xl"><AccountTabletNav locale="en" /><AccountSidebar locale="en" /><p>Content</p></main><MobileNav locale="en" /></AppProviders>;
}

describe('responsive layout shells', () => {
  it('exposes unique labelled navigation landmarks and a constrained content region', () => {
    render(<Shell />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
    expect(document.querySelector('#main-content')).toHaveClass('max-w-7xl');
  });

  it('uses exact mobile, tablet, and desktop visibility boundaries without a tablet navigation gap', () => {
    const view = render(<AppProviders initialSession={null}><SiteHeader locale="en" /><MobileNav locale="en" /><AccountTabletNav locale="en" /><AccountSidebar locale="en" /></AppProviders>);
    expect(view.container.querySelector('nav[aria-label="Mobile navigation"]')).toHaveClass('sm:hidden');
    expect(view.container.querySelector('nav[aria-label="Primary navigation"]')).toHaveClass('sm:flex');
    expect(screen.getByRole('button', { name: 'Account navigation' }).parentElement).toHaveClass('sm:block', 'lg:hidden');
    expect(view.container.querySelector('aside')).toHaveClass('lg:block');
  });

  it('opens the tablet account rail, marks the active route, and closes after navigation', () => {
    render(<AccountTabletNav locale="en" />);
    const toggle = screen.getByRole('button', { name: 'Account navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const profile = screen.getByRole('link', { name: 'Profile' });
    expect(profile).toHaveAttribute('aria-current', 'page');
    fireEvent.click(profile);
    expect(screen.queryByRole('navigation', { name: 'Account navigation' })).not.toBeInTheDocument();
  });

  it('preserves the current route when switching locale', () => {
    render(<AppProviders initialSession={null}><SiteHeader locale="ar" /></AppProviders>);
    const switcher = screen.getByRole('link', { name: 'EN' });
    expect(switcher).toHaveAttribute('href', '/profile');
    expect(switcher).toHaveAttribute('data-locale', 'en');
  });

  it('keeps the connectivity hint absent during the server-equivalent first render', () => {
    render(<ConnectivityStatus locale="en" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps navigation labels in server-renderable desktop and sidebar components', () => {
    render(<><DesktopNav locale="ar" /><AccountSidebar locale="ar" /></>);
    expect(screen.getByRole('link', { name: 'بحث السيارات' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'الملف الشخصي' })).toBeInTheDocument();
  });

  it('marks the current desktop route with an accessible active state', () => {
    routing.pathname = '/search';
    render(<DesktopNav locale="en" />);
    expect(screen.getByRole('link', { name: 'Search cars' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });
});
