'use client';

import * as React from 'react';
import { Heart } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSession } from '@/providers/session-provider';
import { addFavorite, removeFavorite } from '@/server/actions/favorites';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppLocale } from '@/i18n/config';
import { trackAnalytics } from '@/lib/analytics/client';

export interface FavoriteButtonProps {
  listingId: string;
  slug?: string | undefined;
  initialFavorited?: boolean | undefined;
  className?: string | undefined;
  size?: ('default' | 'sm' | 'icon') | undefined;
  variant?: ('ghost' | 'secondary' | 'outline' | 'default') | undefined;
  locale?: AppLocale | undefined;
  onToggle?: ((favorited: boolean) => void) | undefined;
  onOptimisticToggle?: ((favorited: boolean) => void) | undefined;
  onRollback?: ((favorited: boolean) => void) | undefined;
}

export function FavoriteButton({
  listingId,
  slug,
  initialFavorited = false,
  className,
  size = 'icon',
  variant = 'outline',
  locale = 'ar',
  onToggle,
  onOptimisticToggle,
  onRollback,
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = React.useState<boolean>(initialFavorited);
  const [isPending, setIsPending] = React.useState<boolean>(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const { session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // Sync state if initialFavorited prop changes externally
  React.useEffect(() => {
    setIsFavorited(initialFavorited);
  }, [initialFavorited]);

  const isArabic = locale === 'ar';
  const label = isFavorited
    ? (isArabic ? 'إزالة من المفضلة' : 'Remove from favorites')
    : (isArabic ? 'إضافة إلى المفضلة' : 'Add to favorites');

  const handleToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    // 1. If anonymous, redirect to login with safe returnTo
    if (status === 'anonymous' || !session) {
      const returnTarget = pathname || '/';
      router.push(`/login?returnTo=${encodeURIComponent(returnTarget)}`);
      return;
    }

    if (isPending) return;

    // 2. Optimistic toggle
    const previous = isFavorited;
    const next = !previous;
    setIsFavorited(next);
    onOptimisticToggle?.(next);
    setIsPending(true);
    setErrorMessage(null);

    try {
      const action = next ? addFavorite : removeFavorite;
      const result = await action({ publicId: listingId });

      if (!result.ok) {
        // Rollback on server error
        setIsFavorited(previous);
        onRollback?.(previous);
        setErrorMessage(result.error.message || (isArabic ? 'حدث خطأ أثناء تحديث المفضلة' : 'Failed to update favorite'));
        trackAnalytics({ name: 'listing_favorite', listingId, action: next ? 'add' : 'remove', outcome: 'failed' });
        return;
      }

      // Reconcile server truth and fire callback
      setIsFavorited(result.data.favorited);
      onToggle?.(result.data.favorited);
      trackAnalytics({ name: 'listing_favorite', listingId, action: result.data.favorited ? 'add' : 'remove', outcome: 'succeeded' });

      // Private query invalidations
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['me', 'favorites'] }),
        queryClient.invalidateQueries({ queryKey: ['me', 'session-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['listing', listingId] }),
        ...(slug ? [queryClient.invalidateQueries({ queryKey: ['listing', slug] })] : []),
      ]);
    } catch {
      // Rollback on network/unexpected error
      setIsFavorited(previous);
      onRollback?.(previous);
      setErrorMessage(isArabic ? 'تعذر الاتصال بالخادم' : 'Could not reach the server');
      trackAnalytics({ name: 'listing_favorite', listingId, action: next ? 'add' : 'remove', outcome: 'failed' });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleToggle}
      disabled={isPending}
      aria-pressed={isFavorited}
      aria-label={label}
      aria-busy={isPending}
      title={label}
      className={cn(
        'relative shrink-0 rounded-full transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary',
        'bg-card/95 shadow-sm backdrop-blur-sm',
        isFavorited
          ? 'border-primary/30 bg-primary-soft text-primary hover:bg-primary/15 hover:text-primary'
          : 'text-muted-foreground hover:border-primary/30 hover:bg-primary-soft hover:text-primary',
        className
      )}
    >
      <Heart
        className={cn(
          'h-5 w-5 transition-transform active:scale-90',
          isFavorited ? 'fill-current text-primary' : 'fill-none',
          isPending && 'animate-pulse'
        )}
      />
      {errorMessage ? (
        <span className="sr-only" role="alert">
          {errorMessage}
        </span>
      ) : null}
    </Button>
  );
}
