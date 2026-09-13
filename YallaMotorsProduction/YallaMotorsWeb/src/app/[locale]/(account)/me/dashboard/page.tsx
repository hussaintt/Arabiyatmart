import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { BarChart3, CarFront, Eye, Heart, MessageSquareText, Percent } from 'lucide-react';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { serverEnv } from '@/lib/env/server';
import { DashboardRangeSchema } from '@/lib/api/schemas/dashboard';
import { getSellerDashboard } from '@/server/queries/dashboard';
import {
  getDealerEntitlements,
  getDealerBillingSummary,
  getDealerSubscription,
} from '@/server/queries/billing';
import { VendorSwitcher } from '@/components/vendor/vendor-switcher';
import { MetricCard } from '@/components/dashboard/metric-card';
import { RangeControl } from '@/components/dashboard/range-control';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { DashboardViewTabs } from '@/components/dashboard/dashboard-view-tabs';
import { DealerBillingSummary } from '@/components/dashboard/dealer-billing-summary';
import { DealerInvoicesTable } from '@/components/dashboard/dealer-invoices-table';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DashboardPageProps { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: DashboardPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  return { title: locale === 'ar' ? 'لوحة تحكم البائع | عربيات مارت' : 'Seller Dashboard | Arabiyat Mart', robots: { index: false, follow: false }, alternates: { canonical: `${serverEnv.SITE_ORIGIN}/${locale}/me/dashboard` } };
}

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale: AppLocale = rawLocale;
  setRequestLocale(locale);
  const ar = locale === 'ar';
  const query = await searchParams;
  const parsedRange = DashboardRangeSchema.safeParse(typeof query.range === 'string' ? query.range : '30d');
  const range = parsedRange.success ? parsedRange.data : '30d';
  const state = await getSellerDashboard(range);

  let entitlements = null;
  let billingSummary = null;
  let subscription = null;

  if (state.activeVendorPublicId) {
    [entitlements, billingSummary, subscription] = await Promise.all([
      getDealerEntitlements(state.activeVendorPublicId),
      getDealerBillingSummary(state.activeVendorPublicId),
      getDealerSubscription(state.activeVendorPublicId),
    ]);
  }

  const overviewContent = state.overview ? (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label={ar ? 'الإعلانات النشطة' : 'Active listings'} value={state.overview.summary.activeListingsCount.toLocaleString(locale)} Icon={CarFront} />
        <MetricCard label={ar ? 'إجمالي المشاهدات' : 'Total views'} value={state.overview.summary.totalViews.toLocaleString(locale)} Icon={Eye} />
        <MetricCard label={ar ? 'طلبات التواصل' : 'Buyer inquiries'} value={state.overview.summary.totalLeads.toLocaleString(locale)} Icon={MessageSquareText} />
        <MetricCard label={ar ? 'الإضافات للمفضلة' : 'Favorites'} value={state.overview.summary.totalFavorites.toLocaleString(locale)} Icon={Heart} />
        <MetricCard label={ar ? 'معدل الاستجابة' : 'Response rate'} value={`${state.overview.summary.responseRatePercentage.toLocaleString(locale, { maximumFractionDigits: 1 })}%`} Icon={Percent} />
      </section>
      <DashboardCharts leadsByChannel={state.overview.summary.leadsByChannel} locale={locale} />
    </>
  ) : null;

  const billingContent = (
    <div className="space-y-6">
      <DealerBillingSummary
        entitlements={entitlements}
        billingSummary={billingSummary}
        subscription={subscription}
        locale={locale}
      />
      <DealerInvoicesTable
        invoices={billingSummary?.recentInvoices ?? []}
        locale={locale}
      />
    </div>
  );

  return (
    <div className="space-y-6" data-testid="seller-dashboard-page">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 inline-flex items-center gap-2 text-primary"><BarChart3 className="h-5 w-5" /><span className="text-sm font-bold">{ar ? 'أداء المتجر' : 'Store performance'}</span></div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{ar ? 'لوحة تحكم البائع' : 'Seller dashboard'}</h1></div><RangeControl range={range} locale={locale} /></header>
      <VendorSwitcher memberships={state.memberships} activeVendorPublicId={state.activeVendorPublicId} locale={locale} />
      {!state.overview ? <div className="rounded-xl border border-dashed p-10 text-center"><h2 className="font-bold">{state.memberships.length === 0 ? (ar ? 'يلزم دور مدير متجر' : 'A store manager role is required') : (ar ? 'اختر حساب البائع لعرض الأداء' : 'Select a seller account to view performance')}</h2><p className="mt-2 text-sm text-muted-foreground">{ar ? 'تعرض لوحة التحكم بيانات المتاجر التي تملك فيها صلاحية مدير أو مالك فقط.' : 'The dashboard only shows stores where you are a manager or owner.'}</p></div> : (
        <DashboardViewTabs
          overviewContent={overviewContent}
          billingContent={billingContent}
          locale={locale}
        />
      )}
    </div>
  );
}
