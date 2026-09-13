import * as React from 'react';
import {
  AlertTriangle,
  Building2,
  Users,
  CarFront,
  Sparkles,
  Calendar,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatMoneyFromCents } from '@/i18n/format';
import type { AppLocale } from '@/i18n/config';
import type {
  DealerEntitlementsSnapshot,
  VendorBillingSummary,
  VendorSubscription,
} from '@/types/billing';

interface DealerBillingSummaryProps {
  entitlements: DealerEntitlementsSnapshot | null;
  billingSummary: VendorBillingSummary | null;
  subscription: VendorSubscription | null;
  locale: AppLocale;
}

export function DealerBillingSummary({
  entitlements,
  billingSummary,
  subscription,
  locale,
}: DealerBillingSummaryProps) {
  const ar = locale === 'ar';
  const account = billingSummary?.account;
  const isRestricted = Boolean(account?.restrictedAt);

  return (
    <div className="space-y-6" data-testid="dealer-billing-summary-section">
      {/* 1. Restriction / Grace Period Warning */}
      {isRestricted && (
        <Alert variant="destructive" data-testid="dealer-restriction-alert">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>
            {ar ? 'حساب المتجر مقيد مؤقتاً' : 'Store account temporarily restricted'}
          </AlertTitle>
          <AlertDescription>
            {ar
              ? 'تم تقييد بعض ميزات المتجر بسبب فواتير مستحقة أو انتهاء فترة السماح. يرجى سداد الرصيد المستحق أو التواصل مع الإدارة لإعادة التفعيل.'
              : 'Some store features are restricted due to overdue invoices or grace period expiration. Please settle your balance or contact support to reactivate.'}
            {account?.restrictionReason && (
              <span className="block mt-1 font-mono text-xs opacity-90">
                {ar ? `السبب: ${account.restrictionReason}` : `Reason: ${account.restrictionReason}`}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* 2. Active Subscription & Plan Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="dealer-plan-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {ar ? 'خطة الاشتراك الحالية' : 'Current Subscription Plan'}
              </span>
              <Badge
                variant={subscription?.status === 'ACTIVE' ? 'default' : 'secondary'}
                data-testid="subscription-status-badge"
              >
                {subscription?.status ?? (ar ? 'نشط' : 'Active')}
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold">
              {subscription?.plan?.name ?? (ar ? 'الباقة الأساسية للمعرض' : 'Dealership Standard')}
            </CardTitle>
            {subscription?.currentPeriodEnd && (
              <CardDescription className="flex items-center gap-1.5 pt-1 text-xs">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  {ar ? 'تاريخ التجديد القادم:' : 'Next renewal:'}{' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString(
                    ar ? 'ar-EG' : 'en-US',
                    { year: 'numeric', month: 'short', day: 'numeric' },
                  )}
                </span>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-muted-foreground">{ar ? 'الرصيد المدفوع مسبقاً:' : 'Prepaid balance:'}</span>
              <span className="font-semibold text-emerald-600">
                {formatMoneyFromCents(account?.prepaidBalanceCents ?? 0, account?.currency ?? 'EGP', locale)}
              </span>
            </div>
            {billingSummary?.currentInvoice && (
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-muted-foreground">{ar ? 'المبلغ المستحق حالياً:' : 'Current balance due:'}</span>
                <span className={`font-semibold ${billingSummary.currentInvoice.balanceDueCents > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {formatMoneyFromCents(billingSummary.currentInvoice.balanceDueCents, billingSummary.currentInvoice.currency, locale)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Features & Verification Perks */}
        <Card data-testid="dealer-features-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              {ar ? 'المزايا والاعتمادات المشمولة' : 'Included Features & Badges'}
            </CardTitle>
            <CardDescription className="text-xs">
              {ar ? 'الميزات المفعلة لحسابك بناءً على باقتك الحالية' : 'Active capabilities based on your subscription tier'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2.5 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{ar ? 'إحصائيات وتحليلات متقدمة للمتجر' : 'Advanced store performance analytics'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span>{ar ? 'شارة معرض معتمد وموثق' : 'Verified dealership trust badge'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              <span>
                {ar ? 'رصيد تمييز إعلانات شهري:' : 'Monthly featured ad credits:'}{' '}
                <strong>{entitlements?.featuredCredits.balance ?? 0}</strong>{' '}
                {ar ? 'رصيد متاح' : 'credits available'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Quota Usage Progress Bars */}
      {entitlements && (
        <Card data-testid="dealer-quotas-card">
          <CardHeader>
            <CardTitle className="text-lg font-bold">
              {ar ? 'حدود الحساب واستخدام الحصص' : 'Account Limits & Quota Usage'}
            </CardTitle>
            <CardDescription className="text-sm">
              {ar ? 'استهلاكك الحالي مقابل الحد الأقصى المسموح به في الباقة' : 'Your current consumption against plan limits'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Active Listings Quota */}
            <div className="space-y-2" data-testid="quota-listings">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <CarFront className="h-4 w-4 text-primary" />
                  {ar ? 'الإعلانات النشطة' : 'Active Listings'}
                </span>
                <span className="font-mono text-xs">
                  {entitlements.listings.used} / {entitlements.listings.limit}{' '}
                  {ar ? 'إعلان' : 'listings'}
                </span>
              </div>
              <Progress
                value={Math.min(100, Math.round((entitlements.listings.used / (entitlements.listings.limit || 1)) * 100))}
                className="h-2.5"
              />
            </div>

            {/* Staff Seats Quota */}
            <div className="space-y-2" data-testid="quota-staff">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Users className="h-4 w-4 text-primary" />
                  {ar ? 'فريق العمل (الموظفين)' : 'Staff Members'}
                </span>
                <span className="font-mono text-xs">
                  {entitlements.staff.used} / {entitlements.staff.limit}{' '}
                  {ar ? 'موظف' : 'members'}
                </span>
              </div>
              <Progress
                value={Math.min(100, Math.round((entitlements.staff.used / (entitlements.staff.limit || 1)) * 100))}
                className="h-2.5"
              />
            </div>

            {/* Branches Quota */}
            <div className="space-y-2" data-testid="quota-branches">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Building2 className="h-4 w-4 text-primary" />
                  {ar ? 'الفروع المعتمدة' : 'Approved Branches'}
                </span>
                <span className="font-mono text-xs">
                  {entitlements.branches.used} / {entitlements.branches.limit}{' '}
                  {ar ? 'فرع' : 'branches'}
                </span>
              </div>
              <Progress
                value={Math.min(100, Math.round((entitlements.branches.used / (entitlements.branches.limit || 1)) * 100))}
                className="h-2.5"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
