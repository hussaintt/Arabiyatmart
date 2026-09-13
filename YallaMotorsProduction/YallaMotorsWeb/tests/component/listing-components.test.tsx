import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

// Mock routing
const routingState = vi.hoisted(() => ({
  pathname: '/search',
  push: vi.fn(),
}));

vi.mock('@/i18n/routing', () => ({
  Link: ({
    href,
    locale,
    children,
    onClick,
    className,
    prefetch: _prefetch,
    ...props
  }: {
    href: string;
    locale?: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    className?: string;
    prefetch?: boolean;
    [key: string]: unknown;
  }) => {
    void _prefetch;
    return (
      <a
        href={href}
        data-locale={locale}
        className={className}
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
  usePathname: () => routingState.pathname,
  useRouter: () => ({ push: routingState.push }),
}));

// Mock Next image
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
    fill: _unusedFill,
    priority: _unusedPriority,
    sizes: _unusedSizes,
    ...props
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
    className?: string;
    [key: string]: unknown;
  }) => {
    void _unusedFill;
    void _unusedPriority;
    void _unusedSizes;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} {...props} />;
  },
}));

// Mock server actions
const mockAddFavorite = vi.fn();
const mockRemoveFavorite = vi.fn();
vi.mock('@/server/actions/favorites', () => ({
  addFavorite: (args: unknown) => mockAddFavorite(args),
  removeFavorite: (args: unknown) => mockRemoveFavorite(args),
}));

import { ListingCard } from '@/components/listing/listing-card';
import { ListingGrid } from '@/components/listing/listing-grid';
import { EmptyListings } from '@/components/listing/empty-listings';
import { FavoriteButton } from '@/components/listing/favorite-button';
import { ContactActions } from '@/components/listing/contact-actions';
import { AppProviders } from '@/providers/app-providers';
import type { SafeSession } from '@/types/auth';
import { createListingCard, createSafeSession } from '../fixtures/factories';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ListingCard Component', () => {
  it('renders semantic listing card with localized title, formatted price, specs, and badges', () => {
    const listing = createListingCard({
      isFeatured: true,
      condition: 'NEW',
      isSellerVerified: true,
      isFavorited: false,
    });

    render(
      <AppProviders initialSession={null}>
        <ListingCard listing={listing} locale="ar" />
      </AppProviders>
    );

    // Card article
    const article = screen.getByTestId(`listing-card-${listing.publicId}`);
    expect(article).toBeInTheDocument();

    // Badges in Arabic
    expect(screen.getByText('مميز')).toBeInTheDocument();
    expect(screen.getByText('جديد')).toBeInTheDocument();
    expect(screen.getByText('موثق')).toBeInTheDocument();

    // Title and Link
    const link = screen.getByRole('link', { name: new RegExp(listing.title, 'i') });
    expect(link).toHaveAttribute('href', `/listing/${listing.slug}`);

    // Price formatted (integer cents)
    expect(screen.getByText(/650,000/)).toBeInTheDocument();

    // Specs
    expect(screen.getByText(/2024/)).toBeInTheDocument();
    expect(screen.getByText(/القاهرة/)).toBeInTheDocument();
  });

  it('renders English locale correctly', () => {
    const listing = createListingCard({
      title: '',
      isFeatured: false,
      condition: 'USED',
      sellerType: 'PRIVATE',
    });

    render(
      <AppProviders initialSession={null}>
        <ListingCard listing={listing} locale="en" />
      </AppProviders>
    );

    // Constructed title from make, model, year
    expect(screen.getByText(/Toyota Corolla 2024/)).toBeInTheDocument();
    expect(screen.getByText('Private Seller')).toBeInTheDocument();
    expect(screen.getByText(/Cairo/)).toBeInTheDocument();
  });

  it('avoids nested interactive elements (no button inside link)', () => {
    const listing = createListingCard();

    const { container } = render(
      <AppProviders initialSession={null}>
        <ListingCard listing={listing} locale="ar" />
      </AppProviders>
    );

    // No <button> should be a descendant of any <a>
    const anchors = container.querySelectorAll('a');
    anchors.forEach((a) => {
      expect(a.querySelector('button')).toBeNull();
    });
  });

  it('renders fallback artwork when coverImageUrl is absent', () => {
    const listing = createListingCard({ coverImageUrl: null });

    render(
      <AppProviders initialSession={null}>
        <ListingCard listing={listing} locale="ar" />
      </AppProviders>
    );

    expect(screen.getByText('لا توجد صورة')).toBeInTheDocument();
  });
});

describe('ListingGrid Component', () => {
  it('renders responsive grid with cards', () => {
    const listings = [
      createListingCard({ publicId: 'lst_1', slug: 'car-1' }),
      createListingCard({ publicId: 'lst_2', slug: 'car-2' }),
    ];

    render(
      <AppProviders initialSession={null}>
        <ListingGrid listings={listings} locale="ar" columns={4} />
      </AppProviders>
    );

    const grid = screen.getByTestId('listing-grid');
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2', 'xl:grid-cols-4');
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('renders EmptyListings when listing array is empty', () => {
    render(
      <AppProviders initialSession={null}>
        <ListingGrid
          listings={[]}
          locale="ar"
          emptyTitle="لا توجد نتائج"
          emptyActionHref="/search"
          emptyActionLabel="إعادة تعيين"
        />
      </AppProviders>
    );

    expect(screen.getByTestId('empty-listings')).toBeInTheDocument();
    expect(screen.getByText('لا توجد نتائج')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'إعادة تعيين' })).toHaveAttribute('href', '/search');
  });
});

