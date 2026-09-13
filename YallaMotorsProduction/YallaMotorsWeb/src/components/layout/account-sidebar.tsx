import { BarChart3, Bell, CarFront, Heart, MessageSquareText, Search, UserRound } from 'lucide-react';
import { Link } from '@/i18n/routing';
import type { AppLocale } from '@/i18n/config';

export function AccountSidebar({ locale }: { locale: AppLocale }) {
  const ar = locale === 'ar';
  const links = [
    ['/profile', ar ? 'الملف الشخصي' : 'Profile', UserRound], ['/favorites', ar ? 'المفضلة' : 'Favorites', Heart],
    ['/saved-searches', ar ? 'البحث المحفوظ' : 'Saved searches', Search], ['/notifications', ar ? 'الإشعارات' : 'Notifications', Bell],
    ['/me/listings', ar ? 'إعلاناتي' : 'My listings', CarFront], ['/me/leads', ar ? 'طلبات التواصل' : 'Buyer inquiries', MessageSquareText],
    ['/me/dashboard', ar ? 'لوحة التحكم' : 'Dashboard', BarChart3],
  ] as const;
  return <aside aria-label={ar ? 'التنقل في الحساب' : 'Account navigation sidebar'} className="hidden w-64 shrink-0 lg:block"><nav aria-label={ar ? 'قائمة الحساب' : 'Account navigation'} className="sticky top-24 space-y-1 rounded-xl border bg-card p-3">{links.map(([href, label, Icon]) => <Link key={href} prefetch={false} href={href} locale={locale} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><Icon className="h-5 w-5" aria-hidden />{label}</Link>)}</nav></aside>;
}
