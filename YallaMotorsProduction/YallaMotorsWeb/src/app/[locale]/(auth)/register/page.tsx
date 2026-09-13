import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale } from '@/i18n/config';
import type { Locale } from '@/types/common';
import { serverEnv } from '@/lib/env/server';
import { requireGuest } from '@/lib/auth/guards';
import { extractReturnTo } from '@/lib/auth/return-to';
import { RegisterForm } from '@/components/auth/register-form';
import { SocialLoginButtons } from '@/components/auth/social-login-buttons';
import { Car, CheckCircle2, TrendingUp, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface RegisterPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: RegisterPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) return {};
  const locale = rawLocale as Locale;

  const title = locale === 'ar' ? 'إنشاء حساب جديد | عربيات مارت' : 'Create Account | Arabiyat Mart';
  const description =
    locale === 'ar'
      ? 'انضم إلى مجتمع عربيات مارت وابدأ بيع وشراء السيارات بكل ثقة وسهولة.'
      : 'Join Arabiyat Mart and trade vehicles with verified confidence and ease.';

  const canonical = `${serverEnv.SITE_ORIGIN}/${locale}/register`;

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

export default async function RegisterPage({ params, searchParams }: RegisterPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const rawSearchParams = await searchParams;
  const returnTo = extractReturnTo(rawSearchParams, locale);

  // Apply guest protection (redirect authenticated users)
  await requireGuest(returnTo, locale);

  const isAr = locale === 'ar';

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-border bg-card shadow-xl overflow-hidden">
        {/* Brand / Context Panel (Desktop) */}
        <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-8 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-e border-border">
          <div>
            <div className="flex items-center gap-2 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-md">
                <Car className="h-6 w-6" aria-hidden="true" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-foreground">
                {isAr ? 'عربيات مارت' : 'Arabiyat Mart'}
              </span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-4">
              {isAr ? 'انضم إلى مجتمع بيع وشراء السيارات' : 'Join the modern auto marketplace'}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {isAr
                ? 'أنشئ حسابك مجانًا في خطوات بسيطة واستمتع بتجربة بيع وشراء سلسة وموثوقة.'
                : 'Create your free account in simple steps and enjoy a seamless, secure vehicle trading experience.'}
            </p>
          </div>

          <div className="space-y-4 pt-6 border-t border-border/50">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>{isAr ? 'نشر إعلانات السيارات بسهولة وسرعة' : 'Fast and effortless vehicle listing'}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-primary shrink-0" />
              <span>{isAr ? 'أدوات تسويق وتحليلات متقدمة للتجار' : 'Advanced marketing and analytics for dealers'}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Users className="h-4 w-4 text-primary shrink-0" />
              <span>{isAr ? 'آلاف المشترين والبائعين يوميًا' : 'Thousands of daily buyers and sellers'}</span>
            </div>
          </div>
        </div>

        {/* Form Card (Mobile full-width, Tablet/Desktop centered 620px max) */}
        <div className="lg:col-span-7 p-6 sm:p-8 md:p-10 flex flex-col justify-center max-w-[620px] mx-auto w-full">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isAr ? 'إنشاء حساب جديد' : 'Create an Account'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isAr
                ? 'أدخل بياناتك للانضمام إلى منصة عربيات مارت'
                : 'Fill in your details to join Arabiyat Mart'}
            </p>
          </div>

          {/* Social Logins */}
          <SocialLoginButtons locale={locale} returnTo={returnTo} />

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground">
                {isAr ? 'أو عبر البريد الإلكتروني' : 'Or with email'}
              </span>
            </div>
          </div>

          {/* Registration Form */}
          <RegisterForm locale={locale} returnTo={returnTo} />
        </div>
      </div>
    </div>
  );
}
