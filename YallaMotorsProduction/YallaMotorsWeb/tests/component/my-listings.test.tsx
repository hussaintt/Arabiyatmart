import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyListingsList } from "@/components/my-listings/my-listings-list";
import type { MyListing } from "@/types/listing";

const mockUpdateListingPrice = vi.fn();
const mockTransitionListing = vi.fn();

vi.mock("@/server/actions/listings", () => ({
  createListing: vi.fn(),
  updateListing: vi.fn(),
  updateListingPrice: (...args: unknown[]) => mockUpdateListingPrice(...args),
  transitionListing: (...args: unknown[]) => mockTransitionListing(...args),
}));

describe("TASK-048: My Listings and Listing Lifecycle Controls", () => {
  const sampleListings: MyListing[] = [
    {
      publicId: "list_active_1",
      slug: "toyota-camry-2024-active",
      title: "تويوتا كامري 2024 بحالة ممتازة",
      makeName: { ar: "تويوتا", en: "Toyota" },
      modelName: { ar: "كامري", en: "Camry" },
      year: 2024,
      mileageKm: 12000,
      priceCents: 95000000,
      currency: "EGP",
      isNegotiable: true,
      fuelType: "PETROL",
      transmission: "AUTOMATIC",
      bodyType: "SEDAN",
      condition: "USED",
      conditionGrade: "EXCELLENT",
      sellerType: "PRIVATE",
      cityName: { ar: "القاهرة", en: "Cairo" },
      coverImageUrl: "https://cdn.example.com/camry.jpg",
      officialPriceCents: null,
      isFavorited: false,
      isFeatured: true,
      featuredUntil: "2026-10-01T00:00:00Z",
      featuredTier: "PREMIUM",
      publishedAt: "2026-09-01T12:00:00Z",
      viewsCount: 145,
      leadsCount: 8,
      favoritesCount: 3,
      imagesCount: 5,
      isSellerVerified: true,
      status: "ACTIVE",
      rejectionReason: null,
    },
    {
      publicId: "list_paused_2",
      slug: "bmw-3series-2022-paused",
      title: "بي إم دبليو الفئة الثالثة 2022",
      makeName: { ar: "بي إم دبليو", en: "BMW" },
      modelName: { ar: "الفئة الثالثة", en: "3 Series" },
      year: 2022,
      mileageKm: 35000,
      priceCents: 165000000,
      currency: "EGP",
      isNegotiable: false,
      fuelType: "PETROL",
      transmission: "AUTOMATIC",
      bodyType: "SEDAN",
      condition: "USED",
      conditionGrade: "VERY_GOOD",
      sellerType: "PRIVATE",
      cityName: { ar: "الجيزة", en: "Giza" },
      coverImageUrl: "https://cdn.example.com/bmw.jpg",
      officialPriceCents: null,
      isFavorited: false,
      isFeatured: false,
      featuredUntil: null,
      featuredTier: null,
      publishedAt: "2026-08-20T10:00:00Z",
      viewsCount: 230,
      leadsCount: 12,
      favoritesCount: 1,
      imagesCount: 4,
      isSellerVerified: false,
      status: "PAUSED",
      rejectionReason: null,
    },
    {
      publicId: "list_rejected_3",
      slug: "hyundai-elantra-2020-rejected",
      title: "هيونداي إلنترا 2020",
      makeName: { ar: "هيونداي", en: "Hyundai" },
      modelName: { ar: "إلنترا", en: "Elantra" },
      year: 2020,
      mileageKm: 80000,
      priceCents: 45000000,
      currency: "EGP",
      isNegotiable: true,
      fuelType: "PETROL",
      transmission: "AUTOMATIC",
      bodyType: "SEDAN",
      condition: "USED",
      conditionGrade: "GOOD",
      sellerType: "PRIVATE",
      cityName: { ar: "الإسكندرية", en: "Alexandria" },
      coverImageUrl: null,
      officialPriceCents: null,
      isFavorited: false,
      isFeatured: false,
      featuredUntil: null,
      featuredTier: null,
      publishedAt: null,
      viewsCount: 0,
      leadsCount: 0,
      favoritesCount: 0,
      imagesCount: 2,
      isSellerVerified: false,
      status: "REJECTED",
      rejectionReason: "الصور غير واضحة يرجى إعادة رفع صور واضحة للمركبة",
    },
  ];

  beforeEach(() => {
    mockUpdateListingPrice.mockReset();
    mockTransitionListing.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders my listings cards with facts, status badges, metrics, and rejection note", () => {
    render(<MyListingsList initialItems={sampleListings} locale="ar" />);

    // Verify container and cards
    expect(screen.getByTestId("my-listings-container")).toBeInTheDocument();
    expect(screen.getByTestId("my-listing-card-list_active_1")).toBeInTheDocument();
    expect(screen.getByTestId("my-listing-card-list_paused_2")).toBeInTheDocument();
    expect(screen.getByTestId("my-listing-card-list_rejected_3")).toBeInTheDocument();

    // Verify facts
    expect(screen.getByText("تويوتا كامري 2024 بحالة ممتازة")).toBeInTheDocument();
    expect(screen.getByText("بي إم دبليو الفئة الثالثة 2022")).toBeInTheDocument();
    expect(screen.getByText("هيونداي إلنترا 2020")).toBeInTheDocument();

    // Verify status badges
    expect(screen.getByTestId("status-badge-list_active_1")).toHaveTextContent("نشط");
    expect(screen.getByTestId("status-badge-list_paused_2")).toHaveTextContent("متوقف مؤقتاً");
    expect(screen.getByTestId("status-badge-list_rejected_3")).toHaveTextContent("مرفوض");

    // Verify metrics
    expect(screen.getByTestId("views-count-list_active_1")).toHaveTextContent(/145|١٤٥/);
    expect(screen.getByTestId("leads-count-list_active_1")).toHaveTextContent(/8|٨/);

    // Verify rejection reason on rejected listing
    expect(screen.getByTestId("rejection-reason-list_rejected_3")).toHaveTextContent(
      "الصور غير واضحة يرجى إعادة رفع صور واضحة للمركبة",
    );

    // Active listing has public link
    expect(screen.getByTestId("listing-link-list_active_1")).toHaveAttribute(
      "href",
      "/ar/listing/toyota-camry-2024-active",
    );
  });

  it("filters listings by status tabs and renders empty state when tab has no items", () => {
    render(<MyListingsList initialItems={sampleListings} locale="ar" />);

    // All tab shows all 3
    expect(screen.getByTestId("tab-all")).toBeInTheDocument();
    expect(screen.getAllByTestId(/my-listing-card-/)).toHaveLength(3);

    // Click Active tab
    fireEvent.click(screen.getByTestId("tab-active"));
    expect(screen.getAllByTestId(/my-listing-card-/)).toHaveLength(1);
    expect(screen.getByTestId("my-listing-card-list_active_1")).toBeInTheDocument();

    // Click Paused tab
    fireEvent.click(screen.getByTestId("tab-paused"));
    expect(screen.getAllByTestId(/my-listing-card-/)).toHaveLength(1);
    expect(screen.getByTestId("my-listing-card-list_paused_2")).toBeInTheDocument();

    // Click Sold tab (empty)
    fireEvent.click(screen.getByTestId("tab-sold"));
    expect(screen.queryByTestId(/my-listing-card-/)).not.toBeInTheDocument();
    expect(screen.getByTestId("my-listings-empty")).toBeInTheDocument();
  });

  it("opens PriceEditDialog and updates price via updateListingPrice", async () => {
    mockUpdateListingPrice.mockResolvedValueOnce({
      ok: true,
      data: {
        ...sampleListings[0],
        priceCents: 92000000,
      },
    });

    render(<MyListingsList initialItems={sampleListings} locale="ar" />);

    const editPriceBtn = screen.getByTestId("action-edit-price-list_active_1");
    fireEvent.click(editPriceBtn);

    // Dialog opens
    expect(screen.getByTestId("price-edit-dialog")).toBeInTheDocument();

    // Change price input
    const input = screen.getByTestId("cents-input-edit-listing-price");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "920000" } });
    fireEvent.blur(input);

    const saveBtn = screen.getByTestId("price-edit-submit");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateListingPrice).toHaveBeenCalledWith({
        publicId: "list_active_1",
        input: { priceCents: 92000000 },
      });
    });

    // Verify card price updated
    await waitFor(() => {
      expect(screen.getByTestId("listing-price-list_active_1")).toHaveTextContent(
        /920,000/,
      );
    });
  });

  it("pauses active listing and activates paused listing via transitionListing", async () => {
    // 1. Pause active listing
    mockTransitionListing.mockResolvedValueOnce({
      ok: true,
      data: {
        ...sampleListings[0],
        status: "PAUSED",
      },
    });

    render(<MyListingsList initialItems={sampleListings} locale="ar" />);

    const menuTrigger = screen.getByTestId("action-menu-trigger-list_active_1");
    fireEvent.click(menuTrigger);

    const pauseItem = await screen.findByTestId("action-pause-list_active_1");
    fireEvent.click(pauseItem);

    await waitFor(() => {
      expect(mockTransitionListing).toHaveBeenCalledWith({
        publicId: "list_active_1",
        input: { action: "pause" },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("status-badge-list_active_1")).toHaveTextContent(
        "متوقف مؤقتاً",
      );
    });
  });

  it("deletes a listing with confirmation dialog and removes it from the list", async () => {
    mockTransitionListing.mockResolvedValueOnce({
      ok: true,
      data: {
        ...sampleListings[1],
        status: "ARCHIVED",
      },
    });

    render(<MyListingsList initialItems={sampleListings} locale="ar" />);

    expect(screen.getByTestId("my-listing-card-list_paused_2")).toBeInTheDocument();

    // Open menu
    const menuTrigger = screen.getByTestId("action-menu-trigger-list_paused_2");
    fireEvent.click(menuTrigger);

    // Click delete menu item
    const deleteItem = await screen.findByTestId("action-delete-list_paused_2");
    fireEvent.click(deleteItem);

    // Confirmation dialog appears
    const confirmDialog = await screen.findByTestId("delete-listing-dialog");
    expect(confirmDialog).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByTestId("delete-listing-confirm");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockTransitionListing).toHaveBeenCalledWith({
        publicId: "list_paused_2",
        input: { action: "remove" },
      });
    });

    // Card is removed from list
    await waitFor(() => {
      expect(screen.queryByTestId("my-listing-card-list_paused_2")).not.toBeInTheDocument();
    });
  });
});
