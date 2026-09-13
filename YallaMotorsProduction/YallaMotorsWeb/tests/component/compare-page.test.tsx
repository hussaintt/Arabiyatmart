import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";

vi.mock("server-only", () => ({}));

const routingState = vi.hoisted(() => ({
  pathname: "/ar/compare",
  search: "",
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => routingState.pathname,
  useRouter: () => ({
    push: routingState.push,
    replace: routingState.replace,
  }),
  useSearchParams: () => new URLSearchParams(routingState.search),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
    className,
    "data-testid": dataTestId,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    "data-testid"?: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a
      href={href}
      className={className}
      data-testid={dataTestId}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
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

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    className,
    fill: _unusedFill,
    ...props
  }: {
    src: string;
    alt: string;
    className?: string;
    fill?: boolean;
    [key: string]: unknown;
  }) => {
    void _unusedFill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} {...props} />;
  },
}));

// Mock server queries
const mockGetListingBatch = vi.fn();
const mockGetTrimBatch = vi.fn();

vi.mock("@/server/queries/listings", () => ({
  getListingBatch: (...args: unknown[]) => mockGetListingBatch(...args),
}));

vi.mock("@/server/queries/taxonomy", () => ({
  getTrimBatch: (...args: unknown[]) => mockGetTrimBatch(...args),
}));

// Mock browser API for picker
const mockBrowserApiRequest = vi.fn();
vi.mock("@/lib/api/browser", () => ({
  browserApiRequest: (...args: unknown[]) => mockBrowserApiRequest(...args),
}));

import ComparePage, {
  generateMetadata,
} from "@/app/[locale]/(marketplace)/compare/page";
import { useCompareStore } from "@/stores/compare-store";
import type { ListingCard } from "@/types/listing";
import type { Trim } from "@/types/taxonomy";

const sampleListing1: ListingCard = {
  publicId: "lst_toyota_01",
  slug: "toyota-corolla-2023",
  title: "تويوتا كورولا 2023 الفئة الأولى",
  makeName: { ar: "تويوتا", en: "Toyota" },
  modelName: { ar: "كورولا", en: "Corolla" },
  year: 2023,
  mileageKm: 25000,
  priceCents: 85000000,
  currency: "EGP",
  isNegotiable: false,
  fuelType: "PETROL",
  transmission: "AUTOMATIC",
  bodyType: "SEDAN",
  condition: "USED",
  conditionGrade: "EXCELLENT",
  sellerType: "DEALER",
  cityName: { ar: "القاهرة", en: "Cairo" },
  coverImageUrl: "https://images.arabiyatmart.com/listings/corolla.jpg",
  officialPriceCents: null,
  isFavorited: false,
  isFeatured: true,
  featuredUntil: null,
  featuredTier: "PREMIUM",
  publishedAt: "2026-01-01T00:00:00Z",
  viewsCount: 150,
  favoritesCount: 12,
  imagesCount: 6,
  isSellerVerified: true,
};

const sampleListing2: ListingCard = {
  publicId: "lst_hyundai_02",
  slug: "hyundai-elantra-2023",
  title: "هيونداي إلنترا 2023 سمارت",
  makeName: { ar: "هيونداي", en: "Hyundai" },
  modelName: { ar: "إلنترا", en: "Elantra" },
  year: 2023,
  mileageKm: 30000,
  priceCents: 90000000,
  currency: "EGP",
  isNegotiable: true,
  fuelType: "PETROL",
  transmission: "AUTOMATIC",
  bodyType: "SEDAN",
  condition: "USED",
  conditionGrade: "VERY_GOOD",
  sellerType: "PRIVATE",
  cityName: { ar: "الجيزة", en: "Giza" },
  coverImageUrl: "https://images.arabiyatmart.com/listings/elantra.jpg",
  officialPriceCents: null,
  isFavorited: false,
  isFeatured: false,
  featuredUntil: null,
  featuredTier: null,
  publishedAt: "2026-01-02T00:00:00Z",
  viewsCount: 200,
  favoritesCount: 18,
  imagesCount: 8,
  isSellerVerified: false,
};

