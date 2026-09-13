'use client';

import { useState, useTransition, useCallback } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import type { AppLocale } from '@/i18n/config';
import { cn } from '@/lib/utils';
import { useNavigationProgress } from './navigation-progress';

const labels = {
  ar: { home: 'الرئيسية', search: 'بحث السيارات', catalogue: 'دليل السيارات', dealers: 'المعارض', news: 'أخبار السيارات', sell: 'بيع سيارتك' },
  en: { home: 'Home', search: 'Search cars', catalogue: 'Car guide', dealers: 'Dealers', news: 'Car news', sell: 'Sell your car' },
};

export function DesktopNav({ locale }: { locale: AppLocale }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = labels[locale];
  
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  
  const navProgress = useNavigationProgress();

  const handleNavigation = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setPendingHref(href);
    if (navProgress?.startProgress) {
      navProgress.startProgress();
    }
    startTransition(() => {
      router.push(href, { locale });
    });
  }, [router, navProgress, locale]);

  const links = [
    ['/', t.home],
    ['/search', t.search],
    ['/catalogue/makes', t.catalogue],
    ['/dealers', t.dealers],
    ['/news', t.news],
    ['/sell', t.sell],
  ] as const;

  return (
    <nav aria-label={locale === 'ar' ? 'التنقل الرئيسي' : 'Primary navigation'} className="hidden min-w-max items-center gap-1 sm:flex">
      {links.map(([href, label]) => {
        const routeRoot = href === '/catalogue/makes' ? '/catalogue' : href;
        const isOptimisticActive = isPending && pendingHref === href;
        const active = isOptimisticActive || (href === '/' ? pathname === '/' : pathname.startsWith(routeRoot));

        return (
          <Link
            key={href}
            prefetch={href !== '/sell'}
            href={href}
            locale={locale}
            onClick={(e) => handleNavigation(e, href)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative rounded-lg px-3 py-2 text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              href === '/sell' ? 'bg-primary text-primary-foreground hover:bg-primary-dark' : active
                ? 'text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
