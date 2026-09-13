import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { serverEnv } from '@/lib/env/server';
import { ApiContractError } from '@/lib/api/error';
import { LeadStatusSchema } from '@/lib/api/schemas/lead';
import { listSellerLeads } from '@/server/queries/leads';
import { LeadList } from '@/components/leads/lead-list';
import { VendorSwitcher } from '@/components/vendor/vendor-switcher';
import { getActiveVendorState } from '@/server/queries/vendors';
import { Link } from '@/i18n/routing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface LeadsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: LeadsPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  return {
    title: locale === 'ar' ? 'طلبات التواصل | عربيات مارت' : 'Buyer Inquiries | Arabiyat Mart',
    robots: { index: false, follow: false },
    alternates: { canonical: `${serverEnv.SITE_ORIGIN}/${locale}/me/leads` },
  };
}

export default async function LeadsPage({ params, searchParams }: LeadsPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale: AppLocale = rawLocale;
  setRequestLocale(locale);
  const ar = locale === 'ar';
  const query = await searchParams;
  const requestedStatus = typeof query.status === 'string' ? query.status.toUpperCase() : undefined;
  const parsedStatus = LeadStatusSchema.safeParse(requestedStatus);
  const vendorState = await getActiveVendorState().catch(() => ({ memberships: [], activeVendorPublicId: null, resolutionError: null }));
  const staffLevel = { VIEWER: 0, STAFF: 1, MANAGER: 2, OWNER: 3 } as const;
  const sellerMemberships = vendorState.memberships.filter((item) => item.vendor.status === 'APPROVED' && staffLevel[item.membership.role] >= staffLevel.STAFF);

  let response: Awaited<ReturnType<typeof listSellerLeads>> | null = null;
  let accessError: string | null = null;

  try {
    response = await listSellerLeads({ status: parsedStatus.success ? parsedStatus.data : undefined, limit: 40 });
  } catch (error) {
    if (error instanceof ApiContractError && error.status === 403) {
      accessError = ar
        ? 'المتجر المحدد غير متاح حاليًا أو لا تملك صلاحية الوصول إليه.'
        : 'The selected vendor is unavailable or you lack access permissions.';
    } else {
      throw error;
    }
  }

  const statuses = [
    { value: undefined, label: ar ? 'الكل' : 'All' },
    { value: 'NEW', label: ar ? 'جديد' : 'New' },
    { value: 'CONTACTED', label: ar ? 'تم التواصل' : 'Contacted' },
    { value: 'QUALIFIED', label: ar ? 'مهتم' : 'Qualified' },
    { value: 'WON', label: ar ? 'تمت المتابعة' : 'Completed' },
    { value: 'LOST', label: ar ? 'لم يكتمل' : 'Closed' },
  ] as const;

  return (
    <div className="space-y-6" data-testid="leads-page">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{ar ? 'طلبات التواصل' : 'Buyer inquiries'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{ar ? 'تابع المكالمات ورسائل واتساب والرسائل الواردة على إعلاناتك.' : 'Track calls, WhatsApp contacts, and messages for your listings.'}</p>
      </header>
      <VendorSwitcher memberships={sellerMemberships} activeVendorPublicId={sellerMemberships.some((item) => item.vendor.publicId === vendorState.activeVendorPublicId) ? vendorState.activeVendorPublicId : null} locale={locale} allowPrivate />
      {accessError ? (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-destructive">
          <h2 className="text-base font-semibold">{ar ? 'المتجر المحدد غير متاح' : 'The selected vendor is unavailable'}</h2>
          <p className="mt-1 text-sm">{accessError}</p>
        </div>
      ) : (
        <>
          <nav aria-label={ar ? 'تصفية الطلبات' : 'Filter inquiries'} className="flex gap-2 overflow-x-auto pb-1">
            {statuses.map((item) => {
              const active = (item.value ?? undefined) === (parsedStatus.success ? parsedStatus.data : undefined);
              return <Link key={item.value ?? 'ALL'} href={item.value ? `/me/leads?status=${item.value}` : '/me/leads'} locale={locale} aria-current={active ? 'page' : undefined} className="whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground">{item.label}</Link>;
            })}
          </nav>
          <LeadList leads={response!.data} locale={locale} />
          {response!.meta.hasMore ? <p className="text-center text-sm text-muted-foreground">{ar ? 'توجد طلبات أقدم. ستتم إضافة التصفح المتتابع قريبًا.' : 'Older inquiries are available. Continued pagination is coming next.'}</p> : null}
        </>
      )}
    </div>
  );
}