const sampleListing3: ListingCard = {
  publicId: "lst_nissan_03",
  slug: "nissan-sunny-2023",
  title: "نيسان صني 2023 سوبر صالون",
  makeName: { ar: "نيسان", en: "Nissan" },
  modelName: { ar: "صني", en: "Sunny" },
  year: 2023,
  mileageKm: 15000,
  priceCents: 70000000,
  currency: "EGP",
  isNegotiable: false,
  fuelType: "PETROL",
  transmission: "AUTOMATIC",
  bodyType: "SEDAN",
  condition: "USED",
  conditionGrade: "EXCELLENT",
  sellerType: "DEALER",
  cityName: { ar: "الإسكندرية", en: "Alexandria" },
  coverImageUrl: "https://images.arabiyatmart.com/listings/sunny.jpg",
  officialPriceCents: null,
  isFavorited: false,
  isFeatured: false,
  featuredUntil: null,
  featuredTier: null,
  publishedAt: "2026-01-03T00:00:00Z",
  viewsCount: 120,
  favoritesCount: 8,
  imagesCount: 5,
  isSellerVerified: true,
};

const sampleTrim1: Trim = {
  publicId: "trm_active_01",
  name: { ar: "تويوتا كورولا اكتيف", en: "Toyota Corolla Active" },
  modelYear: 2024,
  engineCc: 1600,
  powerHp: 120,
  torqueNm: 154,
  fuelType: "PETROL",
  transmission: "AUTOMATIC",
  drivetrain: "FWD",
  seats: 5,
  fuelEconomyKmL: 14,
  warrantyYears: 3,
  warrantyKm: 100000,
  specs: null,
  officialPriceCents: 95000000,
  marketPriceCents: 98000000,
  currency: "EGP",
  brochureUrl: null,
  isActive: true,
};

