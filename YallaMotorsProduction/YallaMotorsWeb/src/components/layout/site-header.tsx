import Image from 'next/image';
import { Link } from '@/i18n/routing';
import type { AppLocale } from '@/i18n/config';
import { DesktopNav } from './desktop-nav';
import { HeaderActions } from './header-actions';

export function SiteHeader({ locale }: { locale: AppLocale }) {
  const ar = locale === 'ar';

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-card shadow-xs backdrop-blur-xl">
      <div className="mx-auto flex min-h-[5rem] max-w-7xl flex-wrap items-center gap-3 px-4 py-2 sm:px-6 lg:flex-nowrap lg:px-8">
        <Link
          href="/"
          locale={locale}
          className="group flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={ar ? 'عربيات مارت - الرئيسية' : 'Arabiyatmart home'}
        >
          <span className="relative h-12 w-[4.75rem] overflow-hidden" aria-hidden="true">
            <Image
              src="/images/arabiyatmart-logo.webp"
              alt=""
              fill
              priority
              unoptimized
              sizes="76px"
              className="object-contain transition-transform duration-200 group-hover:scale-105"
            />
          </span>
          <span className="hidden text-lg font-black tracking-tight text-primary xl:inline">{ar ? 'عربيات مارت' : 'Arabiyatmart'}</span>
        </Link>
        <div className="hidden min-w-0 flex-1 overflow-x-auto py-1 sm:block">
          <DesktopNav locale={locale} />
        </div>
        <HeaderActions locale={locale} />
      </div>
    </header>
  );
}
