import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale } from '@/i18n/config';
import { serverEnv } from '@/lib/env/server';
import { getAuthoritativeVendorMemberships, requireVerifiedPhone } from '@/lib/auth/guards';
import { SellWorkflow } from '@/components/sell/sell-workflow';
import type { AppLocale } from '@/i18n/config';
import type { ListingOwnershipScope } from '@/types/sell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface SellPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: SellPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  return {
    title: locale === 'ar' ? 'أضف إعلانك | عربيات مارت' : 'Sell Your Car | Arabiyat Mart',
    robots: { index: false, follow: false },
    alternates: { canonical: `${serverEnv.SITE_ORIGIN}/${locale}/sell` },
  };
}

export default async function SellPage({ params }: SellPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale: AppLocale = rawLocale;
  setRequestLocale(locale);

  const session = await requireVerifiedPhone(`/${locale}/sell`, locale);

  const personalScope: ListingOwnershipScope = {
    id: 'personal',
    type: 'personal',
    displayName: locale === 'ar' ? 'حساب شخصي (أفراد)' : 'Personal Account (Individual)',
    role: 'INDIVIDUAL',
    isVerified: true,
    phoneVerified: Boolean(session.user.phoneVerifiedAt),
    quota: { currentCount: 0, maxLimit: 5, availableSlots: 5 },
  };

  const eligibleScopes: ListingOwnershipScope[] = [personalScope];

  try {
    const memberships = await getAuthoritativeVendorMemberships();
    for (const item of memberships) {
      if (
        item.vendor.status === 'APPROVED' &&
        ['OWNER', 'MANAGER', 'STAFF'].includes(item.membership.role)
      ) {
        eligibleScopes.push({
          id: item.vendor.publicId,
          type: 'dealership',
          displayName:
            item.vendor.displayName[locale] ||
            item.vendor.displayName.ar ||
            item.vendor.displayName.en ||
            item.vendor.legalName,
          role: item.membership.role,
          vendorPublicId: item.vendor.publicId,
          isVerified: true,
          phoneVerified: Boolean(session.user.phoneVerifiedAt),
          quota: { currentCount: 0, maxLimit: 50, availableSlots: 50 },
        });
      }
    }
  } catch {
    // If dealership membership query fails, default to personal scope
  }

  return (
    <div className="space-y-6" data-testid="sell-page">
      <SellWorkflow
        userPublicId={session.user.publicId}
        locale={locale}
        eligibleScopes={eligibleScopes}
      />
    </div>
  );
}
