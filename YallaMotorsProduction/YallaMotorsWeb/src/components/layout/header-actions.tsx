'use client';

import { Bell, Heart, LogIn, UserRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@/i18n/routing';
import { CountResponseSchema } from '@/lib/api/schemas/common';
import { browserApiRequest } from '@/lib/api/browser';
import { queryKeys } from '@/lib/query/keys';
import { useSession } from '@/providers/session-provider';
import { LocaleSwitcher } from './locale-switcher';
import type { AppLocale } from '@/i18n/config';

export function HeaderActions({ locale }: { locale: AppLocale }) {
  const { status } = useSession();
  const unread = useQuery({
    queryKey: queryKeys.notificationUnreadCount(),
    queryFn: () => browserApiRequest({ path: '/api/bff/notifications/unread-count', outputSchema: CountResponseSchema }),
    enabled: status === 'authenticated',
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const ar = locale === 'ar';
  return <div className="ms-auto flex shrink-0 items-center gap-1">
    <LocaleSwitcher locale={locale} />
    <Link prefetch={false} className="hidden rounded-md p-2 hover:bg-muted sm:inline-flex" href="/favorites" locale={locale} aria-label={ar ? 'المفضلة' : 'Favorites'}><Heart className="h-5 w-5" /></Link>
    <Link prefetch={false} className="relative rounded-md p-2 hover:bg-muted" href="/notifications" locale={locale} aria-label={ar ? 'الإشعارات' : 'Notifications'}><Bell className="h-5 w-5" />{unread.data?.count ? <span className="absolute -end-1 -top-1 min-w-5 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-5 text-destructive-foreground" aria-label={`${unread.data.count} ${ar ? 'إشعارات غير مقروءة' : 'unread notifications'}`}>{Math.min(unread.data.count, 99)}</span> : null}</Link>
    {status === 'authenticated' ? <details className="group relative"><summary className="flex cursor-pointer list-none rounded-md p-2 hover:bg-muted" aria-label={ar ? 'قائمة الحساب' : 'Account menu'}><UserRound className="h-5 w-5" /></summary><nav aria-label={ar ? 'خيارات الحساب' : 'Account options'} className="absolute end-0 top-full z-50 mt-2 min-w-44 space-y-1 rounded-lg border bg-popover p-2 shadow-lg"><Link prefetch={false} className="block rounded-md px-3 py-2 text-sm hover:bg-muted" href="/profile" locale={locale}>{ar ? 'الملف الشخصي' : 'Profile'}</Link><Link prefetch={false} className="block rounded-md px-3 py-2 text-sm hover:bg-muted" href="/me/listings" locale={locale}>{ar ? 'إعلاناتي' : 'My listings'}</Link></nav></details> : <Link prefetch={false} className="rounded-md p-2 hover:bg-muted" href="/login" locale={locale} aria-label={ar ? 'تسجيل الدخول' : 'Sign in'}>{status === 'loading' ? <UserRound className="h-5 w-5 opacity-50" /> : <LogIn className="h-5 w-5" />}</Link>}
  </div>;
}
