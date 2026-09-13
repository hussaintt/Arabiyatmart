import * as React from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale } from '@/i18n/config';
import type { Locale } from '@/types/common';
import { serverEnv } from '@/lib/env/server';
import { optionalSession } from '@/lib/auth/guards';
import { extractReturnTo, sanitizeReturnTo } from '@/lib/auth/return-to';
import { VerifyEmailPanel } from '@/components/auth/verify-email-panel';
import { Car, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface VerifyEmailPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***';
  const [local, domain] = parts;
  if (!local || !domain) return '***@***';
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

export async function generateMetadata({ params }: VerifyEmailPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) return {};
  const locale = rawLocale as Locale;

  const title = locale === 'ar' ? 'تأكيد البريد الإلكتروني | عربيات مارت' : 'Verify Email | Arabiyat Mart';
  const description =
    locale === 'ar'
      ? 'أدخل رمز التحقق المرسل إلى بريدك الإلكتروني لتفعيل حسابك بالكامل في عربيات مارت.'
      : 'Enter the verification code sent to your email to activate your Arabiyat Mart account.';

  const canonical = `${serverEnv.SITE_ORIGIN}/${locale}/verify-email`;

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

export default async function VerifyEmailPage({ params, searchParams }: VerifyEmailPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const rawSearchParams = await searchParams;
  const returnTo = extractReturnTo(rawSearchParams, locale);

  const session = await optionalSession();

  // Redirect anonymous visitors to login with returnTo preserved
  if (!session) {
    const target = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : '';
    redirect(`/${locale}/login?returnTo=${encodeURIComponent(`/${locale}/verify-email`)}${target}`);
  }

  // If already verified, redirect immediately to intended target or homepage
  if (session.user.emailVerifiedAt) {
    const target = returnTo ? sanitizeReturnTo(returnTo, locale) : `/${locale}`;
    redirect(target);
  }

  const isAr = locale === 'ar';
  const maskedEmail = maskEmail(session.user.email);

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl shadow-xl p-6 sm:p-8 md:p-10">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-md">
            <Car className="h-6 w-6" aria-hidden="true" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-foreground">
            {isAr ? 'عربيات مارت' : 'Arabiyat Mart'}
          </span>
        </div>

        <VerifyEmailPanel
          locale={locale}
          maskedEmail={maskedEmail}
          returnTo={returnTo}
        />

        <div className="mt-8 pt-6 border-t border-border/60 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
          <span>
            {isAr
              ? 'تأكيد البريد يحمي حسابك ويمكنك من التواصل مع البائعين'
              : 'Verifying your email secures your account and enables seller communication'}
          </span>
        </div>
      </div>
    </div>
  );
}
