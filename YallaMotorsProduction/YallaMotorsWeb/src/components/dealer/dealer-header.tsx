import * as React from 'react';
import Image from 'next/image';
import { Building2, ShieldCheck, Car, MapPin, Star, Phone, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDigits } from '@/i18n/format';
import { cn } from '@/lib/utils';
import { isSafeContactUrl } from '@/lib/security/external-url';
import { formatWhatsAppUrl } from '@/lib/whatsapp/message';
import type { AppLocale } from '@/i18n/config';
import type { DealerProfile } from '@/types/dealer';

export interface DealerHeaderProps {
  dealer: DealerProfile;
  locale?: AppLocale | undefined;
  className?: string | undefined;
}

/**
 * Validates and sanitizes a phone number for tel: links.
 * Must be valid phone number digits (7-15 digits, optional +).
 */
function sanitizePhoneNumber(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(/[\s\-().]/g, '');
  if (/^\+?[0-9]{7,15}$/.test(cleaned)) {
    const telUrl = `tel:${cleaned}`;
    if (isSafeContactUrl(telUrl)) {
      return cleaned;
    }
  }
  return null;
}

export function DealerHeader({
  dealer,
  locale = 'ar',
  className,
}: DealerHeaderProps) {
  const isArabic = locale === 'ar';
  const displayName = isArabic ? dealer.displayName.ar : dealer.displayName.en;

  // Find primary phone from branches
  const primaryBranchWithPhone = dealer.branches.find((b) => b.phone && b.phone.trim().length > 0);
  const rawPhone = primaryBranchWithPhone?.phone ?? null;

  const validPhone = sanitizePhoneNumber(rawPhone);
  const validWhatsAppUrl = formatWhatsAppUrl(rawPhone);

  const formattedListingCount = formatDigits(dealer.activeListingCount, locale);
  const formattedBranchCount = formatDigits(dealer.branchCount || dealer.branches.length, locale);

  const storeTypeLabels: Record<string, { ar: string; en: string }> = {
    INDIVIDUAL: { ar: 'معرض فردي', en: 'Individual Dealer' },
    COMPANY: { ar: 'شركة سيارات', en: 'Dealership Company' },
    SUPPLIER: { ar: 'موزع معتمد', en: 'Official Supplier' },
  };
  const storeTypeLabel = storeTypeLabels[dealer.storeType] ?? { ar: dealer.storeType, en: dealer.storeType };

  return (
    <header
      className={cn('relative overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xs', className)}
      data-testid="dealer-header"
    >
      {/* Banner Section */}
      <div className="relative h-32 sm:h-44 md:h-56 w-full bg-linear-to-r from-muted to-muted/60">
        {dealer.bannerUrl ? (
          <Image
            src={dealer.bannerUrl}
            alt={displayName}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 1280px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-linear-to-r from-primary/10 via-primary/5 to-muted/50" />
        )}
      </div>

      {/* Profile Details Bar */}
      <div className="px-4 sm:px-6 md:px-8 pb-6 pt-0">
        <div className="relative -mt-12 sm:-mt-16 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pb-4 border-b">
          {/* Logo & Identity */}
          <div className="flex items-end gap-4 min-w-0">
            <div className="relative h-24 w-24 sm:h-28 sm:w-28 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-card shadow-md flex items-center justify-center">
              {dealer.logoUrl ? (
                <Image
                  src={dealer.logoUrl}
                  alt={displayName}
                  fill
                  priority
                  sizes="112px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
                  <Building2 className="h-12 w-12 opacity-70" />
                </div>
              )}
            </div>

            <div className="space-y-1 pb-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  dir="auto"
                  className="text-xl sm:text-2xl md:text-3xl font-extrabold text-foreground tracking-tight truncate"
                  data-testid="dealer-display-name"
                >
                  {displayName}
                </h1>

                {dealer.isVerified ? (
                  <Badge
                    variant="soft"
                    className="bg-primary/10 text-primary font-semibold text-xs shrink-0"
                    data-testid="dealer-verified-badge"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 me-1 inline-block" />
                    {isArabic ? 'معرض معتمد' : 'Verified'}
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  {isArabic ? storeTypeLabel.ar : storeTypeLabel.en}
                </span>

                {dealer.ratingAverage > 0 ? (
                  <div className="flex items-center gap-1 text-amber-500 font-semibold" data-testid="dealer-rating">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    <span>{dealer.ratingAverage.toFixed(1)}</span>
                    <span className="text-muted-foreground font-normal">
                      ({formatDigits(dealer.reviewCount, locale)})
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Quick Contact Buttons (Mobile stacks full-width, sm/desktop inline) */}
          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 sm:pt-0" data-testid="dealer-contact-actions">
            {validPhone ? (
              <Button asChild variant="outline" size="default" className="gap-2 font-semibold">
                <a href={`tel:${validPhone}`} aria-label={isArabic ? 'اتصال بالمعرض' : 'Call dealer'} data-testid="dealer-call-btn">
                  <Phone className="h-4 w-4 shrink-0 text-primary" />
                  <span>{isArabic ? 'اتصال' : 'Call'}</span>
                </a>
              </Button>
            ) : null}

            {validWhatsAppUrl ? (
              <Button asChild variant="default" size="default" className="gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                <a
                  href={validWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={isArabic ? 'محادثة عبر واتساب' : 'WhatsApp dealer'}
                  data-testid="dealer-whatsapp-btn"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  <span>{isArabic ? 'واتساب' : 'WhatsApp'}</span>
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        {/* Fact Stats Bar (Tablet 2-column, desktop 4-column) */}
        <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Car className="h-4 w-4" />
            </div>
            <div>
              <div className="font-bold text-foreground text-sm">{formattedListingCount}</div>
              <div className="text-muted-foreground">{isArabic ? 'سيارة متاحة' : 'Cars Available'}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <div className="font-bold text-foreground text-sm">{formattedBranchCount}</div>
              <div className="text-muted-foreground">{isArabic ? 'فروع ومعارض' : 'Branches'}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
