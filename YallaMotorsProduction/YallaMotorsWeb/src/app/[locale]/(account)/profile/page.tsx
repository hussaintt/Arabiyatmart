import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { LogOut, Settings2, ShieldCheck } from 'lucide-react';
import { isAppLocale } from '@/i18n/config';
import { serverEnv } from '@/lib/env/server';
import { extractReturnTo } from '@/lib/auth/return-to';
import { requireSession } from '@/lib/auth/guards';
import { getProfile } from '@/server/queries/profile';
import { logout } from '@/server/actions/auth';
import { ProfileSummary } from '@/components/profile/profile-summary';
import { PhoneVerificationPanel } from '@/components/profile/phone-verification-panel';
import { DeleteAccountDialog } from '@/components/profile/delete-account-dialog';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AppLocale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

interface ProfilePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  return {
    title: locale === 'ar' ? 'الملف الشخصي | عربيات مارت' : 'Profile | Arabiyat Mart',
    robots: { index: false, follow: false },
    alternates: { canonical: `${serverEnv.SITE_ORIGIN}/${locale}/profile` },
  };
}

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale: AppLocale = rawLocale;
  setRequestLocale(locale);
  await requireSession(`/${locale}/profile`, locale);
  const [{ data: profile }, query] = await Promise.all([getProfile(), searchParams]);
  const ar = locale === 'ar';
  const returnTo = extractReturnTo(query, locale, `/${locale}/profile`);
  const showPhonePanel = query.panel === 'verify-phone' && !profile.phoneVerifiedAt;

  async function logoutAndReturnHome() {
    'use server';
    await logout();
    redirect(`/${locale}`);
  }

  return (
    <div className="space-y-6" data-testid="profile-page">
      <header>
        <p className="text-sm font-semibold text-primary">{ar ? 'حسابي' : 'My account'}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{ar ? 'الملف الشخصي' : 'Profile'}</h1>
      </header>

      {showPhonePanel ? (
        <PhoneVerificationPanel locale={locale} initialPhone={profile.phone} returnTo={returnTo} />
      ) : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(17rem,1fr)]">
        <ProfileSummary profile={profile} locale={locale} />
        <aside className="space-y-6" aria-label={ar ? 'الأمان والتفضيلات' : 'Security and preferences'}>
          <Card>
            <CardHeader><CardTitle as="h2" className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />{ar ? 'التحقق والأمان' : 'Verification and security'}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span>{ar ? 'البريد الإلكتروني' : 'Email'}</span><strong>{profile.emailVerifiedAt ? (ar ? 'موثّق' : 'Verified') : (ar ? 'مطلوب' : 'Required')}</strong></div>
              <div className="flex items-center justify-between gap-3"><span>{ar ? 'رقم الهاتف' : 'Phone'}</span><strong>{profile.phoneVerifiedAt ? (ar ? 'موثّق' : 'Verified') : (ar ? 'مطلوب' : 'Required')}</strong></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle as="h2" className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" />{ar ? 'تفضيلات الحساب' : 'Account preferences'}</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <LocaleSwitcher locale={locale} />
              <form action={logoutAndReturnHome}>
                <Button type="submit" variant="outline"><LogOut className="me-2 h-4 w-4" />{ar ? 'تسجيل الخروج' : 'Sign out'}</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-destructive/30">
            <CardHeader><CardTitle as="h2" className="text-destructive">{ar ? 'منطقة خطرة' : 'Danger zone'}</CardTitle></CardHeader>
            <CardContent><DeleteAccountDialog locale={locale} /></CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

