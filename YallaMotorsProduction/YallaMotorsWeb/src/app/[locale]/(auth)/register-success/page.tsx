import * as React from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale } from '@/i18n/config';
import type { Locale } from '@/types/common';
import { serverEnv } from '@/lib/env/server';
import { optionalSession } from '@/lib/auth/guards';
import { extractReturnTo, sanitizeReturnTo } from '@/lib/auth/return-to';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Car, CheckCircle2, Mail, ArrowRight, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface RegisterSuccessPageProps {
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

export async function generateMetadata({ params }: RegisterSuccessPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) return {};
  const locale = rawLocale as Locale;

  const title = locale === 'ar' ? 'تم إنشاء الحساب بنجاح | عربيات مارت' : 'Account Created Successfully | Arabiyat Mart';
  const description =
    locale === 'ar'
      ? 'تم تسجيل حسابك بنجاح في سوق عربيات مارت للسيارات.'
      : 'Your account has been created successfully on Arabiyat Mart.';

  const canonical = `${serverEnv.SITE_ORIGIN}/${locale}/register-success`;

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

export default async function RegisterSuccessPage({ params, searchParams }: RegisterSuccessPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const rawSearchParams = await searchParams;
  const returnTo = extractReturnTo(rawSearchParams, locale);

  const session = await optionalSession();

  // If no session exists, redirect to login
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const isAr = locale === 'ar';
  const isVerified = Boolean(session.user.emailVerifiedAt);
  const maskedEmail = maskEmail(session.user.email);
  const safeTarget = returnTo ? sanitizeReturnTo(returnTo, locale) : `/${locale}`;
  const verifyTarget = returnTo
    ? `/verify-email?returnTo=${encodeURIComponent(returnTo)}`
    : '/verify-email';

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-xl p-8 sm:p-10 text-center">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-md">
            <Car className="h-6 w-6" aria-hidden="true" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-foreground">
            {isAr ? 'عربيات مارت' : 'Arabiyat Mart'}
          </span>
        </div>

        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-3">
          {isAr ? 'أهلاً بك في عربيات مارت!' : 'Welcome to Arabiyat Mart!'}
        </h1>

        {isVerified ? (
          <div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8">
              {isAr
                ? 'تم إنشاء حسابك وتأكيده بنجاح. يمكنك الآن تصفح آلاف السيارات والتواصل المباشر مع البائعين.'
                : 'Your account has been created and verified successfully. You can now explore thousands of listings and contact sellers directly.'}
            </p>

            <Button asChild size="lg" className="w-full font-semibold">
              <Link href={safeTarget}>
                {isAr ? 'ابدأ التصفح الآن' : 'Start Browsing Now'}
                {isAr ? <ArrowLeft className="ms-2 h-4 w-4" /> : <ArrowRight className="ms-2 h-4 w-4" />}
              </Link>
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {isAr
                ? 'تم إنشاء حسابك بنجاح! للمتابعة واستخدام كامل ميزات المنصة وإضافة إعلاناتك، يرجى تأكيد بريدك الإلكتروني.'
                : 'Your account has been created successfully! To access all marketplace features and list vehicles, please verify your email address.'}
            </p>

            {/* Email Box */}
            <div className="bg-muted/50 border border-border/80 rounded-xl p-4 mb-8 flex items-center justify-center gap-3">
              <Mail className="h-5 w-5 text-primary shrink-0" />
              <div className="text-start">
                <p className="text-xs text-muted-foreground">
                  {isAr ? 'أرسلنا رمز التحقق إلى:' : 'We sent a verification code to:'}
                </p>
                <p className="text-sm font-semibold text-foreground font-mono" dir="ltr">
                  {maskedEmail}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button asChild size="lg" className="w-full font-semibold" data-testid="verify-now-btn">
                <Link href={verifyTarget}>
                  {isAr ? 'تأكيد البريد الإلكتروني الآن' : 'Verify Email Now'}
                  {isAr ? <ArrowLeft className="ms-2 h-4 w-4" /> : <ArrowRight className="ms-2 h-4 w-4" />}
                </Link>
              </Button>

              <Button asChild variant="outline" size="lg" className="w-full" data-testid="skip-to-marketplace-btn">
                <Link href={safeTarget}>
                  {isAr ? 'المتابعة والتأكيد لاحقاً' : 'Continue and Verify Later'}
                </Link>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              {isAr
                ? 'يمكنك دائماً تأكيد بريدك الإلكتروني في أي وقت من صفحة الملف الشخصي.'
                : 'You can always verify your email anytime from your profile page.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
