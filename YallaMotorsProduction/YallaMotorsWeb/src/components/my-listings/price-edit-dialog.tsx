"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CentsInput } from "@/components/sell/cents-input";
import { updateListingPrice } from "@/server/actions/listings";
import type { AppLocale } from "@/i18n/config";

interface PriceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingPublicId: string;
  currentPriceCents: number;
  currency?: string;
  locale: AppLocale;
  onSuccess?: (newPriceCents: number) => void;
}

export function PriceEditDialog({
  open,
  onOpenChange,
  listingPublicId,
  currentPriceCents,
  currency = "EGP",
  locale,
  onSuccess,
}: PriceEditDialogProps) {
  const ar = locale === "ar";
  const [newPriceCents, setNewPriceCents] = React.useState<number | null>(
    currentPriceCents,
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setNewPriceCents(currentPriceCents);
      setErrorMessage(null);
    }
  }, [open, currentPriceCents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!newPriceCents || newPriceCents <= 0) {
      setErrorMessage(
        ar ? "يرجى إدخال سعر صالح أكبر من صفر" : "Please enter a valid price greater than zero",
      );
      return;
    }

    if (newPriceCents === currentPriceCents) {
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await updateListingPrice({
        publicId: listingPublicId,
        input: { priceCents: newPriceCents },
      });

      if (!result.ok) {
        setErrorMessage(
          result.error.message ||
            (ar ? "فشل تحديث السعر" : "Failed to update price"),
        );
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onSuccess?.(newPriceCents);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : ar
            ? "حدث خطأ أثناء تحديث السعر"
            : "An error occurred while updating the price";
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="price-edit-dialog"
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {ar ? "تعديل سعر الإعلان" : "Edit Listing Price"}
            </DialogTitle>
            <DialogDescription>
              {ar
                ? "أدخل السعر الجديد بالجنيه. سيتم تحديث السعر مباشرة في صفحة الإعلان."
                : "Enter the new price. The updated price will be reflected immediately."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="edit-listing-price"
                className="text-sm font-medium"
              >
                {ar ? "السعر الجديد" : "New Price"}
              </label>
              <CentsInput
                id="edit-listing-price"
                value={newPriceCents}
                onChange={setNewPriceCents}
                currency={currency}
                locale={locale}
              />
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="text-sm text-destructive"
                data-testid="price-edit-error"
              >
                {errorMessage}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              data-testid="price-edit-cancel"
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !newPriceCents || newPriceCents <= 0}
              data-testid="price-edit-submit"
            >
              {isSubmitting && (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              )}
              {ar ? "حفظ السعر" : "Save Price"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
