"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MyListingCard } from "@/components/my-listings/my-listing-card";
import type { AppLocale } from "@/i18n/config";
import type { ListingCard, MyListing } from "@/types/listing";

interface MyListingsListProps {
  initialItems: MyListing[];
  initialStatus?: string | undefined;
  locale: AppLocale;
}

export function MyListingsList({
  initialItems,
  initialStatus = "ALL",
  locale,
}: MyListingsListProps) {
  const ar = locale === "ar";
  const [activeTab, setActiveTab] = React.useState<string>(initialStatus);
  const [listings, setListings] = React.useState<MyListing[]>(initialItems);

  React.useEffect(() => {
    setListings(initialItems);
  }, [initialItems]);

  const tabs = [
    { id: "ALL", label: ar ? "جميع الإعلانات" : "All Listings" },
    { id: "ACTIVE", label: ar ? "نشطة" : "Active" },
    { id: "PENDING_REVIEW", label: ar ? "قيد المراجعة" : "Under Review" },
    { id: "PAUSED", label: ar ? "متوقفة" : "Paused" },
    { id: "SOLD", label: ar ? "تم البيع" : "Sold" },
  ];

  const filteredListings = React.useMemo(() => {
    if (activeTab === "ALL") return listings;
    return listings.filter((item) => item.status === activeTab);
  }, [listings, activeTab]);

  const handleStatusUpdated = (publicId: string, updated: ListingCard) => {
    setListings((prev) =>
      prev.map((item) =>
        item.publicId === publicId
          ? {
              ...item,
              ...updated,
              // If updated from transition, update status
              status: (updated as unknown as { status?: MyListing["status"] }).status ?? item.status,
            }
          : item,
      ),
    );
  };

  const handlePriceUpdated = (publicId: string, newPriceCents: number) => {
    setListings((prev) =>
      prev.map((item) =>
        item.publicId === publicId
          ? { ...item, priceCents: newPriceCents }
          : item,
      ),
    );
  };

  const handleDeleted = (publicId: string) => {
    setListings((prev) => prev.filter((item) => item.publicId !== publicId));
  };

  return (
    <div className="space-y-6" data-testid="my-listings-container">
      {/* Header and Add CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {ar ? "إعلاناتي" : "My Listings"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ar
              ? "إدارة وتعديل ومتابعة إعلانات السيارات الخاصة بك."
              : "Manage, edit, and track your vehicle listings."}
          </p>
        </div>
        <Button asChild size="default" className="shrink-0 font-semibold" data-testid="add-listing-cta">
          <Link href={`/${locale}/sell`}>
            <Plus className="me-1.5 h-4 w-4" />
            {ar ? "إضافة إعلان جديد" : "Add New Listing"}
          </Link>
        </Button>
      </div>

      {/* Filter Tabs */}
      <div
        className="flex items-center gap-1 overflow-x-auto border-b pb-1 text-sm scrollbar-none"
        role="tablist"
        aria-label={ar ? "تصفية الإعلانات حسب الحالة" : "Filter listings by status"}
        data-testid="my-listings-tabs"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count =
            tab.id === "ALL"
              ? listings.length
              : listings.filter((l) => l.status === tab.id).length;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-4 py-2.5 font-medium transition-colors border-b-2 -mb-1 ${
                isActive
                  ? "border-primary text-primary font-bold bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              data-testid={`tab-${tab.id.toLowerCase()}`}
            >
              <span>{tab.label}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Listings List */}
      {filteredListings.length > 0 ? (
        <div className="space-y-4" data-testid="my-listings-list">
          {filteredListings.map((listing) => (
            <MyListingCard
              key={listing.publicId}
              listing={listing}
              locale={locale}
              onStatusUpdated={(updated) => handleStatusUpdated(listing.publicId, updated)}
              onPriceUpdated={(newPrice) => handlePriceUpdated(listing.publicId, newPrice)}
              onDeleted={() => handleDeleted(listing.publicId)}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center"
          data-testid="my-listings-empty"
        >
          <div className="rounded-full bg-muted p-4 mb-3">
            <Car className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">
            {ar ? "لا توجد إعلانات في هذا القسم" : "No listings in this category"}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {activeTab === "ALL"
              ? ar
                ? "لم تقم بإضافة أي إعلانات بعد. ابدأ الآن ببيع سيارتك بسهولة وسرعة."
                : "You haven't listed any cars yet. Start selling your car quickly and easily."
              : ar
                ? "لا توجد إعلانات مطابقة لهذه الحالة في الوقت الحالي."
                : "There are no listings matching this status currently."}
          </p>
          <Button asChild className="mt-5" data-testid="empty-sell-button">
            <Link href={`/${locale}/sell`}>
              <Plus className="me-1.5 h-4 w-4" />
              {ar ? "أضف سيارتك للبيع" : "Sell Your Car"}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
