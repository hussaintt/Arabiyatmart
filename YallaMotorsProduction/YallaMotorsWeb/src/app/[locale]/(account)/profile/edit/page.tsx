import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { isAppLocale } from '@/i18n/config';
import { serverEnv } from '@/lib/env/server';
import { requireSession } from '@/lib/auth/guards';
import { getProfile } from '@/server/queries/profile';
import { Link } from '@/i18n/routing';
import { ProfileForm, ChangePasswordForm } from '@/components/profile/profile-form';
import { Button } from '@/components/ui/button';
import type { AppLocale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

interface ProfileEditPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ProfileEditPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  return {
    title: locale === 'ar' ? 'تعديل الملف الشخصي | عربيات مارت' : 'Edit Profile | Arabiyat Mart',
    robots: { index: false, follow: false },
    alternates: { canonical: `${serverEnv.SITE_ORIGIN}/${locale}/profile/edit` },
  };
}

export default async function ProfileEditPage({ params }: ProfileEditPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale: AppLocale = rawLocale;
  setRequestLocale(locale);
  await requireSession(`/${locale}/profile/edit`, locale);
  const { data: profile } = await getProfile();
  const ar = locale === 'ar';

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-testid="profile-edit-page">
      <header className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="mt-1 shrink-0">
          <Link href="/profile" locale={locale} aria-label={ar ? 'العودة إلى الملف الشخصي' : 'Back to profile'}>
            {ar ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </Link>
        </Button>
        <div>
          <p className="text-sm font-semibold text-primary">{ar ? 'حسابي' : 'My account'}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{ar ? 'تعديل الملف الشخصي' : 'Edit profile'}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{ar ? 'حدّث اسمك ولغة حسابك أو غيّر كلمة المرور.' : 'Update your name and account language, or change your password.'}</p>
        </div>
      </header>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(17rem,2fr)]">
        <ProfileForm profile={profile} locale={locale} />
        <ChangePasswordForm locale={locale} />
      </div>
    </div>
  );
}

