'use client';

import * as React from 'react';
import { BadgePercent, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createContactLead } from '@/server/actions/leads';
import type { AppLocale } from '@/i18n/config';
import { trackAnalytics } from '@/lib/analytics/client';
import { formatMoneyFromCents } from '@/i18n/format';

interface FinanceLeadDialogProps {
  listingPublicId: string;
  vehicleTitle: string;
  vehiclePriceCents: number;
  vehicleYear?: number | null | undefined;
  currency?: string | undefined;
  locale: AppLocale;
  compact?: boolean;
}

export function FinanceLeadDialog({
  listingPublicId,
  vehicleTitle,
  vehiclePriceCents,
  vehicleYear,
  currency = 'EGP',
  locale,
  compact = false,
}: FinanceLeadDialogProps) {
  const ar = locale === 'ar';
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const idempotencyKey = React.useRef<string>(crypto.randomUUID());

  // Default down payment = 20%
  const defaultDownPayment = Math.round((vehiclePriceCents * 0.2) / 100);
  const [downPayment, setDownPayment] = React.useState(defaultDownPayment);
  const [tenureMonths, setTenureMonths] = React.useState(36);
  const [consent, setConsent] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);

    // Spam honeypot detection
    const honeypot = String(form.get('company_website') ?? '').trim();
    if (honeypot.length > 0) {
      // Silently pretend success to fool bots
      setSent(true);
      return;
    }

    const buyerName = String(form.get('buyerName') ?? '').trim();
    const buyerPhone = String(form.get('buyerPhone') ?? '').trim();

    if (!buyerName || !buyerPhone) {
      setError(ar ? 'يرجى إدخال الاسم ورقم الهاتف' : 'Please enter your name and phone number');
      return;
    }

    if (!consent) {
      setError(
        ar
          ? 'يرجى الموافقة على مشاركة البيانات مع شركاء التمويل المعتمدين'
          : 'Please consent to sharing details with financing partners',
      );
      return;
    }

    setPending(true);
    setError(null);

    const downPaymentCents = Math.round(downPayment * 100);
    const result = await createContactLead(
      {
        listingPublicId,
        channel: 'FINANCE_REQUEST',
        buyerName,
        buyerPhone,
        note: `طلب تمويل: دفعة مقدمة ${downPayment} ${currency}، مدة التقسيط ${tenureMonths} شهراً`,
        meta: {
          downPaymentCents,
          tenureMonths,
          vehiclePriceCents,
          vehicleTitle,
          vehicleYear: vehicleYear ?? null,
          consentGiven: true,
        },
      },
      idempotencyKey.current,
    );

    setPending(false);

    if (!result.ok) {
      trackAnalytics({
        name: 'lead_outcome',
        operation: 'create',
        channel: 'message',
        outcome: 'failed',
        code: result.error.code,
        status: result.error.status,
      });
      setError(
        result.error.fieldErrors[0]?.message ??
          (ar ? 'تعذّر إرسال طلب التمويل حالياً' : 'Financing request could not be sent at this time'),
      );
      return;
    }

    trackAnalytics({
      name: 'lead_outcome',
      operation: 'create',
      channel: 'message',
      outcome: 'succeeded',
    });
    setSent(true);
  }

  function handleOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) {
      setError(null);
      setSent(false);
      setConsent(false);
      idempotencyKey.current = crypto.randomUUID();
    }
  }

  const formattedPrice = formatMoneyFromCents(vehiclePriceCents, currency, locale);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? 'sm' : 'default'}
          className="w-full gap-2 border-primary/40 hover:bg-primary/5 font-semibold text-primary"
          data-testid="finance-lead-button"
        >
          <BadgePercent className="h-4 w-4" />
          <span>{ar ? 'طلب تمويل وتقسيط' : 'Calculate & Apply for Financing'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgePercent className="h-5 w-5 text-primary" />
            <span>{ar ? 'طلب تمويل بنكي وتقسيط' : 'Apply for Auto Financing'}</span>
          </DialogTitle>
          <DialogDescription>
            {ar
              ? `احصل على عروض تمويل مخصصة لسيارة ${vehicleTitle} بسعر ${formattedPrice}.`
              : `Get tailored auto financing offers for ${vehicleTitle} (${formattedPrice}).`}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div
            className="rounded-lg border border-green-600/30 bg-green-500/10 p-5 text-center space-y-2 text-green-900 dark:text-green-200"
            role="status"
          >
            <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
            <h4 className="font-bold text-base">
              {ar ? 'تم استلام طلب التمويل بنجاح' : 'Financing Request Received'}
            </h4>
            <p className="text-sm">
              {ar
                ? 'سيتواصل معك ممثل أحد البنوك أو شركات التمويل الشريكة في أقرب وقت لدراسة الطلب.'
                : 'A representative from our partner financing institutions will contact you shortly.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="finance-lead-form">
            {/* Honeypot field (hidden from real users) */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor={`fin-honeypot-${listingPublicId}`}>Company Website</label>
              <input
                id={`fin-honeypot-${listingPublicId}`}
                type="text"
                name="company_website"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`fin-downpayment-${listingPublicId}`}>
                  {ar ? 'المقدم التقريبي (ج.م)' : 'Down payment (EGP)'}
                </Label>
                <Input
                  id={`fin-downpayment-${listingPublicId}`}
                  type="number"
                  min={0}
                  max={Math.round(vehiclePriceCents / 100)}
                  value={downPayment}
                  onChange={(e) => setDownPayment(Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`fin-tenure-${listingPublicId}`}>
                  {ar ? 'مدة التقسيط' : 'Tenure'}
                </Label>
                <select
                  id={`fin-tenure-${listingPublicId}`}
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value={12}>{ar ? '12 شهراً (سنة)' : '12 Months (1 Year)'}</option>
                  <option value={24}>{ar ? '24 شهراً (سنتان)' : '24 Months (2 Years)'}</option>
                  <option value={36}>{ar ? '36 شهراً (3 سنوات)' : '36 Months (3 Years)'}</option>
                  <option value={48}>{ar ? '48 شهراً (4 سنوات)' : '48 Months (4 Years)'}</option>
                  <option value={60}>{ar ? '60 شهراً (5 سنوات)' : '60 Months (5 Years)'}</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`fin-name-${listingPublicId}`}>{ar ? 'الاسم الكامل' : 'Full name'}</Label>
              <Input
                id={`fin-name-${listingPublicId}`}
                name="buyerName"
                maxLength={120}
                autoComplete="name"
                placeholder={ar ? 'مثال: أحمد محمود' : 'e.g. Ahmed Mahmoud'}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`fin-phone-${listingPublicId}`}>{ar ? 'رقم الهاتف' : 'Phone number'}</Label>
              <Input
                id={`fin-phone-${listingPublicId}`}
                name="buyerPhone"
                type="tel"
                maxLength={20}
                autoComplete="tel"
                placeholder="+201..."
                className="dir-ltr text-right"
                required
              />
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3">
              <input
                id={`fin-consent-${listingPublicId}`}
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                required
              />
              <label
                htmlFor={`fin-consent-${listingPublicId}`}
                className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none"
              >
                <ShieldCheck className="h-3.5 w-3.5 inline mr-1 text-primary" />
                {ar
                  ? 'أوافق صراحة على مشاركة بيانات الاتصال وتفاصيل السيارة مع شركاء التمويل والبنوك المعتمدة للتواصل وتقديم العروض التمويلية طبقاً لسياسة الخصوصية.'
                  : 'I consent to sharing my contact and vehicle inquiry with accredited financing partners to evaluate offers in accordance with the privacy policy.'}
              </label>
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={pending || !consent}
              className="w-full font-bold"
              data-testid="submit-finance-lead"
            >
              {pending
                ? ar
                  ? 'جاري الإرسال...'
                  : 'Submitting...'
                : ar
                  ? 'إرسال طلب التمويل'
                  : 'Submit Financing Request'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
