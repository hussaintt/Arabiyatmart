"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, MessageSquare, AlertCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListingStatusActions } from "@/components/my-listings/listing-status-actions";
import { formatMoneyFromCents } from "@/i18n/format";
import type { AppLocale } from "@/i18n/config";
import type { ListingCard, MyListing } from "@/types/listing";

interface MyListingCardProps {
  listing: MyListing;
  locale: AppLocale;
  onStatusUpdated?: (updated: ListingCard) => void;
  onPriceUpdated?: (newPriceCents: number) => void;
  onDeleted?: (publicId: string) => void;
}

export function MyListingCard({
  listing,
  locale,
  onStatusUpdated,
  onPriceUpdated,
  onDeleted,
}: MyListingCardProps) {
  const ar = locale === "ar";
  const status = listing.status;

  const statusBadge = () => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium" data-testid={`status-badge-${listing.publicId}`}>
            {ar ? "نشط" : "Active"}
          </Badge>
        );
      case "PENDING_REVIEW":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium" data-testid={`status-badge-${listing.publicId}`}>
            {ar ? "قيد المراجعة" : "Under Review"}
          </Badge>
        );
      case "PAUSED":
        return (
          <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground font-medium" data-testid={`status-badge-${listing.publicId}`}>
            {ar ? "متوقف مؤقتاً" : "Paused"}
          </Badge>
        );
      case "SOLD":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-medium" data-testid={`status-badge-${listing.publicId}`}>
            {ar ? "تم البيع" : "Sold"}
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="destructive" className="font-medium" data-testid={`status-badge-${listing.publicId}`}>
            {ar ? "مرفوض" : "Rejected"}
          </Badge>
        );
      case "DRAFT":
        return (
          <Badge variant="outline" className="font-medium" data-testid={`status-badge-${listing.publicId}`}>
            {ar ? "مسودة" : "Draft"}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-medium" data-testid={`status-badge-${listing.publicId}`}>
            {status}
          </Badge>
        );
    }
  };

  const title =
    listing.title ||
    `${listing.year} ${listing.makeName?.[locale] ?? ""} ${listing.modelName?.[locale] ?? ""}`.trim();

  return (
    <div
      className="flex flex-col sm:flex-row items-stretch rounded-xl border bg-card p-4 gap-4 transition-shadow hover:shadow-sm"
      data-testid={`my-listing-card-${listing.publicId}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] sm:w-48 sm:h-36 shrink-0 overflow-hidden rounded-lg bg-muted">
        {listing.coverImageUrl ? (
          <Image
            src={listing.coverThumbnailUrl ?? listing.coverMediumUrl ?? listing.coverImageUrl}
            alt={title}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            {ar ? "لا توجد صورة" : "No image"}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between space-y-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {statusBadge()}
                {listing.isFeatured && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[11px]">
                    {ar ? "مميز" : "Featured"}
                  </Badge>
                )}
              </div>
              <h3 className="text-base font-bold line-clamp-1 hover:text-primary transition-colors">
                {status === "ACTIVE" ? (
                  <Link
                    href={`/${locale}/listing/${listing.slug}`}
                    className="hover:underline flex items-center gap-1.5"
                    data-testid={`listing-link-${listing.publicId}`}
                  >
                    <span>{title}</span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </Link>
                ) : (
                  <span>{title}</span>
                )}
              </h3>
            </div>
            <div className="text-end">
              <span className="text-base font-bold text-primary block" data-testid={`listing-price-${listing.publicId}`}>
                {formatMoneyFromCents(listing.priceCents, listing.currency, locale)}
              </span>
            </div>
          </div>

          {/* Rejection Reason Notice */}
          {status === "REJECTED" && listing.rejectionReason && (
            <div
              className="mt-2 flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive"
              data-testid={`rejection-reason-${listing.publicId}`}
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">{ar ? "سبب الرفض:" : "Rejection Reason:"}</span>
                <span>{listing.rejectionReason}</span>
              </div>
            </div>
          )}

          {/* Metrics */}
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1" data-testid={`views-count-${listing.publicId}`}>
              <Eye className="h-3.5 w-3.5" />
              <span>{listing.viewsCount.toLocaleString(ar ? "ar-EG" : "en-US")} {ar ? "مشاهدة" : "views"}</span>
            </span>
            {listing.leadsCount !== null && (
              <span className="flex items-center gap-1" data-testid={`leads-count-${listing.publicId}`}>
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{listing.leadsCount.toLocaleString(ar ? "ar-EG" : "en-US")} {ar ? "استفسار" : "leads"}</span>
              </span>
            )}
            {listing.publishedAt && (
              <span>
                {ar ? "تاريخ النشر: " : "Published: "}
                {new Date(listing.publishedAt).toLocaleDateString(ar ? "ar-EG" : "en-US")}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end border-t pt-3">
          <ListingStatusActions
            listing={listing}
            locale={locale}
            onStatusUpdated={onStatusUpdated}
            onPriceUpdated={onPriceUpdated}
            onDeleted={onDeleted}
          />
        </div>
      </div>
    </div>
  );
}
