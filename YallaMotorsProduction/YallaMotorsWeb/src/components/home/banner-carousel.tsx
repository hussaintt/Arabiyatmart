'use client';

import * as React from 'react';
import Image from 'next/image';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HomeBanner } from '@/types/home';
import type { AppLocale } from '@/i18n/config';

export interface BannerCarouselProps {
  banners: HomeBanner[];
  locale?: AppLocale | undefined;
  className?: string | undefined;
}

export function BannerCarousel({
  banners,
  locale = 'ar',
  className,
}: BannerCarouselProps) {
  const isArabic = locale === 'ar';
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);

  const bannerCount = banners.length;

  // Reduced motion detection
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
    return undefined;
  }, []);

  // Automatic rotation: only if > 1 banner, not paused, and no reduced motion preference
  React.useEffect(() => {
    if (bannerCount <= 1 || isPaused || prefersReducedMotion) return undefined;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerCount);
    }, 6000);
    return () => clearInterval(interval);
  }, [bannerCount, isPaused, prefersReducedMotion]);

  if (!banners || banners.length === 0) {
    return null;
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % bannerCount);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + bannerCount) % bannerCount);
  };

  return (
    <section
      className={cn('relative w-full overflow-hidden rounded-2xl bg-muted', className)}
      role="region"
      aria-roledescription="carousel"
      aria-label={isArabic ? 'العروض الترويجية' : 'Promotional banners'}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      data-testid="banner-carousel"
    >
      {/* Slides container */}
      <div className="relative aspect-[21/9] min-h-[180px] sm:min-h-[240px] md:min-h-[300px] w-full overflow-hidden">
        {banners.map((banner, index) => {
          const title = isArabic ? banner.title.ar : banner.title.en;
          const subtitle = banner.subtitle
            ? isArabic
              ? banner.subtitle.ar
              : banner.subtitle.en
            : null;
          const isCurrent = index === currentIndex;

          const content = (
            <div
              key={banner.publicId}
              className={cn(
                'absolute inset-0 transition-opacity duration-500 flex flex-col justify-end p-6 sm:p-10 text-white',
                isCurrent ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'
              )}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} / ${bannerCount}: ${title}`}
              aria-hidden={!isCurrent}
            >
              {banner.imageUrl ? (
                <Image
                  src={banner.imageUrl}
                  alt={title}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 768px) 100vw, 1200px"
                  className="object-cover"
                />
              ) : null}

              {/* Dark gradient for text legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

              <div className="relative z-10 max-w-xl space-y-2">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black leading-tight drop-shadow-sm">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="text-sm sm:text-base text-white/90 drop-shadow-xs line-clamp-2">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>
          );

          if (banner.linkTarget) {
            return (
              <Link
                key={banner.publicId}
                href={banner.linkTarget}
                locale={locale}
                className="focus:outline-none"
                tabIndex={isCurrent ? 0 : -1}
              >
                {content}
              </Link>
            );
          }

          return content;
        })}
      </div>

      {/* Navigation arrows (only if > 1 banner) */}
      {bannerCount > 1 ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={handlePrev}
            aria-label={isArabic ? 'الشريحة السابقة' : 'Previous slide'}
            className="absolute start-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-xs border-0"
          >
            {isArabic ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={handleNext}
            aria-label={isArabic ? 'الشريحة التالية' : 'Next slide'}
            className="absolute end-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-xs border-0"
          >
            {isArabic ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </Button>

          {/* Dots Indicator */}
          <div className="absolute bottom-3 start-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                aria-label={`${isArabic ? 'انتقل إلى الشريحة' : 'Go to slide'} ${i + 1}`}
                aria-current={i === currentIndex ? 'true' : 'false'}
                className={cn(
                  'h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                  i === currentIndex ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
