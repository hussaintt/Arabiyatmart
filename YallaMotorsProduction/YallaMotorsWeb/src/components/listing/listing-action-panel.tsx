'use client';

import * as React from 'react';
import { Phone, MessageCircle, Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/components/listing/favorite-button';
import { ReportListingDialog } from '@/components/listing/report-listing-dialog';
import { FinanceLeadDialog } from '@/components/leads/finance-lead-dialog';
import { InsuranceLeadDialog } from '@/components/leads/insurance-lead-dialog';
import { formatMoneyFromCents } from '@/i18n/format';
import { cn } from '@/lib/utils';
import { createContactLead } from '@/server/actions/leads';
import { formatWhatsAppUrl } from '@/lib/whatsapp/message';
import type { AppLocale } from '@/i18n/config';
import type { ListingDetail, ListingImage } from '@/types/listing';
import { trackAnalytics } from '@/lib/analytics/client';

export interface ListingActionPanelProps {
  readonly listing:
    | ListingDetail
    | (Omit<ListingDetail, 'features' | 'images'> & {
        readonly features?: readonly string[] | null | undefined;
        readonly images?: readonly ListingImage[] | undefined;
      });
  readonly locale?: AppLocale | undefined;
  readonly className?: string | undefined;
}

/**
 * Validates and sanitizes a phone number for tel: links.
 * Strictly permits optional leading '+' followed by 7-15 decimal digits.
 */
function sanitizePhoneNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(/[\s\-().]/g, '');
  if (/^\+?[0-9]{7,15}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

export function ListingActionPanel({
  listing,
  locale = 'ar',
  className,
}: ListingActionPanelProps) {
  const isArabic = locale === 'ar';
  const isSold = listing.status === 'SOLD';

  const [isCopied, setIsCopied] = React.useState(false);
  const [isPhoneRevealed, setIsPhoneRevealed] = React.useState(false);

  const phone = sanitizePhoneNumber(listing.contactPhone);
  const whatsappUrl = formatWhatsAppUrl(listing.whatsappPhone ?? listing.contactPhone, {
    title: listing.title,
    year: listing.year,
    refCode: listing.publicId,
    slug: listing.slug,
    publicId: listing.publicId,
    locale,
  });

  const formattedPrice = formatMoneyFromCents(listing.priceCents, listing.currency, locale);

  React.useEffect(() => {
    trackAnalytics({ name: 'listing_view', listingId: listing.publicId });
  }, [listing.publicId]);

  const recordContactIntent = (channel: 'CALL_REVEAL' | 'WHATSAPP') => {
    try {
      trackAnalytics({
        name: 'listing_contact',
        listingId: listing.publicId,
        channel: channel === 'CALL_REVEAL' ? 'phone' : 'whatsapp',
        outcome: 'initiated',
      });
      void createContactLead(
        {
          listingPublicId: listing.publicId,
          channel,
          buyerPhone: null,
          buyerName: null,
          note: null,
          meta: { source: 'listing_action_panel' },
        },
        crypto.randomUUID(),
      ).then((res) => {
        if (res.ok) {
          trackAnalytics({
            name: 'lead_outcome',
            operation: 'contact',
            channel: channel === 'CALL_REVEAL' ? 'phone' : 'whatsapp',
            outcome: 'succeeded',
          });
        } else {
          trackAnalytics({
            name: 'lead_outcome',
            operation: 'contact',
            channel: channel === 'CALL_REVEAL' ? 'phone' : 'whatsapp',
            outcome: 'failed',
            code: res.error.code,
          });
        }
      }).catch(() => {
        trackAnalytics({
          name: 'lead_outcome',
          operation: 'contact',
          channel: channel === 'CALL_REVEAL' ? 'phone' : 'whatsapp',
          outcome: 'failed',
          code: 'NETWORK_ERROR',
        });
      });
    } catch {
      // Non-blocking
    }
  };

  const revealPhone = () => {
    if (isPhoneRevealed) return;
    setIsPhoneRevealed(true);
    recordContactIntent('CALL_REVEAL');
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: listing.title,
          url,
        });
        return;
      } catch {
        // Fall back to clipboard copy if navigator.share was aborted or rejected
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      } catch {
        // Clipboard write failed or denied
      }
    }
  };

  return (
    <>
      {/* Desktop View: the page owns stickiness for the combined action/seller rail. */}
      <div
        className={cn(
          'hidden lg:flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-xs',
          className
        )}
        data-testid="listing-action-panel-desktop"
      >
        <div className="flex items-start justify-between gap-3 pb-4 border-b">
          <div>
            <span className="text-xs text-muted-foreground block mb-0.5">
              {isArabic ? 'السعر المطلوب' : 'Asking Price'}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-primary">
                {formattedPrice}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {listing.isNegotiable
                  ? (isArabic ? 'قابل للتفاوض' : 'Negotiable')
                  : (isArabic ? 'نهائي' : 'Fixed')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleShare}
              aria-label={isArabic ? 'مشاركة الإعلان' : 'Share listing'}
              className="h-9 w-9 rounded-lg"
            >
              {isCopied ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
            </Button>

            <FavoriteButton
              listingId={listing.publicId}
              slug={listing.slug}
              initialFavorited={listing.isFavorited}
              locale={locale}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {/* Privacy-conscious phone reveal */}
          {phone && !isSold ? (
            isPhoneRevealed ? (
              <Button asChild variant="default" size="lg" className="w-full gap-2 font-bold shadow-xs">
                <a
                  href={`tel:${phone}`}
                  aria-label={isArabic ? `الاتصال بالبائع على ${phone}` : `Call seller at ${phone}`}
                  data-testid="desktop-call-button"
                >
                  <Phone className="h-4 w-4 shrink-0" />
                  <span dir="ltr">{phone}</span>
                </a>
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                size="lg"
                onClick={revealPhone}
                className="w-full gap-2 font-bold shadow-xs"
                data-testid="desktop-phone-reveal-button"
              >
                <Phone className="h-4 w-4 shrink-0" />
                <span>{isArabic ? 'إظهار رقم الهاتف' : 'Show phone number'}</span>
              </Button>
            )
          ) : null}

          {/* WhatsApp Button */}
          {whatsappUrl && !isSold ? (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full font-bold border-green-600/30 text-green-700 dark:text-green-400 hover:bg-green-500/10 hover:border-green-600 gap-2"
            >
              <a
                href={whatsappUrl}
                onClick={() => recordContactIntent('WHATSAPP')}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={isArabic ? 'محادثة عبر واتساب' : 'Chat on WhatsApp'}
                data-testid="desktop-whatsapp-button"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span>{isArabic ? 'مراسلة عبر واتساب' : 'WhatsApp'}</span>
              </a>
            </Button>
          ) : null}

          {/* Value-added Partner Services */}
          {!isSold ? (
            <div className="space-y-2 pt-2 border-t">
              <FinanceLeadDialog
                listingPublicId={listing.publicId}
                vehicleTitle={listing.title}
                vehiclePriceCents={listing.priceCents}
                vehicleYear={listing.year}
                currency={listing.currency}
                locale={locale}
              />
              <InsuranceLeadDialog
                listingPublicId={listing.publicId}
                vehicleTitle={listing.title}
                vehiclePriceCents={listing.priceCents}
                vehicleYear={listing.year}
                locale={locale}
              />
            </div>
          ) : null}

          <ReportListingDialog listingPublicId={listing.publicId} locale={locale} />

          {isSold ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-center text-sm font-semibold text-destructive">
              {isArabic ? 'المركبة مباعة' : 'Vehicle Sold'}
            </div>
          ) : null}

          {isCopied ? (
            <p className="text-center text-xs text-primary font-medium">
              {isArabic ? 'تم نسخ الرابط بنجاح!' : 'Link copied to clipboard!'}
            </p>
          ) : null}
        </div>
      </div>

      {/* Mobile Sticky Bar: fixed bottom bar for viewports < 1024px */}
      <div
        className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex items-center justify-between gap-2 border-t bg-background/95 p-3 shadow-lg backdrop-blur-md lg:hidden"
        role="region"
        aria-label={isArabic ? 'إجراءات الإعلان' : 'Listing actions'}
        data-testid="listing-action-panel-mobile"
      >
        <div className="min-w-0 flex-1">
          <span className="text-[11px] text-muted-foreground block truncate">
            {listing.isNegotiable
              ? (isArabic ? 'قابل للتفاوض' : 'Negotiable')
              : (isArabic ? 'سعر نهائي' : 'Fixed')}
          </span>
          <span className="text-lg sm:text-xl font-extrabold text-primary truncate block">
            {formattedPrice}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <FavoriteButton
            listingId={listing.publicId}
            slug={listing.slug}
            initialFavorited={listing.isFavorited}
            locale={locale}
          />

          {phone && !isSold ? (
            isPhoneRevealed ? (
              <Button asChild size="sm" variant="default" className="gap-1 px-3 font-semibold">
                <a href={`tel:${phone}`} aria-label={isArabic ? `اتصال على ${phone}` : `Call ${phone}`} data-testid="mobile-call-button">
                  <Phone className="h-4 w-4" />
                  <span dir="ltr" className="hidden min-[430px]:inline">{phone}</span>
                </a>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={revealPhone}
                className="gap-1 px-3 font-semibold"
                data-testid="mobile-phone-reveal-button"
              >
                <Phone className="h-4 w-4" />
                <span>{isArabic ? 'عرض الرقم' : 'Show phone'}</span>
              </Button>
            )
          ) : null}

          {whatsappUrl && !isSold ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="font-semibold border-green-600/40 text-green-700 dark:text-green-400 gap-1 px-3"
            >
              <a
                href={whatsappUrl}
                onClick={() => recordContactIntent('WHATSAPP')}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={isArabic ? 'واتساب' : 'WhatsApp'}
                data-testid="mobile-whatsapp-button"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">{isArabic ? 'واتساب' : 'WhatsApp'}</span>
              </a>
            </Button>
          ) : null}

          {isSold ? (
            <span className="rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">
              {isArabic ? 'مباعة' : 'Sold'}
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}
