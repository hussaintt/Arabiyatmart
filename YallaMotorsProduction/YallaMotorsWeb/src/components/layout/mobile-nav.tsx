'use client';

import { useState, useTransition, useCallback } from 'react';
import { Heart, Home, Plus, Search, UserRound } from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import type { AppLocale } from '@/i18n/config';
import { cn } from '@/lib/utils';
import { useNavigationProgress } from './navigation-progress';

export function MobileNav({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const navProgress = useNavigationProgress();

  const handleNavigation = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setPendingHref(href);
    navProgress.startProgress();
    startTransition(() => {
      router.push(href, { locale });
    });
  }, [router, navProgress, locale]);

  const labels = locale === 'ar' ? ['الرئيسية', 'بحث', 'بيع', 'المفضلة', 'حسابي'] : ['Home', 'Search', 'Sell', 'Favorites', 'Account'];
  const links = [
    { href: '/', icon: Home, primary: false },
    { href: '/search', icon: Search, primary: false },
    { href: '/sell', icon: Plus, primary: true },
    { href: '/favorites', icon: Heart, primary: false },
    { href: '/profile', icon: UserRound, primary: false },
  ] as const;

  return (
    <nav
      aria-label={locale === 'ar' ? 'التنقل على الهاتف' : 'Mobile navigation'}
      className="fixed inset-x-2 bottom-2 z-40 grid grid-cols-5 rounded-[1.75rem] border border-white/80 bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-top backdrop-blur-xl sm:hidden"
    >
      {links.map(({ href, icon: Icon, ...item }, index) => {
        const isOptimisticActive = isPending && pendingHref === href;
        const active = isOptimisticActive || (href === '/' ? pathname === '/' : pathname.startsWith(href));
        return (
          <Link
            key={href}
            prefetch={href === '/' || href === '/search'}
            href={href}
            locale={locale}
            onClick={(e) => handleNavigation(e, href)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-bold text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:text-primary',
              item.primary && 'relative text-primary',
            )}
          >
            <span className={cn('flex items-center justify-center', item.primary && '-mt-7 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-brand')}>
              <Icon aria-hidden className={cn('h-5 w-5', item.primary && 'h-7 w-7')} />
            </span>
            <span>{labels[index]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
