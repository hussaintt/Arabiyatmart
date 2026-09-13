'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Loader2,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PackageCard } from '@/components/promotions/package-card';
import { formatDigits, formatMoneyFromCents } from '@/i18n/format';
import { purchasePromotion } from '@/server/actions/promotions';
import type { AppLocale } from '@/i18n/config';
import type { ListingPromotion, PromotionPackage } from '@/types/lead';
import type { PromotionTier } from '@/types/listing';

interface PromotionListingSummary {
  publicId: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  coverImageUrl: string | null;
}

interface PromotionPurchaseProps {
  packages: PromotionPackage[];
  listing: PromotionListingSummary;
  existingPromotions: ListingPromotion[];
  locale: AppLocale;
}

export function PromotionPurchase({
  packages,
  listing,
  existingPromotions,
  locale,
}: PromotionPurchaseProps) {
  const router = useRouter();
  const ar = locale === 'ar';
  const ArrowBackIcon = ar ? ArrowRight : ArrowLeft;

  // Active promotion detection
  const activePromotion = React.useMemo(() => {
    return existingPromotions.find(
      (p) =>
        p.status === 'ACTIVE' ||
        (p.endsAt && new Date(p.endsAt).getTime() > Date.now())
    ) ?? null;
  }, [existingPromotions]);

  // Default to first package or EXTRA_PREMIUM if present
  const defaultTier = React.useMemo<PromotionTier | null>(() => {
    if (packages.length === 0) return null;
    const extra = packages.find((p) => p.tier === 'EXTRA_PREMIUM');
    return extra ? extra.tier : packages[0]!.tier;
  }, [packages]);

  const [selectedTier, setSelectedTier] = React.useState<PromotionTier | null>(defaultTier);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<{ status?: number; code?: string; message: string } | null>(null);
  const [purchasedPromotion, setPurchasedPromotion] = React.useState<ListingPromotion | null>(null);

  // Idempotency key preservation: keep the same key across retries and timeouts
  const idempotencyKeyRef = React.useRef<string>('');
  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `promo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  const selectedPackage = React.useMemo(() => {
    if (!selectedTier) return null;
    return packages.find((p) => p.tier === selectedTier) ?? null;
  }, [packages, selectedTier]);

  const isSubmittingRef = React.useRef(false);

  const handleSelectTier = (tier: PromotionTier) => {
    if (isSubmittingRef.current || isSubmitting || purchasedPromotion) return;
    setSelectedTier(tier);
    setError(null);
  };

  const handlePurchase = async () => {
    if (!selectedTier || isSubmittingRef.current || isSubmitting || purchasedPromotion) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await purchasePromotion(
        {
          listingPublicId: listing.publicId,
          tier: selectedTier,
        },
        idempotencyKeyRef.current,
        listing.slug
      );

      if (!response.ok) {
        let message = response.error.message;
        const status = response.error.status;

        if (status === 409) {
          message = ar
            ? 'هذا الإعلان لديه ترقية نشطة بالفعل أو يوجد تعارض في العملية'
            : 'This listing already has an active promotion or is currently in conflict.';
        } else if (status === 422) {
          message = ar
            ? 'طلب غير صالح أو الإعلان غير مؤهل للترقية'
            : 'Invalid promotion request or listing is not eligible for promotion.';
        } else if (status === 429) {
          message = ar
            ? 'تم إرسال طلبات كثيرة، يرجى الانتظار قليلاً والمحاولة لاحقاً'
            : 'Too many requests. Please wait a moment and try again.';
        }

        setError({
          status,
          code: response.error.code,
          message,
        });
        return;
      }

      // Success: store returned promotion truth
      setPurchasedPromotion(response.data);
      // Reset idempotency key for any future purchase
      idempotencyKeyRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `promo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      router.refresh();
    } catch (err) {
      setError({
        status: 500,
        code: 'NETWORK_ERROR',
        message:
          err instanceof Error
            ? err.message
            : ar
            ? 'حدث خطأ في الاتصال، يرجى المحاولة مرة أخرى'
            : 'A network error occurred. Please try again.',
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Case: No packages available
  if (packages.length === 0) {
    return (
      <Card className="text-center py-12" data-testid="empty-packages-state">
        <CardContent className="space-y-4">
          <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">
            {ar ? 'لا تتوفر باقات ترويجية حالياً' : 'No Promotion Packages Available'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {ar
              ? 'نعمل على تحديث باقات الترويج. يرجى العودة لاحقاً أو التواصل مع خدمة العملاء.'
              : 'Promotion packages are temporarily unavailable. Please check back soon.'}
          </p>
          <div className="pt-2">
            <Button asChild variant="outline">
              <Link href={`/${locale}/me/listings`}>
                <ArrowBackIcon className="me-2 h-4 w-4" />
                {ar ? 'العودة إلى إعلاناتي' : 'Back to My Listings'}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8" data-testid="promotion-purchase-workflow">
      {/* Existing Active Promotion Alert */}
      {activePromotion && !purchasedPromotion && (
        <Alert
          className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          data-testid="active-promotion-alert"
        >
          <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="font-bold flex items-center gap-2">
            <span>{ar ? 'هذا الإعلان مميز حالياً' : 'This Listing Is Currently Promoted'}</span>
            <Badge variant="outline" className="text-xs uppercase font-semibold">
              {activePromotion.tier ?? activePromotion.type}
            </Badge>
          </AlertTitle>
          <AlertDescription className="text-sm mt-1">
            {activePromotion.endsAt ? (
              <span>
                {ar
                  ? `الترقية الحالية تنتهي في ${new Date(activePromotion.endsAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}. يمكنك تجديد الترقية أو ترقيتها لباقة أعلى.`
                  : `Current promotion ends on ${new Date(activePromotion.endsAt).toLocaleDateString('en-US')}. You can renew or upgrade your package.`}
              </span>
            ) : (
              <span>
                {ar
                  ? 'الترقية الحالية نشطة. اختيار باقة جديدة سيقوم بتحديث مميزات إعلانك.'
                  : 'Current promotion is active. Selecting a new package will update your listing visibility.'}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Success Confirmation Card */}
      {purchasedPromotion && (
        <Card
          className="border-emerald-500/50 bg-emerald-500/5 shadow-md"
          data-testid="purchase-success-card"
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <div>
                <CardTitle className="text-emerald-700 dark:text-emerald-400 font-bold">
                  {ar ? 'تم تأكيد ترقية الإعلان بنجاح!' : 'Promotion Successfully Activated!'}
                </CardTitle>
                <CardDescription className="text-sm">
                  {ar
                    ? `تم تطبيق الباقة على إعلانك: ${listing.title}`
                    : `Your package has been applied to: ${listing.title}`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm p-4 bg-background rounded-lg border border-border">
              <div>
                <p className="text-xs text-muted-foreground">{ar ? 'الباقة' : 'Tier'}</p>
                <p className="font-semibold">{purchasedPromotion.tier ?? purchasedPromotion.type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{ar ? 'المدة' : 'Duration'}</p>
                <p className="font-semibold">
                  {formatDigits(purchasedPromotion.durationDays, locale)} {ar ? 'يوم' : 'days'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{ar ? 'الحالة' : 'Status'}</p>
                <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-600 font-semibold">
                  {purchasedPromotion.status}
                </Badge>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Button asChild variant="default">
              <Link href={`/${locale}/me/listings`}>
                {ar ? 'العودة إلى إعلاناتي' : 'Go to My Listings'}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${locale}/listing/${listing.slug}`}>
                {ar ? 'عرض الإعلان المنشور' : 'View Public Listing'}
              </Link>
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Main Promotion Layout: Packages Grid & Sticky Summary */}
      {!purchasedPromotion && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Packages Column (Stacked on mobile, 2 cols on tablet, 2 or 3 in lg) */}
          <div className="lg:col-span-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {ar ? 'اختر باقة الترويج المناسبة' : 'Select a Promotion Package'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {ar
                  ? 'ارفع نسبة مشاهدات سيارتك وتواصل مع المشترين بفعالية أكبر وسرعة أعلى.'
                  : 'Boost your car views and connect with potential buyers faster.'}
              </p>
            </div>

            {/* Error Message Alert */}
            {error && (
              <Alert variant="destructive" data-testid="purchase-error-alert">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{ar ? 'فشلت عملية الترقية' : 'Promotion failed'}</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}

            {/* Grid of Packages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {packages.map((pkg) => (
                <PackageCard
                  key={pkg.tier}
                  pkg={pkg}
                  locale={locale}
                  isSelected={selectedTier === pkg.tier}
                  onSelect={handleSelectTier}
                  disabled={isSubmitting}
                />
              ))}
            </div>
          </div>

          {/* Sticky Purchase Summary on Desktop / Order Confirmation Box */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
            <Card className="border-border shadow-md" data-testid="purchase-summary-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold">
                  {ar ? 'ملخص الترقية' : 'Order Summary'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {listing.title}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-sm pb-4">
                {selectedPackage ? (
                  <>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-muted-foreground">{ar ? 'الباقة المحددة' : 'Selected Tier'}</span>
                      <span className="font-semibold text-foreground" data-testid="summary-selected-tier">
                        {selectedPackage.tier}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <span className="text-muted-foreground">{ar ? 'مدة الظهور' : 'Duration'}</span>
                      <span className="font-semibold text-foreground">
                        {formatDigits(selectedPackage.durationDays, locale)} {ar ? 'يوم' : 'days'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 pt-3 font-bold text-base">
                      <span>{ar ? 'المبلغ الإجمالي' : 'Total Amount'}</span>
                      <span className="text-xl text-primary font-extrabold" data-testid="summary-total-price">
                        {formatMoneyFromCents(selectedPackage.priceCents, selectedPackage.currency, locale)}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {ar ? 'يرجى اختيار باقة للاستمرار' : 'Please select a package to continue'}
                  </p>
                )}

                <div className="pt-2 text-xs text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{ar ? 'معاملة آمنة ومضمونة بنسبة 100%' : '100% secure checkout and instant setup'}</span>
                </div>
              </CardContent>

              <CardFooter className="pt-2">
                <Button
                  type="button"
                  className="w-full text-base font-bold py-6"
                  disabled={!selectedTier || isSubmitting}
                  onClick={() => void handlePurchase()}
                  data-testid="confirm-purchase-button"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="me-2 h-5 w-5 animate-spin" />
                      {ar ? 'جاري تأكيد الترقية...' : 'Processing Promotion...'}
                    </>
                  ) : (
                    <>
                      <Zap className="me-2 h-5 w-5" />
                      {ar ? 'تأكيد الترقية والاشتراك' : 'Confirm and Promote'}
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            <div className="text-center">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/${locale}/me/listings`}>
                  <ArrowBackIcon className="me-1 h-4 w-4" />
                  {ar ? 'إلغاء والعودة لإعلاناتي' : 'Cancel and return to My Listings'}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