describe("TASK-036: Compare Workspace Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routingState.push.mockReset();
    routingState.replace.mockReset();
    useCompareStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders empty comparison state when no items are in searchParams", async () => {
    const page = await ComparePage({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({}),
    });

    render(page);

    expect(screen.getByTestId("compare-empty-state")).toBeInTheDocument();
    expect(
      screen.getByText("لم تختر أي سيارات للمقارنة بعد"),
    ).toBeInTheDocument();
    expect(mockGetListingBatch).not.toHaveBeenCalled();
  });

  it("GIVEN duplicate and 4 items, WHEN page loads, THEN canonicalizes to at most 3 unique items in stable order", async () => {
    mockGetListingBatch.mockResolvedValue({
      data: [sampleListing1, sampleListing2, sampleListing3],
    });

    // 4 items with duplicate and 4th item
    const rawItems = [
      "listing:toyota-corolla-2023",
      "listing:toyota-corolla-2023", // duplicate
      "listing:hyundai-elantra-2023",
      "listing:nissan-sunny-2023",
      "listing:fourth-car-slug", // 4th unique item -> should be capped at 3
    ];

    const page = await ComparePage({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({ item: rawItems }),
    });

    render(page);

    // Verify batch query received exactly 3 unique items in stable order
    expect(mockGetListingBatch).toHaveBeenCalledWith(
      {
        slugs: [
          "toyota-corolla-2023",
          "hyundai-elantra-2023",
          "nissan-sunny-2023",
        ],
      },
      "ar",
    );

    // Verify at most 3 columns are rendered
    expect(
      screen.getByTestId("compare-column-lst_toyota_01"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("compare-column-lst_hyundai_02"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("compare-column-lst_nissan_03"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("compare-column-fourth-car-slug"),
    ).not.toBeInTheDocument();

    // Verify store was initialized
    expect(useCompareStore.getState().items).toHaveLength(3);
    expect(useCompareStore.getState().mode).toBe("listing");
  });

  it("enforces single mode when mixed listing and trim items are provided", async () => {
    mockGetListingBatch.mockResolvedValue({
      data: [sampleListing1, sampleListing2],
    });

    // First item is listing, second is trim, third is listing
    const mixedItems = [
      "listing:toyota-corolla-2023",
      "trim:trm_active_01",
      "listing:hyundai-elantra-2023",
    ];

    const page = await ComparePage({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({ item: mixedItems }),
    });

    render(page);

    // Only listings should be fetched; trim is excluded
    expect(mockGetListingBatch).toHaveBeenCalledWith(
      {
        slugs: ["toyota-corolla-2023", "hyundai-elantra-2023"],
      },
      "ar",
    );
    expect(mockGetTrimBatch).not.toHaveBeenCalled();

    expect(
      screen.getByTestId("compare-column-lst_toyota_01"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("compare-column-lst_hyundai_02"),
    ).toBeInTheDocument();
  });

  it("handles unavailable/missing listings gracefully and offers removal without altering other order", async () => {
    // Only return 1 listing, the 2nd one is missing/deleted
    mockGetListingBatch.mockResolvedValue({
      data: [sampleListing1],
    });

    const page = await ComparePage({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({
        item: ["listing:toyota-corolla-2023", "listing:deleted-car-slug"],
      }),
    });

    render(page);

    expect(
      screen.getByTestId("compare-column-lst_toyota_01"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("unavailable-column-deleted-car-slug"),
    ).toBeInTheDocument();

    // Click remove on unavailable item
    const removeUnavailableBtn = screen.getByTestId(
      "remove-unavailable-deleted-car-slug",
    );
    fireEvent.click(removeUnavailableBtn);

    // Should navigate to only the remaining item
    expect(routingState.push).toHaveBeenCalledWith(
      "/ar/compare?item=listing%3Atoyota-corolla-2023",
    );
  });

  it("allows removing an available item from the comparison table", async () => {
    mockGetListingBatch.mockResolvedValue({
      data: [sampleListing1, sampleListing2],
    });

    const page = await ComparePage({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({
        item: ["listing:toyota-corolla-2023", "listing:hyundai-elantra-2023"],
      }),
    });

    render(page);

    const removeBtn = screen.getByTestId("remove-compare-lst_toyota_01");
    fireEvent.click(removeBtn);

    expect(routingState.push).toHaveBeenCalledWith(
      "/ar/compare?item=listing%3Ahyundai-elantra-2023",
    );
  });

  it("renders trim comparison when trim items are passed", async () => {
    mockGetTrimBatch.mockResolvedValue({
      data: [sampleTrim1],
    });

    const page = await ComparePage({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({
        item: ["trim:trm_active_01"],
      }),
    });

    render(page);

    expect(mockGetTrimBatch).toHaveBeenCalledWith(
      { publicIds: ["trm_active_01"] },
      "ar",
    );
    expect(
      screen.getByTestId("compare-column-trm_active_01"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("تويوتا كورولا اكتيف").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("highlights the best value in specification rows", async () => {
    mockGetListingBatch.mockResolvedValue({
      data: [sampleListing1, sampleListing2], // sampleListing1 has 850,000 (lower price)
    });

    const page = await ComparePage({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({
        item: ["listing:toyota-corolla-2023", "listing:hyundai-elantra-2023"],
      }),
    });

    render(page);

    // Price row: lower price is better -> should highlight 'الأفضل' (Best)
    const bestBadges = screen.getAllByText("الأفضل");
    expect(bestBadges.length).toBeGreaterThan(0);
  });

  it("proves a MAKE/MODEL suggestion cannot create item=listing:* and reports no comparable item available", async () => {
    mockGetListingBatch.mockResolvedValue({
      data: [sampleListing1],
    });

    mockBrowserApiRequest.mockResolvedValue({
      data: [
        {
          type: "MODEL",
          label: "هيونداي إلنترا",
          makeSlug: "hyundai",
          modelSlug: "elantra",
          comparisonRef: null,
        },
      ],
    });

    const page = await ComparePage({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({
        item: ["listing:toyota-corolla-2023"],
      }),
    });

    render(page);

    // Open picker
    fireEvent.click(screen.getByTestId("add-compare-slot"));
    expect(screen.getByTestId("compare-picker-modal")).toBeInTheDocument();

    const input = screen.getByTestId("compare-picker-input");
    fireEvent.change(input, { target: { value: "إلنترا" } });

    await waitFor(() => {
      expect(screen.getByTestId("suggestion-item-0")).toBeInTheDocument();
    });

    // Select the MODEL taxonomy suggestion
    fireEvent.click(screen.getByTestId("suggestion-item-0"));

    // MUST NOT create item=listing:* or navigate
    expect(routingState.push).not.toHaveBeenCalled();

    // MUST show error message indicating no comparable vehicle is available
    expect(screen.getByTestId("compare-picker-error")).toBeInTheDocument();
    expect(
      screen.getByText(/لا تتوفر سيارة للمقارنة حالياً/),
    ).toBeInTheDocument();
  });

  it("proves free text input cannot create item=listing:* on direct submit", async () => {
    mockGetListingBatch.mockResolvedValue({
      data: [sampleListing1],
    });

    mockBrowserApiRequest.mockResolvedValue({
      data: [],
    });

    const page = await ComparePage({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({
        item: ["listing:toyota-corolla-2023"],
      }),
    });

    render(page);

    fireEvent.click(screen.getByTestId("add-compare-slot"));
    const input = screen.getByTestId("compare-picker-input");

    // Type arbitrary query text
    fireEvent.change(input, { target: { value: "custom unvalidated query" } });

    // Submit via Enter key
    fireEvent.keyDown(input, { key: "Enter" });

    // MUST NOT navigate with unvalidated listing slug
    expect(routingState.push).not.toHaveBeenCalled();

    // MUST display validation error
    expect(screen.getByTestId("compare-picker-error")).toBeInTheDocument();
    expect(
      screen.getByText(/لا يمكن إضافة نص البحث مباشرة/),
    ).toBeInTheDocument();
  });

  it("allows selecting an approved result carrying a valid comparison ref via keyboard combobox", async () => {
    mockGetListingBatch.mockResolvedValue({
      data: [sampleListing1],
    });

    mockBrowserApiRequest.mockResolvedValue({
      data: [
        {
          type: "MODEL",
          label: "هيونداي إلنترا 2023 سمارت",
          makeSlug: "hyundai",
          modelSlug: "elantra",
          comparisonRef: {
            kind: "listing",
            id: "hyundai-elantra-2023",
          },
        },
      ],
    });

    const page = await ComparePage({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({
        item: ["listing:toyota-corolla-2023"],
      }),
    });

    render(page);

    fireEvent.click(screen.getByTestId("add-compare-slot"));
    const input = screen.getByTestId("compare-picker-input");

    fireEvent.change(input, { target: { value: "إلنترا" } });

    await waitFor(() => {
      expect(screen.getByTestId("suggestion-item-0")).toBeInTheDocument();
    });

    // Keyboard navigation: ArrowDown then Enter on the approved result
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    // Should commit the approved selection to URL state
    expect(routingState.push).toHaveBeenCalledWith(
      "/ar/compare?item=listing%3Atoyota-corolla-2023&item=listing%3Ahyundai-elantra-2023",
    );
  });

  it("does not submit a stale approved result after the user edits the query", async () => {
    mockGetListingBatch.mockResolvedValue({ data: [sampleListing1] });
    mockBrowserApiRequest.mockResolvedValue({
      data: [
        {
          type: "MODEL",
          label: "هيونداي إلنترا 2023 سمارت",
          makeSlug: "hyundai",
          modelSlug: "elantra",
          comparisonRef: {
            kind: "listing",
            id: "hyundai-elantra-2023",
          },
        },
      ],
    });

    const page = await ComparePage({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({
        item: ["listing:toyota-corolla-2023"],
      }),
    });

    render(page);
    fireEvent.click(screen.getByTestId("add-compare-slot"));
    const input = screen.getByTestId("compare-picker-input");

    fireEvent.change(input, { target: { value: "إلنترا" } });
    await waitFor(() =>
      expect(screen.getByTestId("suggestion-item-0")).toBeInTheDocument(),
    );
    fireEvent.keyDown(input, { key: "ArrowDown" });

    fireEvent.change(input, {
      target: { value: "unvalidated replacement text" },
    });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(routingState.push).not.toHaveBeenCalled();
    expect(
      screen.getByText(/لا يمكن إضافة نص البحث مباشرة/),
    ).toBeInTheDocument();
  });

  it("allows selecting an approved trim comparison ref when comparing trims", async () => {
    mockGetTrimBatch.mockResolvedValue({
      data: [sampleTrim1],
    });

    mockBrowserApiRequest.mockResolvedValue({
      data: [
        {
          type: "MODEL",
          label: "تويوتا كورولا برستيج",
          makeSlug: "toyota",
          modelSlug: "corolla",
          comparisonRef: {
            kind: "trim",
            id: "trm_prestige_02",
          },
        },
      ],
    });

    const page = await ComparePage({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({
        item: ["trim:trm_active_01"],
      }),
    });

    render(page);

    fireEvent.click(screen.getByTestId("add-compare-slot"));
    const input = screen.getByTestId("compare-picker-input");

    fireEvent.change(input, { target: { value: "كورولا" } });

    await waitFor(() => {
      expect(screen.getByTestId("suggestion-item-0")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("suggestion-item-0"));

    expect(routingState.push).toHaveBeenCalledWith(
      "/ar/compare?item=trim%3Atrm_active_01&item=trim%3Atrm_prestige_02",
    );
  });

  it("aborts previous in-flight suggestion requests when typing new characters (race condition handling)", async () => {
    mockGetListingBatch.mockResolvedValue({ data: [sampleListing1] });

    const capturedSignals: AbortSignal[] = [];
    mockBrowserApiRequest.mockImplementation(
      async ({ signal }: { signal: AbortSignal }) => {
        capturedSignals.push(signal);
        return { data: [] };
      },
    );

    const page = await ComparePage({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({ item: ["listing:toyota-corolla-2023"] }),
    });

    render(page);

    fireEvent.click(screen.getByTestId("add-compare-slot"));
    const input = screen.getByTestId("compare-picker-input");

    // First query
    fireEvent.change(input, { target: { value: "تويوتا" } });
    await waitFor(() => expect(mockBrowserApiRequest).toHaveBeenCalledTimes(1));

    // Second query
    fireEvent.change(input, { target: { value: "تويوتا كورولا" } });
    await waitFor(() => expect(mockBrowserApiRequest).toHaveBeenCalledTimes(2));

    // First signal should have been aborted
    expect(capturedSignals[0]?.aborted).toBe(true);
  });

  it("generates canonical noindex metadata without private state", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "ar" }),
      searchParams: Promise.resolve({
        item: [
          "listing:toyota-corolla-2023",
          "listing:toyota-corolla-2023", // duplicate
          "listing:hyundai-elantra-2023",
        ],
      }),
    });

    expect(metadata.robots).toEqual({
      index: false,
      follow: false,
    });
    expect(metadata.alternates?.canonical).toBeDefined();
    expect(metadata.title).toContain("مقارنة السيارات");
  });

  it("resets store on route mode change", () => {
    useCompareStore
      .getState()
      .setInitialState([{ kind: "listing", id: "toyota-corolla" }], "listing");
    expect(useCompareStore.getState().mode).toBe("listing");
    expect(useCompareStore.getState().items).toHaveLength(1);

    useCompareStore.getState().reset();
    expect(useCompareStore.getState().mode).toBeNull();
    expect(useCompareStore.getState().items).toHaveLength(0);
  });
});
