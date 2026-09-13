'use client';

import * as React from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X, Camera, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import type { ListingImage } from '@/types/listing';

export interface GalleryMediaItem {
  readonly id: string;
  readonly url: string;
  readonly thumbnailUrl?: string | null | undefined;
  readonly mediumUrl?: string | null | undefined;
  readonly largeUrl?: string | null | undefined;
  readonly isCover: boolean;
  readonly sortOrder: number;
  readonly alt: string;
}

export interface ListingGalleryProps {
  readonly listingPublicId: string;
  readonly images: readonly ListingImage[];
  readonly title: string;
  readonly locale?: AppLocale | undefined;
  readonly className?: string | undefined;
}

/**
 * Derives stable, deterministic media identities from intrinsic image properties
 * (sortOrder + URL) without relying on array indices.
 * Safely handles identical duplicates by tracking per-key occurrences.
 */
export function deriveMediaItems(
  images: readonly ListingImage[] | undefined,
  title: string
): readonly GalleryMediaItem[] {
  if (!images || images.length === 0) return [];

  // Deterministic sort: primarily by sortOrder, tie-broken by URL
  const sorted = [...images].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.url.localeCompare(b.url);
  });

  const occurrenceCounts = new Map<string, number>();

  return sorted.map((img) => {
    const baseKey = `${img.sortOrder}:${img.url}`;
    const occurrence = occurrenceCounts.get(baseKey) ?? 0;
    occurrenceCounts.set(baseKey, occurrence + 1);

    const id = occurrence === 0 ? baseKey : `${baseKey}:${occurrence}`;
    const alt = title ? `${title} (${img.sortOrder})` : img.url;

    return {
      id,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl,
      mediumUrl: img.mediumUrl,
      largeUrl: img.largeUrl,
      isCover: img.isCover,
      sortOrder: img.sortOrder,
      alt,
    };
  });
}

