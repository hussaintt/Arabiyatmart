import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

vi.mock('server-only', () => ({}));

// Mock routing
const routingState = vi.hoisted(() => ({
  pathname: '/',
  push: vi.fn(),
}));

vi.mock('@/i18n/routing', () => ({
  Link: ({
    href,
    locale,
    children,
    onClick,
    className,
    prefetch: _unusedPrefetch,
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
    void _unusedPrefetch;
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

// Mock next-intl/server
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
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

// Mock home query
const mockGetHomePageData = vi.fn();
vi.mock('@/server/queries/home', () => ({
  getHomePageData: (locale: string) => mockGetHomePageData(locale),
  getHomePageDataWithStatus: async (locale: string) => {
    const data = await mockGetHomePageData(locale);
    return { data, isDegraded: false };
  },
}));

import MarketplaceHomePage from '@/app/[locale]/(marketplace)/page';
import MarketplaceHomeLoading from '@/app/[locale]/(marketplace)/loading';
import { HeroSearch, buildSmartSuggestions } from '@/components/home/hero-search';
import { BannerCarousel } from '@/components/home/banner-carousel';
import { SpotlightSection } from '@/components/home/spotlight-section';
import { DealerStrip } from '@/components/home/dealer-strip';
import { AppProviders } from '@/providers/app-providers';
import { createListingCard } from '../fixtures/factories';
import type { HomePageData, HomeBanner } from '@/types/home';
import type { SpotlightItem } from '@/types/taxonomy';
import type { DealerDirectoryItem } from '@/types/dealer';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function createSampleHomeData(overrides?: Partial<HomePageData>): HomePageData {
  const banner: HomeBanner = {
    publicId: 'bnr_1',
    title: { ar: 'عروض رمضان الحصرية', en: 'Ramadan Exclusive Offers' },
    subtitle: { ar: 'وفر حتى 50,000 ج.م على موديلات 2024', en: 'Save up to 50,000 EGP on 2024 models' },
    imageUrl: 'https://images.arabiyatmart.com/banners/hero1.webp',
    linkTarget: '/search?isFeatured=true',
  };

  const spotlightItem: SpotlightItem = {
    modelPublicId: 'mod_1',
    modelSlug: 'sportage',
    modelName: { ar: 'سبورتاج', en: 'Sportage' },
    makeName: { ar: 'كيا', en: 'Kia' },
    makeSlug: 'kia',
    makeLogoUrl: 'https://images.arabiyatmart.com/makes/kia.webp',
    bodyType: 'SUV',
    startingPriceCents: 150000000,
    currency: 'EGP',
    activeNewListingCount: 24,
  };

  const dealer: DealerDirectoryItem = {
    publicId: 'dlr_1',
    slug: 'el-tarek-motors',
    displayName: { ar: 'الطارق للسيارات', en: 'El Tarek Motors' },
    logoUrl: 'https://images.arabiyatmart.com/dealers/eltarek.webp',
    cityName: { ar: 'القاهرة', en: 'Cairo' },
    activeListingCount: 85,
    isVerified: true,
  };

  return {
    banners: [banner],
    spotlight: [spotlightItem],
    featuredListings: [
      createListingCard({ publicId: 'lst_feat_1', slug: 'feat-car-1', title: 'تويوتا كورولا مميزة' }),
    ],
    latestListings: [
      createListingCard({ publicId: 'lst_late_1', slug: 'late-car-1', title: 'هيونداي توسان حديثة' }),
    ],
    featuredDealers: [dealer],
    settings: {
      finance: { annualRate: 0.15, downPaymentFraction: 0.2, tenorMonths: 60 },
      support: { termsUrl: null, privacyUrl: null, supportEmail: null, supportPhone: null },
    },
    ...overrides,
  };
}

describe('MarketplaceHomePage [RSC]', () => {
  beforeEach(() => {
    mockGetHomePageData.mockReset();
    routingState.push.mockReset();
  });

  it('renders all sections and structured JSON-LD when complete data is returned', async () => {
    const data = createSampleHomeData();
    mockGetHomePageData.mockResolvedValue(data);

    const Page = await MarketplaceHomePage({
      params: Promise.resolve({ locale: 'ar' }),
    });

    render(<AppProviders initialSession={null}>{Page}</AppProviders>);

    // Headings
    expect(screen.getByText('عروض رمضان الحصرية')).toBeInTheDocument();
    expect(screen.getByText('أبرز موديلات السيارات')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('سيارتك القادمة.');
    expect(screen.getByRole('tab', { name: 'أحدث الإعلانات' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('تعرّف على معارض السيارات')).toBeInTheDocument();

    // Listings
    expect(screen.getByText('هيونداي توسان حديثة')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'الأكثر مشاهدة' }));
    expect(screen.getByText('تويوتا كورولا مميزة')).toBeInTheDocument();
    expect(screen.queryByText('هيونداي توسان حديثة')).not.toBeInTheDocument();

    // Dealer
    expect(screen.getByText('الطارق للسيارات')).toBeInTheDocument();

    // JSON-LD
    const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
    expect(jsonLdScript).not.toBeNull();
    expect(jsonLdScript?.textContent).toContain('SearchAction');
  });

  it('gracefully degrades optional sections when unavailable without failing the page', async () => {
    // Missing spotlight and missing dealers
    const degradedData = createSampleHomeData({
      spotlight: [],
      featuredDealers: [],
      banners: [],
    });
    mockGetHomePageData.mockResolvedValue(degradedData);

    const Page = await MarketplaceHomePage({
      params: Promise.resolve({ locale: 'ar' }),
    });

    render(<AppProviders initialSession={null}>{Page}</AppProviders>);

    // Optional sections are omitted cleanly
    expect(screen.queryByTestId('spotlight-section')).toBeNull();
    expect(screen.queryByTestId('dealer-strip')).toBeNull();
    expect(screen.queryByTestId('banner-carousel')).toBeNull();

    // Core search and listings remain intact
    expect(screen.getByTestId('hero-search')).toBeInTheDocument();
    expect(screen.getByText('هيونداي توسان حديثة')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'الأكثر مشاهدة' }));
    expect(screen.getByText('تويوتا كورولا مميزة')).toBeInTheDocument();
    expect(screen.queryByText('هيونداي توسان حديثة')).not.toBeInTheDocument();
  });
});

describe('Homepage recovery and navigation', () => {
  it('shows an honest unavailable state and retains useful navigation when the request fails', async () => {
    mockGetHomePageData.mockRejectedValue(new Error('Upstream unavailable'));
    const page = await MarketplaceHomePage({ params: Promise.resolve({ locale: 'en' }) });
    render(<AppProviders initialSession={null}>{page}</AppProviders>);
    expect(screen.getByText('Listings are temporarily unavailable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/en');
    expect(screen.getByRole('link', { name: 'Start selling your car' })).toHaveAttribute('href', '/sell');
    expect(screen.queryByText('New possibilities are on the way')).not.toBeInTheDocument();
  });

  it('distinguishes empty collections from an outage and supports keyboard inventory navigation', async () => {
    mockGetHomePageData.mockResolvedValue(createSampleHomeData({ latestListings: [], featuredListings: [] }));
    const page = await MarketplaceHomePage({ params: Promise.resolve({ locale: 'en' }) });
    render(<AppProviders initialSession={null}>{page}</AppProviders>);
    expect(screen.getByText('New possibilities are on the way')).toBeInTheDocument();
    const latest = screen.getByRole('tab', { name: 'Latest arrivals' });
    fireEvent.keyDown(latest, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Most viewed' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', screen.getByRole('tab', { name: 'Most viewed' }).id);
    expect(screen.getByRole('link', { name: 'Browse all cars' })).toHaveAttribute('href', '/search?sort=most_viewed');
  });
});

describe('HeroSearch Component', () => {
  beforeEach(() => {
    routingState.push.mockReset();
  });

  it('submits canonical URL parameters to /search with query and condition', () => {
    render(<HeroSearch locale="ar" />);

    const input = screen.getByRole('combobox', { name: 'بحث السيارات' });
    fireEvent.change(input, { target: { value: 'كيا سبورتاج' } });

    const usedButton = screen.getByRole('button', { name: 'مستعمل' });
    fireEvent.click(usedButton);

    const submitBtn = screen.getByRole('button', { name: 'بحث' });
    fireEvent.click(submitBtn);

    expect(routingState.push).toHaveBeenCalledWith('/search?q=%D9%83%D9%8A%D8%A7+%D8%B3%D8%A8%D9%88%D8%B1%D8%AA%D8%A7%D8%AC&condition=USED');
  });

  it('preserves the condition and converts the selected EGP budget to canonical cents', () => {
    render(<HeroSearch locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    fireEvent.change(screen.getByLabelText('Maximum budget'), { target: { value: '100000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(routingState.push).toHaveBeenCalledWith('/search?condition=NEW&priceMax=100000000');
  });

  it('ranks localized model matches and expands them with the current model year', () => {
    const suggestions = buildSmartSuggestions([
      { type: 'MAKE', label: 'تويوتا', makeSlug: 'toyota', modelSlug: null, comparisonRef: null },
      { type: 'MODEL', label: 'تويوتا كورولا', makeSlug: 'toyota', modelSlug: 'corolla', comparisonRef: null },
      { type: 'MODEL', label: 'تويوتا كامري', makeSlug: 'toyota', modelSlug: 'camry', comparisonRef: null },
    ], 'تيو', 'ar', 2026);

    expect(suggestions.map((item) => item.displayLabel)).toEqual(expect.arrayContaining([
      'تويوتا كورولا',
      'تويوتا كورولا ٢٠٢٦',
      'تويوتا كامري',
    ]));
    expect(suggestions.find((item) => item.year === 2026)?.modelSlug).toBeTruthy();
  });
});

describe('BannerCarousel Component', () => {
  it('renders carousel with controls when multiple banners exist', () => {
    const banners: HomeBanner[] = [
      {
        publicId: 'bnr_1',
        title: { ar: 'شريحة 1', en: 'Slide 1' },
        subtitle: null,
        imageUrl: '/img1.webp',
        linkTarget: null,
      },
      {
        publicId: 'bnr_2',
        title: { ar: 'شريحة 2', en: 'Slide 2' },
        subtitle: null,
        imageUrl: '/img2.webp',
        linkTarget: null,
      },
    ];

    render(<BannerCarousel banners={banners} locale="ar" />);

    expect(screen.getByTestId('banner-carousel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'الشريحة التالية' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'الشريحة السابقة' })).toBeInTheDocument();
  });

  it('renders nothing if banners array is empty', () => {
    const { container } = render(<BannerCarousel banners={[]} locale="ar" />);
    expect(container.firstChild).toBeNull();
  });
});

describe('SpotlightSection Component', () => {
  it('renders model spotlight cards with prices and active counts', () => {
    const spotlight: SpotlightItem[] = [
      {
        modelPublicId: 'mod_1',
        modelSlug: 'sportage',
        modelName: { ar: 'سبورتاج', en: 'Sportage' },
        makeName: { ar: 'كيا', en: 'Kia' },
        makeSlug: 'kia',
        makeLogoUrl: null,
        bodyType: 'SUV',
        startingPriceCents: 150000000,
        currency: 'EGP',
        activeNewListingCount: 15,
      },
    ];

    render(<SpotlightSection spotlight={spotlight} locale="ar" />);

    expect(screen.getByTestId('spotlight-section')).toBeInTheDocument();
    expect(screen.getByText('سبورتاج')).toBeInTheDocument();
    expect(screen.getByText('كيا')).toBeInTheDocument();
    expect(screen.getByText(/1,500,000/)).toBeInTheDocument();
  });
});

describe('DealerStrip Component', () => {
  it('renders dealer cards with verification badge and count', () => {
    const dealers: DealerDirectoryItem[] = [
      {
        publicId: 'dlr_1',
        slug: 'el-tarek',
        displayName: { ar: 'الطارق للسيارات', en: 'El Tarek Motors' },
        logoUrl: null,
        cityName: { ar: 'الجيزة', en: 'Giza' },
        activeListingCount: 42,
        isVerified: true,
      },
    ];

    render(<DealerStrip dealers={dealers} locale="ar" />);

    expect(screen.getByTestId('dealer-strip')).toBeInTheDocument();
    expect(screen.getByText('الطارق للسيارات')).toBeInTheDocument();
    expect(screen.getByText('الجيزة')).toBeInTheDocument();
    expect(screen.getByLabelText('معرض موثق')).toBeInTheDocument();
  });
});

describe('MarketplaceHomeLoading Skeleton', () => {
  it('renders home loading skeleton with expected placeholders', () => {
    render(<MarketplaceHomeLoading />);
    expect(screen.getByTestId('home-loading-skeleton')).toBeInTheDocument();
  });
});
