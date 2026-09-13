import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale } from '@/i18n/config';
import type { Locale } from '@/types/common';
import { serverEnv } from '@/lib/env/server';
import { requireGuest } from '@/lib/auth/guards';
import { readResetFlow } from '@/lib/auth/reset-flow';
import type { CookieStoreLike } from '@/lib/auth/cookies';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Car, AlertTriangle, ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface ResetPasswordPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ResetPasswordPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) return {};
  const locale = rawLocale as Locale;

  const title = locale === 'ar' ? 'تعيين كلمة المرور الجديدة | عربيات مارت' : 'Set New Password | Arabiyat Mart';
  const description =
    locale === 'ar'
      ? 'أدخل الرمز وأعد تعيين كلمة المرور الجديدة لحسابك في عربيات مارت.'
      : 'Enter the verification code and set a new password for your Arabiyat Mart account.';

  // Strict canonical URL without any tokens, flows, or query parameters
  const canonical = `${serverEnv.SITE_ORIGIN}/${locale}/reset-password`;

  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical,
    },
    openGraph: {
      type: 'website',
      locale: locale === 'ar' ? 'ar_EG' : 'en_US',
      title,
      description,
      url: canonical,
    },
  };
}

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  // Guests only
  await requireGuest(null, locale);

  const cookieStore = await cookies();
  const flow = readResetFlow(cookieStore as unknown as CookieStoreLike);

  const isAr = locale === 'ar';

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl shadow-xl p-6 sm:p-8 md:p-10">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-md">
            <Car className="h-6 w-6" aria-hidden="true" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-foreground">
            {isAr ? 'عربيات مارت' : 'Arabiyat Mart'}
          </span>
        </div>

        {flow ? (
          <ResetPasswordForm
            locale={locale}
            flowNonce={flow.nonce}
            initialVerified={flow.verified}
            initialCode={flow.code ?? undefined}
          />
        ) : (
          /* Safe Expired / Restart Flow Card */
          <div className="text-center py-2" data-testid="reset-flow-expired-card">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-foreground mb-2">
              {isAr ? 'انتهت صلاحية جلسة الاستعادة' : 'Reset Session Expired'}
            </h1>

            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {isAr
                ? 'جلسة استعادة كلمة المرور غير صالحة أو انتهت مدتها (صالحة لمدة 15 دقيقة فقط). يرجى طلب رابط جديد لحماية حسابك.'
                : 'Your password reset session is invalid or has expired (valid for 15 minutes only). Please request a new link to protect your account.'}
            </p>

            <div className="space-y-3">
              <Button asChild size="lg" className="w-full font-semibold">
                <Link href="/forgot-password">
                  <RotateCcw className="me-2 h-4 w-4" />
                  {isAr ? 'طلب استعادة كلمة المرور مجددًا' : 'Request Password Reset Again'}
                </Link>
              </Button>

              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href="/login">
                  {isAr ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
                  {isAr ? <ArrowLeft className="ms-2 h-4 w-4" /> : <ArrowRight className="ms-2 h-4 w-4" />}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
