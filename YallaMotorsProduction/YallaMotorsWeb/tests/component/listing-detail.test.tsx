import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

vi.mock('server-only', () => ({}));

// Mock routing
const routingState = vi.hoisted(() => ({
  pathname: '/ar/listing/toyota-corolla-2024-lst01h7',
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('@/i18n/routing', () => ({
  Link: ({
    href,
    locale,
    children,
    onClick,
    className,
    ...props
  }: {
    href: string;
    locale?: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    className?: string;
    [key: string]: unknown;
  }) => (
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
  ),
  usePathname: () => routingState.pathname,
  useRouter: () => ({
    push: routingState.push,
    replace: routingState.replace,
  }),
}));

// Mock next/navigation
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

// Mock next-intl/server
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    className,
    fill: _unusedFill,
    priority: _unusedPriority,
    sizes: _unusedSizes,
    onError,
    onClick,
    ...props
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
    className?: string;
    onError?: () => void;
    onClick?: React.MouseEventHandler<HTMLImageElement>;
    [key: string]: unknown;
  }) => {
    void _unusedFill;
    void _unusedPriority;
    void _unusedSizes;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} onError={onError} onClick={onClick} {...props} />;
  },
}));

// Mock server queries
const mockGetListing = vi.fn();
const mockGetSimilarListings = vi.fn();
vi.mock('@/server/queries/listings', () => ({
  getListing: (...args: unknown[]) => mockGetListing(...args),
  getSimilarListings: (...args: unknown[]) => mockGetSimilarListings(...args),
}));

// Mock favorites actions
vi.mock('@/server/actions/favorites', () => ({
  addFavorite: vi.fn().mockResolvedValue({ ok: true, data: { favorited: true } }),
  removeFavorite: vi.fn().mockResolvedValue({ ok: true, data: { favorited: false } }),
}));

