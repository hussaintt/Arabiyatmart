import * as React from 'react';
import { Building2, MapPin, Phone, ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BusinessHours, type CurrentTimeOverride } from './business-hours';
import { isSafeContactUrl } from '@/lib/security/external-url';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { DealerBranch, DealerProfile } from '@/types/dealer';

export interface DealerAboutProps {
  dealer: DealerProfile;
  locale?: AppLocale | undefined;
  currentTime?: CurrentTimeOverride | undefined;
  className?: string | undefined;
}

/**
 * Validates and sanitizes branch phone for tel: links.
 */
function sanitizeBranchPhone(raw: string | null | undefined): string | null {
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

/**
 * Generates a validated Google Maps URL from lat/lng coordinates.
 */
function getMapUrl(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function DealerAbout({
  dealer,
  locale = 'ar',
  currentTime,
  className,
}: DealerAboutProps) {
  const isArabic = locale === 'ar';
  const description = dealer.description
    ? isArabic
      ? dealer.description.ar
      : dealer.description.en
    : null;

  return (
    <div className={cn('space-y-6 text-card-foreground', className)} data-testid="dealer-about">
      {/* About Description Card */}
      <section
        className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs space-y-3"
        aria-label={isArabic ? 'عن المعرض' : 'About dealership'}
      >
        <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-foreground">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <h2>{isArabic ? 'نبذة عن المعرض' : 'About Us'}</h2>
        </div>

        <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-prose" dir="auto">
          {description ? (
            <p className="whitespace-pre-line">{description}</p>
          ) : (
            <p className="italic text-muted-foreground/80">
              {isArabic ? 'لا توجد معلومات إضافية متوفرة حالياً عن هذا المعرض.' : 'No additional information currently available for this showroom.'}
            </p>
          )}
        </div>
      </section>

      {/* Branches & Locations */}
      <section
        className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs space-y-4"
        aria-label={isArabic ? 'الفروع وساعات العمل' : 'Branches & Hours'}
      >
        <div className="flex items-center justify-between gap-2 border-b pb-3">
          <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-foreground">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <h2>{isArabic ? 'فروع المعرض' : 'Showroom Branches'}</h2>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {dealer.branches.length}{' '}
            {isArabic ? 'فرع' : 'branch(es)'}
          </span>
        </div>

        <div className="space-y-4 divide-y divide-border/60">
          {dealer.branches.length > 0 ? (
            dealer.branches.map((branch: DealerBranch, index: number) => {
              const branchName = isArabic ? branch.name.ar : branch.name.en;
              const validPhone = sanitizeBranchPhone(branch.phone);
              const mapUrl = getMapUrl(branch.lat, branch.lng);

              return (
                <div
                  key={branch.publicId || index}
                  className="pt-4 first:pt-0 space-y-3"
                  data-testid={`dealer-branch-${branch.publicId || index}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-bold text-sm text-foreground truncate" dir="auto">
                        {branchName}
                      </h3>

                      {branch.addressLine ? (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          <span dir="auto">{branch.addressLine}</span>
                        </div>
                      ) : null}
                    </div>

                    {mapUrl ? (
                      <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs shrink-0 font-medium">
                        <a
                          href={mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={isArabic ? `عرض موقع فرع ${branchName} على الخريطة` : `View ${branchName} on map`}
                          data-testid="branch-map-link"
                        >
                          <ExternalLink className="h-3.5 w-3.5 me-1" />
                          <span>{isArabic ? 'الخريطة' : 'Map'}</span>
                        </a>
                      </Button>
                    ) : null}
                  </div>

                  {validPhone ? (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a
                        href={`tel:${validPhone}`}
                        className="font-medium text-primary hover:underline"
                        dir="ltr"
                        data-testid="branch-phone-link"
                      >
                        {validPhone}
                      </a>
                    </div>
                  ) : null}

                  {/* Business Hours */}
                  {branch.hours ? (
                    <BusinessHours
                      hours={branch.hours}
                      locale={locale}
                      currentTime={currentTime}
                      className="pt-1"
                    />
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="text-xs text-muted-foreground italic py-2">
              {isArabic ? 'لم يتم تسجيل فروع حتى الآن' : 'No branches registered yet'}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
