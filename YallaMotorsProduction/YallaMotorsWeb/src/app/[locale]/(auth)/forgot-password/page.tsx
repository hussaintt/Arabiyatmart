import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale } from '@/i18n/config';
import type { Locale } from '@/types/common';
import { serverEnv } from '@/lib/env/server';
import { requireGuest } from '@/lib/auth/guards';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { Car, KeyRound } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface ForgotPasswordPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ForgotPasswordPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) return {};
  const locale = rawLocale as Locale;

  const title = locale === 'ar' ? 'استعادة كلمة المرور | عربيات مارت' : 'Forgot Password | Arabiyat Mart';
  const description =
    locale === 'ar'
      ? 'استعد كلمة مرور حسابك في عربيات مارت بخطوات بسيطة وآمنة.'
      : 'Reset your Arabiyat Mart account password with secure verification.';

  const canonical = `${serverEnv.SITE_ORIGIN}/${locale}/forgot-password`;

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

export default async function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  // Guests only; authenticated users redirected to home
  await requireGuest(null, locale);

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

        {/* Form Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-3">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isAr ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {isAr
              ? 'أدخل بريدك الإلكتروني المسجل وسنرسل لك رمز تحقق لإعادة تعيين كلمة المرور.'
              : 'Enter your registered email and we will send you a verification code to reset your password.'}
          </p>
        </div>

        {/* Interactive Form */}
        <ForgotPasswordForm locale={locale} />
      </div>
    </div>
  );
}