export function ListingGallery({
  images,
  title,
  locale = 'ar',
  className,
}: ListingGalleryProps) {
  const isArabic = locale === 'ar';

  const mediaItems = React.useMemo(() => {
    return deriveMediaItems(images, title);
  }, [images, title]);

  const [activeMediaId, setActiveMediaId] = React.useState<string>(
    () => mediaItems[0]?.id ?? ''
  );
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false);
  const [failedMediaIds, setFailedMediaIds] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );

  const touchStartXRef = React.useRef<number | null>(null);
  const lightboxRef = React.useRef<HTMLDivElement>(null);
  const triggerElementRef = React.useRef<HTMLElement | null>(null);
  const thumbnailRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const lightboxThumbRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  // Auto-scroll active thumbnail into view in both main gallery and lightbox
  React.useEffect(() => {
    if (activeMediaId) {
      const btn = thumbnailRefs.current.get(activeMediaId);
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeMediaId]);

  React.useEffect(() => {
    if (isLightboxOpen && activeMediaId) {
      const btn = lightboxThumbRefs.current.get(activeMediaId);
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [isLightboxOpen, activeMediaId]);

  // Keep active media valid if mediaItems change
  React.useEffect(() => {
    if (mediaItems.length > 0 && !mediaItems.some((item) => item.id === activeMediaId)) {
      setActiveMediaId(mediaItems[0]!.id);
    }
  }, [mediaItems, activeMediaId]);

  const activeIndex = React.useMemo(() => {
    const idx = mediaItems.findIndex((item) => item.id === activeMediaId);
    return idx >= 0 ? idx : 0;
  }, [mediaItems, activeMediaId]);

  const handleImageError = React.useCallback((id: string) => {
    setFailedMediaIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const navigatePrev = React.useCallback(() => {
    if (mediaItems.length <= 1) return;
    const nextIdx = (activeIndex - 1 + mediaItems.length) % mediaItems.length;
    setActiveMediaId(mediaItems[nextIdx]!.id);
  }, [activeIndex, mediaItems]);

  const navigateNext = React.useCallback(() => {
    if (mediaItems.length <= 1) return;
    const nextIdx = (activeIndex + 1) % mediaItems.length;
    setActiveMediaId(mediaItems[nextIdx]!.id);
  }, [activeIndex, mediaItems]);

  const openLightbox = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    triggerElementRef.current = event.currentTarget;
    setIsLightboxOpen(true);
  }, []);

  const closeLightbox = React.useCallback(() => {
    setIsLightboxOpen(false);
    setTimeout(() => {
      triggerElementRef.current?.focus();
    }, 0);
  }, []);

  // Keyboard navigation and focus trap inside lightbox
  React.useEffect(() => {
    if (!isLightboxOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLightbox();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        // In Arabic (RTL), ArrowRight goes to previous image, ArrowLeft goes to next
        if (isArabic) {
          navigatePrev();
        } else {
          navigateNext();
        }
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (isArabic) {
          navigateNext();
        } else {
          navigatePrev();
        }
        return;
      }

      // Focus trap
      if (event.key === 'Tab') {
        const container = lightboxRef.current;
        if (!container) return;

        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusables.length === 0) return;

        const firstEl = focusables[0]!;
        const lastEl = focusables[focusables.length - 1]!;

        if (event.shiftKey) {
          if (document.activeElement === firstEl) {
            event.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            event.preventDefault();
            firstEl.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, isArabic, navigateNext, navigatePrev, closeLightbox]);

  // Touch swipe handling
  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const endX = event.changedTouches[0]?.clientX;
    if (endX === undefined) return;
    const deltaX = endX - touchStartXRef.current;
    touchStartXRef.current = null;

    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // Swiped right: in RTL that's next, in LTR that's prev
        if (isArabic) {
          navigateNext();
        } else {
          navigatePrev();
        }
      } else {
        // Swiped left: in RTL that's prev, in LTR that's next
        if (isArabic) {
          navigatePrev();
        } else {
          navigateNext();
        }
      }
    }
  };

  if (mediaItems.length === 0) {
    return (
      <div
        className={cn(
          'relative aspect-[16/10] w-full rounded-2xl border bg-muted/50 flex flex-col items-center justify-center gap-3 text-muted-foreground',
          className
        )}
        data-testid="listing-gallery-empty"
      >
        <Car className="h-16 w-16 opacity-30" />
        <p className="text-sm font-medium">
          {isArabic ? 'لا توجد صور متوفرة لهذه السيارة' : 'No images available for this vehicle'}
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label={isArabic ? 'معرض صور السيارة' : 'Vehicle photo gallery'}
      className={cn('space-y-3', className)}
      data-testid="listing-gallery"
    >
      {/* Primary Hero Image with Reserved Aspect Ratio */}
      <div
        className="group relative aspect-[16/10] w-full overflow-hidden rounded-2xl border bg-muted shadow-sm"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {mediaItems.map((item, index) => {
          const isActive = item.id === activeMediaId;
          const isFailed = failedMediaIds.has(item.id);
          const isEager = index === 0 || item.isCover || Math.abs(index - activeIndex) <= 2;
          const heroSrc = item.largeUrl || item.mediumUrl || item.url;

          if (isFailed) {
            if (!isActive) return null;
            return (
              <div
                key={item.id}
                className="absolute inset-0 z-10 flex h-full w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground"
              >
                <Car className="h-12 w-12 opacity-30" />
                <span className="text-sm">
                  {isArabic ? 'تعذر تحميل الصورة' : 'Failed to load image'}
                </span>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className={cn(
                'absolute inset-0 transition-opacity duration-300 ease-in-out',
                isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
              )}
              aria-hidden={!isActive}
            >
              <Image
                src={heroSrc}
                alt={item.alt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 1200px"
                priority={index === 0 || item.isCover}
                loading={isEager ? 'eager' : 'lazy'}
                onError={() => handleImageError(item.id)}
                className="object-cover cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
                onClick={openLightbox}
              />
            </div>
          );
        })}

        {/* Hero Prev / Next Arrows (when more than 1 image) */}
        {mediaItems.length > 1 ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                if (isArabic) {
                  navigateNext();
                } else {
                  navigatePrev();
                }
              }}
              aria-label={isArabic ? 'الصورة السابقة' : 'Previous photo'}
              className="absolute start-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/75 hover:text-white backdrop-blur-xs border border-white/10 shadow-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200"
            >
              {isArabic ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                if (isArabic) {
                  navigatePrev();
                } else {
                  navigateNext();
                }
              }}
              aria-label={isArabic ? 'الصورة التالية' : 'Next photo'}
              className="absolute end-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/75 hover:text-white backdrop-blur-xs border border-white/10 shadow-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200"
            >
              {isArabic ? (
                <ChevronLeft className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </Button>
          </>
        ) : null}

        {/* View all photos action overlay */}
        <div className="absolute bottom-3 end-3 z-20">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={openLightbox}
            className="bg-black/70 text-white hover:bg-black/90 backdrop-blur-xs font-medium text-xs sm:text-sm shadow-md flex items-center gap-1.5"
            aria-label={
              isArabic
                ? `عرض كافة الصور، ${mediaItems.length} صور متوفرة`
                : `View all photos, ${mediaItems.length} photos available`
            }
          >
            <Camera className="h-4 w-4" />
            <span>
              {isArabic ? 'عرض كافة الصور' : 'View all photos'} ({mediaItems.length})
            </span>
          </Button>
        </div>

        {/* Current index indicator */}
        <div className="absolute top-3 start-3 z-20 pointer-events-none">
          <span
            data-testid="gallery-index-indicator"
            className="inline-flex items-center rounded-md bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-xs shadow-xs"
          >
            {activeIndex + 1} / {mediaItems.length}
          </span>
        </div>
      </div>

      {/* Thumbnails Rail with Reserved Aspect Ratio */}
      {mediaItems.length > 1 ? (
        <div
          role="region"
          aria-label={isArabic ? 'الصور المصغرة' : 'Thumbnail list'}
          className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin focus-visible:outline-hidden"
        >
          {mediaItems.map((item) => {
            const isSelected = item.id === activeMediaId;
            const isFailed = failedMediaIds.has(item.id);

            return (
              <button
                key={item.id}
                ref={(el) => {
                  if (el) {
                    thumbnailRefs.current.set(item.id, el);
                  } else {
                    thumbnailRefs.current.delete(item.id);
                  }
                }}
                type="button"
                aria-label={item.alt}
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => setActiveMediaId(item.id)}
                className={cn(
                  'relative aspect-[16/10] w-20 sm:w-24 shrink-0 overflow-hidden rounded-lg border bg-muted transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden',
                  isSelected
                    ? 'ring-2 ring-primary border-primary opacity-100 shadow-xs'
                    : 'opacity-70 hover:opacity-100 border-border'
                )}
              >
                {!isFailed ? (
                  <Image
                    src={item.thumbnailUrl || item.mediumUrl || item.url}
                    alt={item.alt}
                    fill
                    sizes="96px"
                    onError={() => handleImageError(item.id)}
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                    <Car className="h-4 w-4 opacity-40" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Lightbox Dialog */}
      {isLightboxOpen ? (
        <div
          ref={lightboxRef}
          role="dialog"
          aria-modal="true"
          aria-label={isArabic ? 'معرض صور السيارة مكبر' : 'Vehicle photo gallery enlarged'}
          className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white backdrop-blur-sm select-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          data-testid="listing-gallery-lightbox"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
            <span
              data-testid="gallery-counter"
              className="text-sm font-medium tracking-wide text-white/90"
            >
              {activeIndex + 1} / {mediaItems.length}
            </span>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={closeLightbox}
              aria-label={isArabic ? 'إغلاق المعرض' : 'Close gallery'}
              className="text-white hover:bg-white/10 hover:text-white rounded-full h-10 w-10"
              autoFocus
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          {/* Main Stage */}
          <div className="relative flex flex-1 items-center justify-center p-4 overflow-hidden">
            <div className="relative aspect-[16/10] w-full max-w-5xl max-h-[75vh]">
              {mediaItems.map((item, index) => {
                const isActive = item.id === activeMediaId;
                const isFailed = failedMediaIds.has(item.id);
                const isEager = isActive || Math.abs(index - activeIndex) <= 1;
                const lightboxSrc = item.largeUrl || item.mediumUrl || item.url;

                if (isFailed) {
                  if (!isActive) return null;
                  return (
                    <div
                      key={`lightbox-${item.id}`}
                      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-white/60"
                    >
                      <Car className="h-16 w-16 opacity-30" />
                      <p className="text-sm">
                        {isArabic ? 'تعذر تحميل هذه الصورة' : 'Unable to display this image'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div
                    key={`lightbox-${item.id}`}
                    className={cn(
                      'absolute inset-0 transition-opacity duration-300 ease-in-out',
                      isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    )}
                    aria-hidden={!isActive}
                  >
                    <Image
                      src={lightboxSrc}
                      alt={item.alt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 1200px"
                      priority={isActive}
                      loading={isEager ? 'eager' : 'lazy'}
                      className="object-contain"
                      onError={() => handleImageError(item.id)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Prev / Next Arrows */}
            {mediaItems.length > 1 ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={isArabic ? navigateNext : navigatePrev}
                  aria-label={isArabic ? 'الصورة السابقة' : 'Previous photo'}
                  className="absolute start-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/80 hover:text-white backdrop-blur-xs border border-white/10 shadow-lg"
                >
                  {isArabic ? (
                    <ChevronRight className="h-7 w-7" />
                  ) : (
                    <ChevronLeft className="h-7 w-7" />
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={isArabic ? navigatePrev : navigateNext}
                  aria-label={isArabic ? 'الصورة التالية' : 'Next photo'}
                  className="absolute end-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/50 text-white hover:bg-black/80 hover:text-white backdrop-blur-xs border border-white/10 shadow-lg"
                >
                  {isArabic ? (
                    <ChevronLeft className="h-7 w-7" />
                  ) : (
                    <ChevronRight className="h-7 w-7" />
                  )}
                </Button>
              </>
            ) : null}
          </div>

          {/* Bottom Thumbnails Strip in Lightbox */}
          {mediaItems.length > 1 ? (
            <div className="px-4 py-3 border-t border-white/10 bg-black/40 flex justify-center gap-2 overflow-x-auto scrollbar-thin">
              {mediaItems.map((item) => {
                const isSelected = item.id === activeMediaId;
                return (
                  <button
                    key={`lightbox-thumb-${item.id}`}
                    ref={(el) => {
                      if (el) {
                        lightboxThumbRefs.current.set(item.id, el);
                      } else {
                        lightboxThumbRefs.current.delete(item.id);
                      }
                    }}
                    type="button"
                    aria-label={item.alt}
                    aria-current={isSelected ? 'true' : undefined}
                    onClick={() => setActiveMediaId(item.id)}
                    className={cn(
                      'relative aspect-[16/10] w-14 sm:w-16 shrink-0 overflow-hidden rounded-md border transition-all',
                      isSelected
                        ? 'border-primary ring-2 ring-primary opacity-100'
                        : 'border-transparent opacity-50 hover:opacity-80'
                    )}
                  >
                    <Image
                      src={item.thumbnailUrl || item.mediumUrl || item.url}
                      alt={item.alt}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
