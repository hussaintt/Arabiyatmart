import Image from 'next/image';
import { Link } from '@/i18n/routing';
import type { AppLocale } from '@/i18n/config';

export function SiteFooter({ locale }: { locale: AppLocale }) {
  const ar = locale === 'ar';
  const year = new Date().getFullYear();
  const linkClass = 'text-sm text-muted-foreground transition-colors hover:text-primary';

  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <Image src="/images/arabiyatmart-logo.webp" alt={ar ? 'شعار عربيات مارت' : 'Arabiyatmart logo'} width={68} height={44} unoptimized className="h-11 w-[4.25rem] object-contain" />
            <p className="text-xl font-black text-primary">{ar ? 'عربيات مارت' : 'Arabiyatmart'}</p>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-7 text-muted-foreground">
            {ar ? 'سوق السيارات الموثوق في مصر لشراء وبيع السيارات الجديدة والمستعملة.' : 'Egypt’s trusted marketplace for buying and selling new and used cars.'}
          </p>
        </div>

        <nav aria-label={ar ? 'روابط السوق' : 'Marketplace links'} className="flex flex-col gap-3">
          <p className="text-sm font-black text-foreground">{ar ? 'السوق' : 'Marketplace'}</p>
          <Link className={linkClass} href="/search" locale={locale}>{ar ? 'بحث السيارات' : 'Search cars'}</Link>
          <Link className={linkClass} href="/catalogue/makes" locale={locale}>{ar ? 'دليل السيارات' : 'Car guide'}</Link>
          <Link className={linkClass} href="/dealers" locale={locale}>{ar ? 'المعارض' : 'Dealers'}</Link>
          <Link className={linkClass} href="/news" locale={locale}>{ar ? 'أخبار السيارات' : 'Car news'}</Link>
        </nav>

        <nav aria-label={ar ? 'روابط الحساب' : 'Account links'} className="flex flex-col gap-3">
          <p className="text-sm font-black text-foreground">{ar ? 'حسابك' : 'Your account'}</p>
          <Link className={linkClass} prefetch={false} href="/sell" locale={locale}>{ar ? 'بيع سيارتك' : 'Sell your car'}</Link>
          <Link className={linkClass} prefetch={false} href="/profile" locale={locale}>{ar ? 'حسابي' : 'My account'}</Link>
          <Link className={linkClass} prefetch={false} href="/favorites" locale={locale}>{ar ? 'المفضلة' : 'Favorites'}</Link>
        </nav>

        <nav aria-label={ar ? 'الروابط القانونية' : 'Legal links'} className="flex flex-col gap-3">
          <p className="text-sm font-black text-foreground">{ar ? 'معلومات قانونية' : 'Legal'}</p>
          <Link className={linkClass} href="/privacy" locale={locale}>{ar ? 'سياسة الخصوصية' : 'Privacy policy'}</Link>
          <Link className={linkClass} href="/terms" locale={locale}>{ar ? 'الشروط والأحكام' : 'Terms and conditions'}</Link>
          <p className="pt-2 text-xs text-muted-foreground">© {year} Arabiyatmart</p>
        </nav>
      </div>
    </footer>
  );
}
