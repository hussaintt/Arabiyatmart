"use client";

import * as React from "react";
import Image from "next/image";
import { Edit2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSellStore } from "@/components/sell/sell-workflow";
import { formatMoneyFromCents } from "@/i18n/format";
import type { AppLocale } from "@/i18n/config";
import type { SellStep } from "@/types/sell";

interface ReviewStepProps {
  locale: AppLocale;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  selectedScope?: import("@/types/sell").ListingOwnershipScope | null | undefined;
}

export function ReviewStep({
  locale,
  onSubmit,
  isSubmitting: propIsSubmitting,
  selectedScope,
}: ReviewStepProps) {
  const ar = locale === "ar";
  const draft = useSellStore((state) => state.draft);
  const photos = useSellStore((state) => state.photos);
  const coverPhotoClientId = useSellStore((state) => state.coverPhotoClientId);
  const goToStep = useSellStore((state) => state.goToStep);
  const isSubmittingStore = useSellStore((state) => state.isSubmitting);
  const errorMessage = useSellStore((state) => state.errorMessage);

  const isSubmitting = propIsSubmitting ?? isSubmittingStore;

  const readyPhotos = photos.filter(
    (p) => p.status === "READY" && p.publicId !== null,
  );

  const handleEdit = (step: SellStep) => {
    void goToStep(step);
  };

  const fuelLabels: Record<string, { ar: string; en: string }> = {
    PETROL: { ar: "بنزين", en: "Petrol" },
    DIESEL: { ar: "ديزل", en: "Diesel" },
    HYBRID: { ar: "هايبرد", en: "Hybrid" },
    PLUG_IN_HYBRID: { ar: "هايبرد قابل للشحن", en: "Plug-in Hybrid" },
    ELECTRIC: { ar: "كهربائي", en: "Electric" },
    CNG: { ar: "غاز طبيعي", en: "CNG" },
  };

  const transmissionLabels: Record<string, { ar: string; en: string }> = {
    AUTOMATIC: { ar: "أوتوماتيك", en: "Automatic" },
    MANUAL: { ar: "يدوي (مانيوال)", en: "Manual" },
    CVT: { ar: "CVT", en: "CVT" },
    DUAL_CLUTCH: { ar: "ثنائي القابض", en: "Dual Clutch" },
  };

  const bodyTypeLabels: Record<string, { ar: string; en: string }> = {
    SEDAN: { ar: "سيدان", en: "Sedan" },
    SUV: { ar: "SUV / دفع رباعي", en: "SUV" },
    HATCHBACK: { ar: "هاتشباك", en: "Hatchback" },
    COUPE: { ar: "كوبيه", en: "Coupe" },
    CROSSOVER: { ar: "كروس أوفر", en: "Crossover" },
    PICKUP: { ar: "بيك أب", en: "Pickup" },
    VAN: { ar: "فان", en: "Van" },
    CONVERTIBLE: { ar: "كابريوليه", en: "Convertible" },
    WAGON: { ar: "ستيشن واجن", en: "Wagon" },
  };

  return (
    <div className="space-y-6" data-testid="review-step-content">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {ar ? "مراجعة تفاصيل الإعلان" : "Review Listing Details"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "يرجى مراجعة كافة البيانات المدخلة بعناية قبل تأكيد النشر."
              : "Please carefully review all entered details before publishing."}
          </p>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          data-testid="sell-submit-error"
          className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
        >
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-sm">{errorMessage}</div>
        </div>
      )}

      {/* 0. Ownership Scope & Quotas */}
      {selectedScope && (
        <div
          className="rounded-lg border bg-card p-4 transition-colors"
          data-testid="review-section-scope"
        >
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>{ar ? "جهة ملكية الإعلان والحصة" : "Ownership Scope & Quota"}</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground block">{ar ? "الحساب الناشر" : "Publishing Account"}</span>
              <span className="font-semibold text-foreground">{selectedScope.displayName}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">{ar ? "الدور والصلاحية" : "Role & Permissions"}</span>
              <span className="font-medium">
                {selectedScope.role === 'OWNER'
                  ? ar ? 'مالك المعرض' : 'Dealership Owner'
                  : selectedScope.role === 'MANAGER'
                  ? ar ? 'مدير المعرض' : 'Dealership Manager'
                  : selectedScope.role === 'STAFF'
                  ? ar ? 'موظف المعرض' : 'Dealership Staff'
                  : ar ? 'بائع شخصي' : 'Individual Seller'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">{ar ? "سعة الإعلانات النشطة" : "Active Quota"}</span>
              <span className="font-medium">
                {ar
                  ? `حتى ${selectedScope.quota.maxLimit} إعلانات نشطة`
                  : `Up to ${selectedScope.quota.maxLimit} active listings`}
              </span>
            </div>
          </div>
          {selectedScope.quota.availableSlots <= 0 && (
            <div
              role="alert"
              data-testid="sell-quota-exceeded-alert"
              className="mt-3 flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200"
            >
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
              <div className="text-sm font-medium">
                {ar
                  ? `تم استنفاد الحد الأقصى للإعلانات (${selectedScope.quota.currentCount}/${selectedScope.quota.maxLimit}). يرجى ترقية باقة الاشتراك أو أرشفة إعلانات سابقة لنشر إعلانات جديدة.`
                  : `Listing quota reached (${selectedScope.quota.currentCount}/${selectedScope.quota.maxLimit}). Upgrade your subscription plan or archive older listings to publish.`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. Condition Section */}
      <div
        className="rounded-lg border bg-card p-4 transition-colors"
        data-testid="review-section-condition"
      >
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>{ar ? "حالة السيارة" : "Vehicle Condition"}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleEdit("condition")}
            data-testid="review-edit-condition"
            aria-label={ar ? "تعديل حالة السيارة" : "Edit vehicle condition"}
          >
            <Edit2 className="h-3.5 w-3.5 me-1" />
            {ar ? "تعديل" : "Edit"}
          </Button>
        </div>
        <div className="mt-3 text-sm">
          <span className="text-muted-foreground me-2">{ar ? "الحالة:" : "Condition:"}</span>
          <Badge variant={draft.condition === "NEW" ? "default" : "secondary"}>
            {draft.condition === "NEW"
              ? ar ? "جديدة" : "New"
              : draft.condition === "USED"
              ? ar ? "مستعملة" : "Used"
              : "-"}
          </Badge>
        </div>
      </div>

      {/* 2. Vehicle Section */}
      <div
        className="rounded-lg border bg-card p-4 transition-colors"
        data-testid="review-section-vehicle"
      >
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>{ar ? "بيانات المركبة" : "Vehicle Information"}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleEdit("vehicle")}
            data-testid="review-edit-vehicle"
            aria-label={ar ? "تعديل بيانات المركبة" : "Edit vehicle information"}
          >
            <Edit2 className="h-3.5 w-3.5 me-1" />
            {ar ? "تعديل" : "Edit"}
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground block">{ar ? "سنة الصنع" : "Year"}</span>
            <span className="font-medium">{draft.year ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">{ar ? "الشركة المصنعة" : "Make"}</span>
            <span className="font-medium">{draft.makePublicId ?? "-"}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">{ar ? "الموديل" : "Model"}</span>
            <span className="font-medium">{draft.modelPublicId ?? "-"}</span>
          </div>
          {draft.trimPublicId && (
            <div>
              <span className="text-muted-foreground block">{ar ? "الفئة" : "Trim"}</span>
              <span className="font-medium">{draft.trimPublicId}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Details Section */}
      <div
        className="rounded-lg border bg-card p-4 transition-colors"
        data-testid="review-section-details"
      >
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>{ar ? "المواصفات الفنية" : "Technical Details"}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleEdit("details")}
            data-testid="review-edit-details"
            aria-label={ar ? "تعديل المواصفات الفنية" : "Edit technical details"}
          >
            <Edit2 className="h-3.5 w-3.5 me-1" />
            {ar ? "تعديل" : "Edit"}
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground block">{ar ? "المسافة المقطوعة" : "Mileage"}</span>
            <span className="font-medium">
              {draft.mileageKm !== null ? `${draft.mileageKm.toLocaleString(ar ? "ar-EG" : "en-US")} ${ar ? "كم" : "km"}` : "-"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">{ar ? "نوع الوقود" : "Fuel Type"}</span>
            <span className="font-medium">
              {draft.fuelType ? (fuelLabels[draft.fuelType]?.[ar ? "ar" : "en"] ?? draft.fuelType) : "-"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">{ar ? "ناقل الحركة" : "Transmission"}</span>
            <span className="font-medium">
              {draft.transmission ? (transmissionLabels[draft.transmission]?.[ar ? "ar" : "en"] ?? draft.transmission) : "-"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">{ar ? "نوع الهيكل" : "Body Type"}</span>
            <span className="font-medium">
              {draft.bodyType ? (bodyTypeLabels[draft.bodyType]?.[ar ? "ar" : "en"] ?? draft.bodyType) : "-"}
            </span>
          </div>
          {draft.colorExterior && (
            <div>
              <span className="text-muted-foreground block">{ar ? "اللون الخارجي" : "Exterior Color"}</span>
              <span className="font-medium">{draft.colorExterior}</span>
            </div>
          )}
          {draft.colorInterior && (
            <div>
              <span className="text-muted-foreground block">{ar ? "اللون الداخلي" : "Interior Color"}</span>
              <span className="font-medium">{draft.colorInterior}</span>
            </div>
          )}
        </div>
        {draft.description && (
          <div className="mt-3 border-t pt-2 text-sm">
            <span className="text-muted-foreground block mb-1">{ar ? "الوصف" : "Description"}</span>
            <p className="whitespace-pre-wrap text-muted-foreground/90">{draft.description}</p>
          </div>
        )}
      </div>

      {/* 4. Pricing Section */}
      <div
        className="rounded-lg border bg-card p-4 transition-colors"
        data-testid="review-section-pricing"
      >
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>{ar ? "السعر وخيارات الدفع" : "Pricing & Terms"}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleEdit("pricing")}
            data-testid="review-edit-pricing"
            aria-label={ar ? "تعديل السعر" : "Edit pricing"}
          >
            <Edit2 className="h-3.5 w-3.5 me-1" />
            {ar ? "تعديل" : "Edit"}
          </Button>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground">{ar ? "السعر المطلوب:" : "Asking Price:"}</span>
            <span className="text-xl font-bold text-primary">
              {draft.priceCents ? formatMoneyFromCents(draft.priceCents, "EGP", locale) : "-"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {draft.isNegotiable && (
              <Badge variant="outline">{ar ? "قابل للتفاوض" : "Negotiable"}</Badge>
            )}
            {draft.installmentAvailable && (
              <Badge variant="outline">{ar ? "متاح بالتقسيط" : "Installment Available"}</Badge>
            )}
            {draft.exchangeAccepted && (
              <Badge variant="outline">{ar ? "إمكانية البدل" : "Exchange Accepted"}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* 5. Photos Section */}
      <div
        className="rounded-lg border bg-card p-4 transition-colors"
        data-testid="review-section-photos"
      >
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>
              {ar
                ? `الصور (${readyPhotos.length} صورة جاهزة)`
                : `Photos (${readyPhotos.length} ready)`}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleEdit("photos")}
            data-testid="review-edit-photos"
            aria-label={ar ? "تعديل الصور" : "Edit photos"}
          >
            <Edit2 className="h-3.5 w-3.5 me-1" />
            {ar ? "تعديل" : "Edit"}
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {readyPhotos.map((photo, index) => {
            const isCover =
              coverPhotoClientId === photo.clientId ||
              (!coverPhotoClientId && index === 0);
            return (
              <div
                key={photo.clientId}
                className="relative aspect-square overflow-hidden rounded-md border bg-muted"
              >
                <Image
                  src={photo.url || photo.localPreviewUrl}
                  alt={ar ? `صورة ${index + 1}` : `Photo ${index + 1}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
                {isCover && (
                  <span className="absolute bottom-1 start-1 rounded bg-primary/90 px-1 py-0.5 text-[10px] font-medium text-primary-foreground">
                    {ar ? "الرئيسية" : "Cover"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Contact & Location Section */}
      <div
        className="rounded-lg border bg-card p-4 transition-colors"
        data-testid="review-section-location"
      >
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>{ar ? "الموقع ومعلومات التواصل" : "Location & Contact"}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleEdit("location")}
            data-testid="review-edit-location"
            aria-label={ar ? "تعديل الموقع والتواصل" : "Edit location and contact"}
          >
            <Edit2 className="h-3.5 w-3.5 me-1" />
            {ar ? "تعديل" : "Edit"}
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <span className="text-muted-foreground block">{ar ? "المحافظة / المدينة" : "City ID"}</span>
            <span className="font-medium">{draft.cityId ?? "-"}</span>
          </div>
          {draft.areaId && (
            <div>
              <span className="text-muted-foreground block">{ar ? "المنطقة / الحي" : "Area ID"}</span>
              <span className="font-medium">{draft.areaId}</span>
            </div>
          )}
          {draft.contactPhone && (
            <div>
              <span className="text-muted-foreground block">{ar ? "رقم الهاتف" : "Phone"}</span>
              <span className="font-medium dir-ltr inline-block">{draft.contactPhone}</span>
            </div>
          )}
          {draft.whatsappPhone && (
            <div>
              <span className="text-muted-foreground block">{ar ? "واتساب" : "WhatsApp"}</span>
              <span className="font-medium dir-ltr inline-block">{draft.whatsappPhone}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground block">{ar ? "المحادثة عبر الموقع" : "In-app Chat"}</span>
            <span className="font-medium">
              {draft.allowChat ? (ar ? "مفعلة" : "Enabled") : (ar ? "معطلة" : "Disabled")}
            </span>
          </div>
        </div>
      </div>

      {/* Review Direct Submit Button */}
      {onSubmit && (
        <div className="pt-4 flex justify-end">
          <Button
            type="button"
            size="lg"
            onClick={onSubmit}
            disabled={isSubmitting}
            data-testid="sell-submit-btn"
            className="w-full sm:w-auto font-semibold px-8"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {ar ? "جاري النشر..." : "Publishing..."}
              </>
            ) : (
              ar ? "تأكيد ونشر الإعلان" : "Confirm & Publish Listing"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
