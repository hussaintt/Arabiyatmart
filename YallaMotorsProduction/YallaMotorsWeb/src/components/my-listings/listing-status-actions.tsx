"use client";

import * as React from "react";
import Link from "next/link";
import {
  MoreVertical,
  Pause,
  Play,
  CheckCircle,
  Tag,
  Trash2,
  TrendingUp,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PriceEditDialog } from "@/components/my-listings/price-edit-dialog";
import { transitionListing } from "@/server/actions/listings";
import type { AppLocale } from "@/i18n/config";
import type { ListingCard, MyListing } from "@/types/listing";
import type { ListingTransitionAction } from "@/types/sell";

interface ListingStatusActionsProps {
  listing: MyListing;
  locale: AppLocale;
  onStatusUpdated?: ((updated: ListingCard) => void) | undefined;
  onPriceUpdated?: ((newPriceCents: number) => void) | undefined;
  onDeleted?: ((publicId: string) => void) | undefined;
}

export function ListingStatusActions({
  listing,
  locale,
  onStatusUpdated,
  onPriceUpdated,
  onDeleted,
}: ListingStatusActionsProps) {
  const ar = locale === "ar";
  const [isPriceDialogOpen, setIsPriceDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleTransition = async (action: ListingTransitionAction) => {
    if (isPending) return;
    setIsPending(true);
    setActionError(null);

    try {
      const result = await transitionListing({
        publicId: listing.publicId,
        input: { action },
      });

      if (!result.ok) {
        setActionError(
          result.error.message ||
            (ar ? "فشل تنفيذ الإجراء" : "Failed to execute action"),
        );
        setIsPending(false);
        return;
      }

      setIsPending(false);
      setMenuOpen(false);
      if (action === "remove") {
        onDeleted?.(listing.publicId);
      } else {
        onStatusUpdated?.(result.data);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : ar
            ? "حدث خطأ غير متوقع"
            : "An unexpected error occurred";
      setActionError(msg);
      setIsPending(false);
    }
  };

  const status = listing.status;

  return (
    <>
      <div className="flex items-center gap-2" data-testid={`listing-actions-${listing.publicId}`}>
        {/* Quick Price Edit Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsPriceDialogOpen(true)}
          disabled={isPending || status === "SOLD"}
          data-testid={`action-edit-price-${listing.publicId}`}
        >
          <Tag className="h-3.5 w-3.5 me-1" />
          {ar ? "تعديل السعر" : "Edit Price"}
        </Button>

        {/* Promote Listing CTA */}
        {status === "ACTIVE" && (
          <Button
            asChild
            variant="default"
            size="sm"
            className="hidden sm:inline-flex bg-amber-600 hover:bg-amber-700 text-white"
            data-testid={`action-promote-${listing.publicId}`}
          >
            <Link href={`/${locale}/best-offer/${listing.slug}`}>
              <TrendingUp className="h-3.5 w-3.5 me-1" />
              {ar ? "ترقية الإعلان" : "Promote"}
            </Link>
          </Button>
        )}

        {/* Lifecycle Dropdown Menu */}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={isPending}
              onClick={() => setMenuOpen((o) => !o)}
              data-testid={`action-menu-trigger-${listing.publicId}`}
              aria-label={ar ? "خيارات الإعلان" : "Listing options"}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align={ar ? "start" : "end"} className="w-48">
            {/* Pause / Unpause */}
            {status === "ACTIVE" && (
              <DropdownMenuItem
                onClick={() => void handleTransition("pause")}
                data-testid={`action-pause-${listing.publicId}`}
              >
                <Pause className="me-2 h-4 w-4" />
                {ar ? "إيقاف مؤقت" : "Pause Listing"}
              </DropdownMenuItem>
            )}

            {status === "PAUSED" && (
              <DropdownMenuItem
                onClick={() => void handleTransition("unpause")}
                data-testid={`action-unpause-${listing.publicId}`}
              >
                <Play className="me-2 h-4 w-4" />
                {ar ? "تفعيل الإعلان" : "Activate Listing"}
              </DropdownMenuItem>
            )}

            {/* Mark as Sold */}
            {status !== "SOLD" && (
              <DropdownMenuItem
                onClick={() => void handleTransition("mark_sold")}
                data-testid={`action-mark-sold-${listing.publicId}`}
              >
                <CheckCircle className="me-2 h-4 w-4 text-emerald-600" />
                {ar ? "تم البيع" : "Mark as Sold"}
              </DropdownMenuItem>
            )}

            {/* Resubmit if Draft / Rejected */}
            {(status === "DRAFT" || status === "REJECTED") && (
              <DropdownMenuItem
                onClick={() => void handleTransition("submit")}
                data-testid={`action-resubmit-${listing.publicId}`}
              >
                <Play className="me-2 h-4 w-4" />
                {ar ? "إرسال للمراجعة" : "Submit for Review"}
              </DropdownMenuItem>
            )}

            {/* Promote in menu for mobile */}
            {status === "ACTIVE" && (
              <DropdownMenuItem asChild className="sm:hidden">
                <Link href={`/${locale}/best-offer/${listing.slug}`}>
                  <TrendingUp className="me-2 h-4 w-4 text-amber-600" />
                  {ar ? "ترقية الإعلان" : "Promote"}
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* Delete / Remove with Confirmation */}
            <DropdownMenuItem
              onClick={() => setIsDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive"
              data-testid={`action-delete-${listing.publicId}`}
            >
              <Trash2 className="me-2 h-4 w-4" />
              {ar ? "حذف الإعلان" : "Delete Listing"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {actionError && (
        <p
          role="alert"
          className="mt-1 text-xs text-destructive"
          data-testid={`action-error-${listing.publicId}`}
        >
          {actionError}
        </p>
      )}

      {/* Edit Price Dialog */}
      <PriceEditDialog
        open={isPriceDialogOpen}
        onOpenChange={setIsPriceDialogOpen}
        listingPublicId={listing.publicId}
        currentPriceCents={listing.priceCents}
        currency={listing.currency}
        locale={locale}
        onSuccess={(newPriceCents) => {
          onPriceUpdated?.(newPriceCents);
        }}
      />

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent data-testid="delete-listing-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ar ? "هل أنت متأكد من حذف الإعلان؟" : "Are you sure you want to delete this listing?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "هذا الإجراء نهائي ولا يمكن التراجع عنه. سيتم إزالة الإعلان بشكل كامل من نتائج البحث."
                : "This action cannot be undone. The listing will be permanently removed from search results."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending} data-testid="delete-listing-cancel">
              {ar ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleTransition("remove")}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="delete-listing-confirm"
            >
              {isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {ar ? "حذف نهائي" : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