import ListingDetailPage, {
  generateMetadata,
} from '@/app/[locale]/(marketplace)/listing/[slug]/page';
import ListingDetailLoading from '@/app/[locale]/(marketplace)/listing/[slug]/loading';
import { ListingGallery, deriveMediaItems } from '@/components/listing/listing-gallery';
import {
  ListingSummary,
  sanitizePlainText,
  serializeJsonLd,
} from '@/components/listing/listing-summary';
import { SpecificationGroups } from '@/components/listing/specification-groups';
import { SellerCard } from '@/components/listing/seller-card';
import { ListingActionPanel } from '@/components/listing/listing-action-panel';
import { ApiContractError } from '@/lib/api/schemas/common';
import { AppProviders } from '@/providers/app-providers';
import { createListingDetail, createListingCard } from '../fixtures/factories';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TASK-031: Listing Detail, Gallery, Specifications, and Similar Inventory', () => {
  const baseListing = createListingDetail();

  beforeEach(() => {
    mockGetListing.mockResolvedValue({ data: baseListing });
    mockGetSimilarListings.mockResolvedValue({
      data: [
        createListingCard({
          publicId: 'lst_similar_1',
          title: 'تويوتا كورولا 2023 فئة ثانية',
          slug: 'toyota-corolla-2023-similar1',
        }),
      ],
    });
  });

  describe('ListingDetailPage (RSC)', () => {
    it('renders server-rendered title, breadcrumb, key facts, seller card, and similar items', async () => {
      const pageJsx = await ListingDetailPage({
        params: Promise.resolve({ locale: 'ar', slug: baseListing.slug }),
      });

      render(<AppProviders initialSession={null}>{pageJsx}</AppProviders>);

      // Title rendered
      expect(screen.getByRole('heading', { level: 1, name: baseListing.title })).toBeInTheDocument();

      // Breadcrumbs
      expect(screen.getByRole('navigation', { name: /مسار التنقل|Breadcrumbs/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /الرئيسية/i })).toBeInTheDocument();

      // Key facts
      expect(screen.getAllByText(/سنة الصنع/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/المسافة المقطوعة/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/ناقل الحركة/i).length).toBeGreaterThan(0);

      // Seller information
      expect(screen.getAllByTestId('seller-card').length).toBeGreaterThan(0);

      // Similar listings section
      expect(screen.getByTestId('similar-listings-section')).toBeInTheDocument();
      expect(screen.getByText('تويوتا كورولا 2023 فئة ثانية')).toBeInTheDocument();
    });

    it('generates localized dynamic metadata and canonical alternates', async () => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ locale: 'ar', slug: baseListing.slug }),
      });

      expect(metadata.title).toContain(baseListing.title);
      expect(metadata.alternates?.canonical).toBe(`/ar/listing/${baseListing.slug}`);
      expect(metadata.openGraph?.title).toContain(baseListing.title);
      expect((metadata.openGraph as { type?: string } | undefined)?.type).toBe('website');
    });

    it('renders sold listing with sold-banner notice and does not throw notFound()', async () => {
      const soldListing = createListingDetail({ status: 'SOLD' });
      mockGetListing.mockResolvedValue({ data: soldListing });

      const pageJsx = await ListingDetailPage({
        params: Promise.resolve({ locale: 'ar', slug: soldListing.slug }),
      });

      render(<AppProviders initialSession={null}>{pageJsx}</AppProviders>);

      // Sold banner is visible
      expect(screen.getByTestId('sold-banner')).toBeInTheDocument();
      expect(screen.getByText(/تم بيع هذه المركبة/i)).toBeInTheDocument();
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it('throws notFound() when slug is invalid or listing returns 404', async () => {
      // 1. Invalid slug (fails SlugSchema with capital letters / invalid characters)
      await expect(
        ListingDetailPage({
          params: Promise.resolve({ locale: 'ar', slug: 'INVALID_SLUG_@@@' }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');

      // 2. Upstream 404 ApiContractError with status 404
      const notFoundStatusError = new ApiContractError({
        error: {
          code: 'NOT_FOUND',
          message: 'Listing not found',
          status: 404,
          requestId: 'req-404',
          fieldErrors: [],
          details: null,
          retryAfterSeconds: null,
        },
      });
      mockGetListing.mockRejectedValue(notFoundStatusError);
      await expect(
        ListingDetailPage({
          params: Promise.resolve({ locale: 'ar', slug: 'non-existent-car-listing' }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');

      // 3. Upstream ApiContractError with code NOT_FOUND
      const notFoundCodeError = new ApiContractError({
        error: {
          code: 'NOT_FOUND',
          message: 'Car listing does not exist',
          status: 400,
          requestId: 'req-404-code',
          fieldErrors: [],
          details: null,
          retryAfterSeconds: null,
        },
      });
      mockGetListing.mockRejectedValue(notFoundCodeError);
      await expect(
        ListingDetailPage({
          params: Promise.resolve({ locale: 'ar', slug: 'non-existent-car-listing' }),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('propagates server, timeout, and network errors without converting to 404', async () => {
      // 1. Upstream 500 ApiContractError
      const serverContractError = new ApiContractError({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
          status: 500,
          requestId: 'req-500',
          fieldErrors: [],
          details: null,
          retryAfterSeconds: null,
        },
      });
      mockGetListing.mockRejectedValue(serverContractError);

      await expect(
        ListingDetailPage({
          params: Promise.resolve({ locale: 'ar', slug: baseListing.slug }),
        })
      ).rejects.toThrow(serverContractError);

      // 2. Generic / timeout / port 4040 error
      const timeoutError = new Error('Gateway timeout connecting to upstream port 4040');
      mockGetListing.mockRejectedValue(timeoutError);

      await expect(
        ListingDetailPage({
          params: Promise.resolve({ locale: 'ar', slug: baseListing.slug }),
        })
      ).rejects.toThrow(timeoutError);
    });

    it('renders gracefully when listing has no images (empty gallery state)', async () => {
      const noImageListing = createListingDetail({ images: [] });
      mockGetListing.mockResolvedValue({ data: noImageListing });

      const pageJsx = await ListingDetailPage({
        params: Promise.resolve({ locale: 'ar', slug: noImageListing.slug }),
      });

      render(<AppProviders initialSession={null}>{pageJsx}</AppProviders>);

      expect(screen.getByTestId('listing-gallery-empty')).toBeInTheDocument();
    });

    it('degrades gracefully when similar listings request fails', async () => {
      mockGetSimilarListings.mockRejectedValue(new Error('Network error'));

      const pageJsx = await ListingDetailPage({
        params: Promise.resolve({ locale: 'ar', slug: baseListing.slug }),
      });

      render(<AppProviders initialSession={null}>{pageJsx}</AppProviders>);

      // Page still renders successfully without erroring out
      expect(screen.getByRole('heading', { level: 1, name: baseListing.title })).toBeInTheDocument();
      expect(screen.queryByTestId('similar-listings-section')).not.toBeInTheDocument();
    });
  });

  describe('ListingGallery (Client Component)', () => {
    it('renders hero image, thumbnail strip, and opens lightbox with focus trap and keyboard navigation', async () => {
      render(
        <ListingGallery
          listingPublicId={baseListing.publicId}
          images={baseListing.images}
          title={baseListing.title}
          locale="ar"
        />
      );

      // Hero image and thumbnail strip
      expect(screen.getByTestId('listing-gallery')).toBeInTheDocument();
      expect(screen.getByTestId('gallery-index-indicator')).toHaveTextContent('1 / 2');

      // Open lightbox by clicking "View all photos" button
      const openBtn = screen.getByRole('button', { name: /عرض كافة الصور/i });
      fireEvent.click(openBtn);

      // Lightbox is rendered with role="dialog"
      const dialog = screen.getByRole('dialog', { name: /معرض صور السيارة مكبر/i });
      expect(dialog).toBeInTheDocument();
      expect(screen.getByTestId('gallery-counter')).toHaveTextContent('1 / 2');

      // In Arabic (RTL), pressing ArrowLeft advances to next image (2 / 2)
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(screen.getByTestId('gallery-counter')).toHaveTextContent('2 / 2');

      // Pressing ArrowRight goes back to previous image (1 / 2)
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(screen.getByTestId('gallery-counter')).toHaveTextContent('1 / 2');

      // Pressing Escape closes the lightbox
      fireEvent.keyDown(window, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('pre-renders all slides in the gallery deck and navigates via thumbnail clicks and hero arrows', () => {
      render(
        <ListingGallery
          listingPublicId={baseListing.publicId}
          images={baseListing.images}
          title={baseListing.title}
          locale="ar"
        />
      );

      // Hero indicator starts at 1 / 2
      expect(screen.getByTestId('gallery-index-indicator')).toHaveTextContent('1 / 2');

      // Click next hero arrow (in Arabic RTL, next photo button advances to 2 / 2)
      const nextBtn = screen.getByRole('button', { name: 'الصورة التالية' });
      fireEvent.click(nextBtn);

      expect(screen.getByTestId('gallery-index-indicator')).toHaveTextContent('2 / 2');

      // Click prev hero arrow
      const prevBtn = screen.getByRole('button', { name: 'الصورة السابقة' });
      fireEvent.click(prevBtn);

      expect(screen.getByTestId('gallery-index-indicator')).toHaveTextContent('1 / 2');
    });
  });

  describe('ListingSummary (RSC)', () => {
    it('renders price with integer cents formatting, negotiable status, and badges', () => {
      render(
        <ListingSummary
          listing={baseListing}
          locale="ar"
        />
      );

      expect(screen.getByText(/650,000/)).toBeInTheDocument();
      expect(screen.getByText(/(قابل للتفاوض)/i)).toBeInTheDocument();
      expect(screen.getByText(/إمكانية التقسيط متوفرة/i)).toBeInTheDocument();
      expect(screen.getByTestId('listing-posted-date')).toHaveTextContent(/تاريخ النشر/);
    });
  });

  describe('SpecificationGroups (RSC)', () => {
    it('renders grouped technical specifications and equipment pills', () => {
      render(
        <SpecificationGroups
          listing={baseListing}
          locale="ar"
        />
      );

      expect(screen.getByTestId('specification-groups')).toBeInTheDocument();
      expect(screen.getByText(/المحرك والأداء/i)).toBeInTheDocument();
      expect(screen.getByText(/١٦٠٠ سي سي|1600 cc/)).toBeInTheDocument();
      expect(screen.getByText(/الميزات والتجهيزات/i)).toBeInTheDocument();
      expect(screen.getByText('ABS')).toBeInTheDocument();
      expect(screen.getByText('Sunroof')).toBeInTheDocument();
    });
  });

  describe('SellerCard (RSC)', () => {
    it('renders verified dealer information with rating and link to inventory', () => {
      render(
        <SellerCard
          listing={baseListing}
          locale="ar"
        />
      );

      expect(screen.getByTestId('seller-card')).toBeInTheDocument();
      expect(screen.getByText('الفطيم للسيارات')).toBeInTheDocument();
      expect(screen.getByText('معتمد')).toBeInTheDocument();
      expect(screen.getByText(/4.8/)).toBeInTheDocument();
      expect(screen.getByText(/تصفح كافة سيارات المعرض/i)).toBeInTheDocument();
    });

    it('renders private seller layout when sellerType is PRIVATE', () => {
      const privateListing = createListingDetail({
        sellerType: 'PRIVATE',
        vendor: null,
      });

      render(
        <SellerCard
          listing={privateListing}
          locale="ar"
        />
      );

      expect(screen.getByText('بائع خاص')).toBeInTheDocument();
      expect(screen.queryByText(/تصفح كافة سيارات المعرض/i)).not.toBeInTheDocument();
    });
  });

  describe('ListingActionPanel (Client Component)', () => {
    it('reveals a safe sanitized phone number and keeps WhatsApp without an on-site message CTA', () => {
      render(
        <AppProviders initialSession={null}>
          <ListingActionPanel listing={baseListing} locale="ar" />
        </AppProviders>
      );

      expect(screen.queryByTestId('desktop-call-button')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('desktop-phone-reveal-button'));

      const desktopCallBtn = screen.getByTestId('desktop-call-button');
      expect(desktopCallBtn).toHaveAttribute('href', `tel:${baseListing.contactPhone}`);

      // Desktop WhatsApp button
      const desktopWhatsappBtn = screen.getByTestId('desktop-whatsapp-button');
      expect(desktopWhatsappBtn.getAttribute('href')).toContain('https://wa.me/201000000000');

      expect(screen.queryByTestId('desktop-offer-button')).not.toBeInTheDocument();
      expect(screen.queryByText(/إرسال رسالة|Send Message/i)).not.toBeInTheDocument();

      // Mobile sticky bar
      expect(screen.getByTestId('listing-action-panel-mobile')).toBeInTheDocument();
    });

    it('disables or omits action links when vehicle is sold', () => {
      const soldListing = createListingDetail({ status: 'SOLD' });

      render(
        <AppProviders initialSession={null}>
          <ListingActionPanel listing={soldListing} locale="ar" />
        </AppProviders>
      );

      expect(screen.queryByTestId('desktop-call-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('desktop-whatsapp-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('desktop-offer-button')).not.toBeInTheDocument();
      expect(screen.getByText('المركبة مباعة')).toBeInTheDocument();
    });
  });

  describe('ListingDetailLoading (RSC)', () => {
    it('renders the skeleton loading state', () => {
      render(<ListingDetailLoading />);
      expect(screen.getByTestId('listing-detail-loading')).toBeInTheDocument();
    });
  });

  describe('deriveMediaItems (Media Identity Derivation)', () => {
    it('derives stable identity without relying on array index', () => {
      const images = [
        { url: 'https://images.arabiyatmart.com/img1.webp', isCover: true, sortOrder: 0 },
        { url: 'https://images.arabiyatmart.com/img2.webp', isCover: false, sortOrder: 1 },
      ];

      const items = deriveMediaItems(images, 'Toyota Corolla');
      expect(items[0]?.id).toBe('0:https://images.arabiyatmart.com/img1.webp');
      expect(items[1]?.id).toBe('1:https://images.arabiyatmart.com/img2.webp');

      // Reordering input array does not change the resulting item IDs
      const reversed = [images[1]!, images[0]!];
      const reversedItems = deriveMediaItems(reversed, 'Toyota Corolla');
      expect(reversedItems[0]?.id).toBe('0:https://images.arabiyatmart.com/img1.webp');
      expect(reversedItems[1]?.id).toBe('1:https://images.arabiyatmart.com/img2.webp');
    });

    it('safely handles identical duplicates without colliding IDs', () => {
      const duplicateImages = [
        { url: 'https://images.arabiyatmart.com/img1.webp', isCover: true, sortOrder: 0 },
        { url: 'https://images.arabiyatmart.com/img1.webp', isCover: false, sortOrder: 0 },
      ];

      const items = deriveMediaItems(duplicateImages, 'Toyota Corolla');
      expect(items).toHaveLength(2);
      expect(items[0]?.id).toBe('0:https://images.arabiyatmart.com/img1.webp');
      expect(items[1]?.id).toBe('0:https://images.arabiyatmart.com/img1.webp:1');
      expect(items[0]?.id).not.toBe(items[1]?.id);
    });
  });

  describe('Description Sanitization & JSON-LD Escaping', () => {
    it('strips HTML, style, and script tags from untrusted text', () => {
      const untrusted = `
        <p>Excellent condition.</p>
        <script>alert('xss')</script>
        <style>body { display: none; }</style>
        <div onclick="steal()">One owner, regular agency service.</div>
        <!-- comment -->
        &amp; certified &quot;ready to drive&quot;
      `;

      const clean = sanitizePlainText(untrusted);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('alert');
      expect(clean).not.toContain('<style>');
      expect(clean).not.toContain('display: none');
      expect(clean).not.toContain('<div');
      expect(clean).not.toContain('onclick');
      expect(clean).toContain('Excellent condition.');
      expect(clean).toContain('One owner, regular agency service.');
      expect(clean).toContain('& certified "ready to drive"');
    });

    it('escapes JSON-LD payload to prevent </script> tag injection', () => {
      const payload = {
        description: 'Car info </script><script>alert("pwned")</script>',
        note: '<img src=x onerror=alert(1)> & test',
      };

      const serialized = serializeJsonLd(payload);
      expect(serialized).not.toContain('</script>');
      expect(serialized).not.toContain('<script>');
      expect(serialized).toContain('\\u003c/script\\u003e');
      expect(serialized).toContain('\\u003cscript\\u003e');
      expect(serialized).toContain('\\u0026');
    });

    it('renders sanitized description in DOM and safely escaped in JSON-LD script', async () => {
      const xssListing = createListingDetail({
        description: {
          ar: 'حالة ممتازة <script>alert("hack")</script> صيانة كاملة </script><script>evil()</script>',
        },
      });
      mockGetListing.mockResolvedValue({ data: xssListing });

      const pageJsx = await ListingDetailPage({
        params: Promise.resolve({ locale: 'ar', slug: xssListing.slug }),
      });

      const { container } = render(<AppProviders initialSession={null}>{pageJsx}</AppProviders>);

      // Rendered description does not contain raw script tags
      expect(screen.queryByText(/<script>/)).not.toBeInTheDocument();
      expect(screen.queryByText(/alert\("hack"\)/)).not.toBeInTheDocument();

      // Script tag has escaped JSON-LD
      const scriptTag = container.querySelector('script[type="application/ld+json"]');
      expect(scriptTag).toBeInTheDocument();
      const rawHtml = scriptTag?.innerHTML ?? '';
      expect(rawHtml).not.toContain('</script>');
      expect(rawHtml).not.toContain('<script>');
    });
  });
});