describe('EmptyListings Component', () => {
  it('renders accessible empty state with default localized copy', () => {
    render(
      <AppProviders initialSession={null}>
        <EmptyListings locale="en" />
      </AppProviders>
    );

    expect(screen.getByRole('heading', { level: 3, name: 'No vehicles found' })).toBeInTheDocument();
  });
});

describe('FavoriteButton Component', () => {
  beforeEach(() => {
    routingState.push.mockReset();
    mockAddFavorite.mockReset();
    mockRemoveFavorite.mockReset();
  });

  it('redirects anonymous user to login on click with returnTo target', () => {
    render(
      <AppProviders initialSession={null}>
        <FavoriteButton listingId="lst_123" slug="test-car" initialFavorited={false} locale="ar" />
      </AppProviders>
    );

    const button = screen.getByRole('button', { name: 'إضافة إلى المفضلة' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);

    expect(routingState.push).toHaveBeenCalledWith(
      expect.stringContaining('/login?returnTo=')
    );
    expect(mockAddFavorite).not.toHaveBeenCalled();
  });

  it('optimistically toggles favorite state and calls server action for authenticated user', async () => {
    const session = createSafeSession() as unknown as SafeSession;
    mockAddFavorite.mockResolvedValueOnce({ ok: true, data: { favorited: true } });

    render(
      <AppProviders initialSession={session}>
        <FavoriteButton listingId="lst_123" slug="test-car" initialFavorited={false} locale="ar" />
      </AppProviders>
    );

    const button = screen.getByRole('button', { name: 'إضافة إلى المفضلة' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);

    // Optimistic toggle: immediately pressed
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(mockAddFavorite).toHaveBeenCalledWith({ publicId: 'lst_123' });

    await waitFor(() => {
      expect(button).toHaveAttribute('aria-label', 'إزالة من المفضلة');
    });
  });

  it('rolls back optimistic toggle when server action fails', async () => {
    const session = createSafeSession() as unknown as SafeSession;
    mockAddFavorite.mockResolvedValueOnce({
      ok: false,
      error: { status: 500, code: 'ERROR', message: 'Failed to favorite' },
    });

    render(
      <AppProviders initialSession={session}>
        <FavoriteButton listingId="lst_123" slug="test-car" initialFavorited={false} locale="ar" />
      </AppProviders>
    );

    const button = screen.getByRole('button', { name: 'إضافة إلى المفضلة' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);

    // Wait for rollback
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to favorite');
  });

  it('disables button while request is in flight to prevent rapid double toggles', async () => {
    const session = createSafeSession() as unknown as SafeSession;
    let resolvePromise: (val: unknown) => void = () => {};
    mockAddFavorite.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
    );

    render(
      <AppProviders initialSession={session}>
        <FavoriteButton listingId="lst_123" slug="test-car" initialFavorited={false} locale="ar" />
      </AppProviders>
    );

    const button = screen.getByRole('button', { name: 'إضافة إلى المفضلة' });
    fireEvent.click(button);

    // Should be disabled
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    // Click again while disabled
    fireEvent.click(button);
    expect(mockAddFavorite).toHaveBeenCalledTimes(1);

    // Resolve in-flight request
    resolvePromise({ ok: true, data: { favorited: true } });
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });
});

describe('ContactActions Component', () => {
  it('renders validated tel: and WhatsApp HTTPS URLs with safe attributes', () => {
    const onContactClick = vi.fn();

    render(
      <ContactActions
        phone="+201000000001"
        whatsapp="+201000000001"
        locale="ar"
        onContactClick={onContactClick}
      />
    );

    const callLink = screen.getByRole('link', { name: 'الاتصال بالبائع' });
    expect(callLink).toHaveAttribute('href', 'tel:+201000000001');

    const waLink = screen.getByRole('link', { name: 'مراسلة عبر واتساب' });
    expect(waLink).toHaveAttribute('href', 'https://wa.me/201000000001');
    expect(waLink).toHaveAttribute('target', '_blank');
    expect(waLink).toHaveAttribute('rel', 'noopener noreferrer');

    fireEvent.click(callLink);
    expect(onContactClick).toHaveBeenCalledWith('call');

    fireEvent.click(waLink);
    expect(onContactClick).toHaveBeenCalledWith('whatsapp');
  });

  it('sanitizes non-digits and rejects invalid protocols or strings', () => {
    render(
      <ContactActions
        phone="javascript:alert(1)"
        whatsapp="ftp://malicious.url"
        locale="en"
      />
    );

    // Neither is valid -> renders null
    expect(screen.queryByRole('link')).toBeNull();
  });
});
