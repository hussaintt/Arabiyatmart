import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

vi.mock('server-only', () => ({}));

// Mock routing
const routingState = vi.hoisted(() => ({
  pathname: '/ar/dealers/al-futtaim-motors',
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => routingState.pathname,
  useRouter: () => ({
    push: routingState.push,
    replace: routingState.replace,
  }),
  useSearchParams: () => routingState.searchParams,
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
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

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
}));

vi.mock('@/providers/session-provider', () => ({
  useSession: () => ({
    session: null,
    status: 'unauthenticated',
    refreshSession: vi.fn(),
  }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({
      setQueryData: vi.fn(),
      invalidateQueries: vi.fn(),
    }),
  };
});

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

// Mock server queries
const mockGetDealer = vi.fn();
const mockGetDealerListings = vi.fn();
vi.mock('@/server/queries/dealers', () => ({
  getDealer: (...args: unknown[]) => mockGetDealer(...args),
  getDealerListings: (...args: unknown[]) => mockGetDealerListings(...args),
}));

import DealerProfilePage, { generateMetadata } from '@/app/[locale]/(marketplace)/dealers/[slug]/page';
import DealerProfileLoading from '@/app/[locale]/(marketplace)/dealers/[slug]/loading';
import { DealerHeader } from '@/components/dealer/dealer-header';
import { DealerAbout } from '@/components/dealer/dealer-about';
import { BusinessHours, isDayOpen, checkIsOpenNow } from '@/components/dealer/business-hours';
import { DealerInventory } from '@/components/dealer/dealer-inventory';
import { dealerProfilePolicy, dealerListingsPolicy } from '@/lib/cache/policy';
import { ApiContractError } from '@/lib/api/schemas/common';
import type { DealerProfile, WeeklyBusinessHours } from '@/types/dealer';
import type { JsonValue } from '@/types/common';
import type { ListingCard } from '@/types/listing';

const mockWeeklyHours: WeeklyBusinessHours = {
  saturday: { open: '09:00', close: '21:00', closed: false },
  sunday: { open: '09:00', close: '21:00', closed: false },
  monday: { open: '09:00', close: '21:00', closed: false },
  tuesday: { open: '09:00', close: '21:00', closed: false },
  wednesday: { open: '09:00', close: '21:00', closed: false },
  thursday: { open: '20:00', close: '02:00', closed: false, isOvernight: true }, // Overnight test
  friday: { open: '14:00', close: '22:00', closed: true }, // Closed day test
};

const mockDealerProfile: DealerProfile = {
  publicId: 'dlr_futtaim_01',
  slug: 'al-futtaim-motors',
  displayName: { ar: 'الفطيم للسيارات', en: 'Al-Futtaim Motors' },
  description: {
    ar: 'الموزع المعتمد لأكبر العلامات التجارية في الشرق الأوسط.',
    en: 'Certified distributor of premier automotive brands in Egypt.',
  },
  logoUrl: 'https://images.arabiyatmart.com/dealers/futtaim.webp',
  bannerUrl: 'https://images.arabiyatmart.com/dealers/futtaim-banner.webp',
  storeType: 'COMPANY',
  isVerified: true,
  activeListingCount: 15,
  branchCount: 1,
  ratingAverage: 4.9,
  reviewCount: 120,
  branches: [
    {
      publicId: 'brn_cairo_01',
      name: { ar: 'فرع التجمع الخامس', en: 'Fifth Settlement Branch' },
      cityId: 1,
      areaId: 101,
      addressLine: 'شارع التسعين الشمالي، التجمع الخامس',
      phone: '+201000000001',
      hours: mockWeeklyHours as unknown as JsonValue,
      lat: 30.0131,
      lng: 31.4289,
    },
  ],
};

const mockListingCards: ListingCard[] = [
  {
    publicId: 'lst_toyota_01',
    slug: 'toyota-corolla-2024-lst01',
    title: 'تويوتا كورولا 2024',
    makeName: { ar: 'تويوتا', en: 'Toyota' },
    modelName: { ar: 'كورولا', en: 'Corolla' },
    year: 2024,
    mileageKm: 12000,
    priceCents: 85000000,
    currency: 'EGP',
    isNegotiable: true,
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    bodyType: 'SEDAN',
    condition: 'USED',
    conditionGrade: 'EXCELLENT',
    sellerType: 'DEALER',
    cityName: { ar: 'القاهرة', en: 'Cairo' },
    coverImageUrl: 'https://images.arabiyatmart.com/listings/corolla.webp',
    officialPriceCents: 95000000,
    isFavorited: false,
    isFeatured: true,
    featuredUntil: '2026-12-31T23:59:59.000Z',
    featuredTier: 'PREMIUM',
    publishedAt: '2026-01-01T12:00:00.000Z',
    viewsCount: 100,
    favoritesCount: 12,
    imagesCount: 6,
    isSellerVerified: true,
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  routingState.searchParams = new URLSearchParams();
});

describe('TASK-033: Dealer Profile and Inventory Route', () => {
  beforeEach(() => {
    mockGetDealer.mockResolvedValue({
      data: mockDealerProfile,
    });
    mockGetDealerListings.mockResolvedValue({
      data: mockListingCards,
      meta: { hasMore: false, nextCursor: null },
    });
  });

  describe('BusinessHours component', () => {
    it('accurately identifies open hours with fixed time input during regular day', () => {
      // Monday at 14:00 (Open 09:00 - 21:00)
      const open = isDayOpen(mockWeeklyHours.monday, '14:00');
      expect(open).toBe(true);

      const isOpenNow = checkIsOpenNow(mockWeeklyHours, { day: 'monday', time: '14:00' });
      expect(isOpenNow).toBe(true);

      render(<BusinessHours hours={mockWeeklyHours} locale="ar" currentTime={{ day: 'monday', time: '14:00' }} />);
      expect(screen.getByTestId('hours-status-badge')).toHaveTextContent('مفتوح الآن');
    });

    it('accurately identifies closed status on closed days', () => {
      // Friday is closed
      const open = isDayOpen(mockWeeklyHours.friday, '15:00');
      expect(open).toBe(false);

      const isOpenNow = checkIsOpenNow(mockWeeklyHours, { day: 'friday', time: '15:00' });
      expect(isOpenNow).toBe(false);

      render(<BusinessHours hours={mockWeeklyHours} locale="ar" currentTime={{ day: 'friday', time: '15:00' }} />);
      expect(screen.getByTestId('hours-status-badge')).toHaveTextContent('مغلق الآن');
    });

    it('accurately calculates overnight business hours', () => {
      // Thursday open 20:00 to 02:00 (+1 day)
      // At 23:00 on Thursday -> Open
      expect(isDayOpen(mockWeeklyHours.thursday, '23:00')).toBe(true);
      // At 01:30 on Friday early morning -> spillover from Thursday open!
      const isOpenSpillover = checkIsOpenNow(mockWeeklyHours, { day: 'friday', time: '01:30' });
      expect(isOpenSpillover).toBe(true);
      // At 05:00 on Friday -> Closed
      const isClosedFridayDawn = checkIsOpenNow(mockWeeklyHours, { day: 'friday', time: '05:00' });
      expect(isClosedFridayDawn).toBe(false);
    });
  });

  describe('DealerHeader component', () => {
    it('renders verified dealer badge, rating, and contact actions', () => {
      render(<DealerHeader dealer={mockDealerProfile} locale="ar" />);

      expect(screen.getByTestId('dealer-display-name')).toHaveTextContent('الفطيم للسيارات');
      expect(screen.getByTestId('dealer-verified-badge')).toBeInTheDocument();
      expect(screen.getByTestId('dealer-rating')).toHaveTextContent('4.9');
      expect(screen.getByTestId('dealer-call-btn')).toHaveAttribute('href', 'tel:+201000000001');
      expect(screen.getByTestId('dealer-whatsapp-btn')).toHaveAttribute('href', 'https://wa.me/201000000001');
    });

    it('omits contact buttons when contact details are invalid or unsafe', () => {
      const unsafeDealer: DealerProfile = {
        ...mockDealerProfile,
        branches: [
          {
            ...mockDealerProfile.branches[0]!,
            phone: 'javascript:alert(1)', // Unsafe protocol injection
          },
        ],
      };

      render(<DealerHeader dealer={unsafeDealer} locale="ar" />);

      expect(screen.queryByTestId('dealer-call-btn')).toBeNull();
      expect(screen.queryByTestId('dealer-whatsapp-btn')).toBeNull();
    });
  });

  describe('DealerAbout component', () => {
    it('renders localized description, branch address, map link, and embedded hours', () => {
      render(<DealerAbout dealer={mockDealerProfile} locale="ar" currentTime={{ day: 'monday', time: '14:00' }} />);

      expect(screen.getByText(/الموزع المعتمد لأكبر العلامات التجارية/i)).toBeInTheDocument();
      expect(screen.getByText('فرع التجمع الخامس')).toBeInTheDocument();
      expect(screen.getByText('شارع التسعين الشمالي، التجمع الخامس')).toBeInTheDocument();

      const mapLink = screen.getByTestId('branch-map-link');
      expect(mapLink).toHaveAttribute('href', expect.stringContaining('maps/search/?api=1&query=30.0131%2C31.4289'));
      expect(mapLink).toHaveAttribute('target', '_blank');
      expect(mapLink).toHaveAttribute('rel', 'noopener noreferrer');

      expect(screen.getByTestId('business-hours')).toBeInTheDocument();
    });
  });

  describe('DealerInventory component', () => {
    it('renders listings grid and handles condition filter change', () => {
      render(
        <DealerInventory
          listings={mockListingCards}
          meta={{ hasMore: false, nextCursor: null }}
          dealerSlug="al-futtaim-motors"
          currentParams={{}}
          locale="ar"
        />
      );

      expect(screen.getByTestId('dealer-listings-grid')).toBeInTheDocument();
      expect(screen.getByText('تويوتا كورولا 2024')).toBeInTheDocument();

      // Click "جديد" (New condition filter)
      const newFilterBtn = screen.getByTestId('filter-condition-new');
      fireEvent.click(newFilterBtn);

      expect(routingState.push).toHaveBeenCalledWith(expect.stringContaining('condition=NEW'));
    });

    it('renders localized empty state when dealer has no current inventory', () => {
      render(
        <DealerInventory
          listings={[]}
          meta={{ hasMore: false, nextCursor: null }}
          dealerSlug="al-futtaim-motors"
          currentParams={{}}
          locale="ar"
        />
      );

      expect(screen.getByTestId('dealer-inventory-empty')).toBeInTheDocument();
      expect(screen.getByText('لا توجد سيارات معروضة لهذا المعرض حالياً')).toBeInTheDocument();
    });
  });

  describe('DealerProfilePage (RSC integration)', () => {
    it('satisfies Acceptance Criteria: valid dealer with no inventory renders profile, contacts, canonical metadata, and localized empty state rather than 404', async () => {
      mockGetDealerListings.mockResolvedValue({
        data: [],
        meta: { hasMore: false, nextCursor: null },
      });

      const pageJsx = await DealerProfilePage({
        params: Promise.resolve({ locale: 'ar', slug: 'al-futtaim-motors' }),
        searchParams: Promise.resolve({}),
      });

      render(pageJsx);

      // 1. Header & about rendered
      expect(screen.getByTestId('dealer-header')).toBeInTheDocument();
      expect(screen.getByTestId('dealer-display-name')).toHaveTextContent('الفطيم للسيارات');
      expect(screen.getByTestId('dealer-about')).toBeInTheDocument();

      // 2. Localized empty state rather than 404
      expect(screen.getByTestId('dealer-inventory-empty')).toBeInTheDocument();
      expect(screen.getByText('لا توجد سيارات معروضة لهذا المعرض حالياً')).toBeInTheDocument();

      // 3. Metadata verification
      const meta = await generateMetadata({
        params: Promise.resolve({ locale: 'ar', slug: 'al-futtaim-motors' }),
        searchParams: Promise.resolve({}),
      });
      expect(meta.title).toContain('الفطيم للسيارات');
      expect(meta.alternates?.canonical).toBe('/ar/dealers/al-futtaim-motors');
      expect((meta.robots as { index?: boolean })?.index).toBe(true);
    });

    it('throws notFound() only on verified ApiContractError 404/NOT_FOUND', async () => {
      // 1. ApiContractError with status 404
      const notFoundStatusError = new ApiContractError({
        error: {
          code: 'SOME_CODE',
          message: 'Dealer not found',
          status: 404,
          requestId: 'req-404',
          fieldErrors: [],
          details: null,
          retryAfterSeconds: null,
        },
      });
      mockGetDealer.mockRejectedValue(notFoundStatusError);

      await expect(
        DealerProfilePage({
          params: Promise.resolve({ locale: 'ar', slug: 'non-existent-dealer' }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');

      // 2. ApiContractError with code NOT_FOUND
      const notFoundCodeError = new ApiContractError({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource absent',
          status: 400,
          requestId: 'req-code-404',
          fieldErrors: [],
          details: null,
          retryAfterSeconds: null,
        },
      });
      mockGetDealer.mockRejectedValue(notFoundCodeError);

      await expect(
        DealerProfilePage({
          params: Promise.resolve({ locale: 'ar', slug: 'non-existent-dealer' }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('propagates generic Error("404") without converting to 404', async () => {
      const genericError = new Error('404');
      mockGetDealer.mockRejectedValue(genericError);

      await expect(
        DealerProfilePage({
          params: Promise.resolve({ locale: 'ar', slug: 'al-futtaim-motors' }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow(genericError);

      const genericNotFoundMsg = new Error('Resource not found (404)');
      mockGetDealer.mockRejectedValue(genericNotFoundMsg);

      await expect(
        DealerProfilePage({
          params: Promise.resolve({ locale: 'ar', slug: 'al-futtaim-motors' }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow(genericNotFoundMsg);
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
      mockGetDealer.mockRejectedValue(serverContractError);

      await expect(
        DealerProfilePage({
          params: Promise.resolve({ locale: 'ar', slug: 'al-futtaim-motors' }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow(serverContractError);

      // 2. Gateway timeout / Network error
      const timeoutError = new Error('Gateway timeout after 10000ms');
      mockGetDealer.mockRejectedValue(timeoutError);

      await expect(
        DealerProfilePage({
          params: Promise.resolve({ locale: 'ar', slug: 'al-futtaim-motors' }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow('Gateway timeout after 10000ms');
    });

    it('propagates dealer inventory contract failures instead of rendering a false empty showroom', async () => {
      const inventoryContractError = new ApiContractError({
        error: {
          code: 'UPSTREAM_CONTRACT_MISMATCH',
          message: 'Upstream response contract mismatch',
          status: 502,
          requestId: 'req-inventory-contract',
          fieldErrors: [
            {
              field: 'data.0.slug',
              code: 'invalid_format',
              message: 'Listing slug must be lowercase kebab-case',
            },
          ],
          details: null,
          retryAfterSeconds: null,
        },
      });
      mockGetDealerListings.mockRejectedValue(inventoryContractError);

      await expect(
        DealerProfilePage({
          params: Promise.resolve({ locale: 'ar', slug: 'al-futtaim-motors' }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow(inventoryContractError);
    });

    it('embeds AutoDealer JSON-LD structured data', async () => {
      const pageJsx = await DealerProfilePage({
        params: Promise.resolve({ locale: 'ar', slug: 'al-futtaim-motors' }),
        searchParams: Promise.resolve({}),
      });

      const { container } = render(pageJsx);

      const ldJsonScript = container.querySelector('script[type="application/ld+json"]');
      expect(ldJsonScript).not.toBeNull();
      const ldContent = JSON.parse(ldJsonScript!.textContent || '{}');
      expect(ldContent['@type']).toBe('AutoDealer');
      expect(ldContent.name).toBe('الفطيم للسيارات');
      expect(ldContent.url).toBe('https://arabiyatmart.com/ar/dealers/al-futtaim-motors');
      expect(ldContent.telephone).toBe('+201000000001');
    });
  });

  describe('DealerProfileLoading (RSC)', () => {
    it('renders profile loading skeleton', () => {
      render(<DealerProfileLoading />);
      expect(screen.getByTestId('dealer-profile-loading')).toBeInTheDocument();
    });
  });

  describe('Cache policy verification', () => {
    it('verifies dealer profile policy is 300s and dealer listings is 60s', () => {
      const profilePolicy = dealerProfilePolicy('al-futtaim-motors');
      expect(profilePolicy.next?.revalidate).toBe(300);
      expect(profilePolicy.next?.tags).toEqual(['dealers', 'dealer:al-futtaim-motors']);

      const listingsPolicy = dealerListingsPolicy('al-futtaim-motors');
      expect(listingsPolicy.next?.revalidate).toBe(60);
      expect(listingsPolicy.next?.tags).toEqual(['listings', 'dealer:al-futtaim-motors:listings']);
    });
  });
});
