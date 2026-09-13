import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale } from '@/i18n/config';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface BestOfferIndexProps {
  params: Promise<{ locale: string }>;
}

export default async function BestOfferIndexPage({ params }: BestOfferIndexProps) {
  const { locale } = await params;
  if (!isAppLocale(locale)) notFound();
  setRequestLocale(locale);
  // Best offer requires a specific listing slug; redirect to user's listings
  redirect(`/${locale}/me/listings`);
}
