'use client';

import * as React from 'react';
import { CheckCircle2, FileCheck2, Shield, ShieldCheck } from 'lucide-react';
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

interface InsuranceLeadDialogProps {
  listingPublicId: string;
  vehicleTitle: string;
  vehiclePriceCents?: number | undefined;
  vehicleYear?: number | null | undefined;
  locale: AppLocale;
  compact?: boolean;
}

export function InsuranceLeadDialog({
  listingPublicId,
  vehicleTitle,
  vehiclePriceCents,
  vehicleYear,
  locale,
  compact = false,
}: InsuranceLeadDialogProps) {
  const ar = locale === 'ar';
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const idempotencyKey = React.useRef<string>(crypto.randomUUID());

  const [coverageType, setCoverageType] = React.useState('COMPREHENSIVE');
  const [city, setCity] = React.useState('Cairo');
  const [consent, setConsent] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = new FormData(event.currentTarget);

    // Spam honeypot detection
    const honeypot = String(form.get('company_fax') ?? '').trim();
    if (honeypot.length > 0) {
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
          ? 'يرجى الموافقة على مشاركة البيانات مع شركات التأمين المعتمدة'
          : 'Please consent to sharing details with insurance partners',
      );
      return;
    }

    setPending(true);
    setError(null);

    const coverageLabel =
      coverageType === 'COMPREHENSIVE'
        ? (ar ? 'شامل' : 'Comprehensive')
        : (ar ? 'ضد الغير' : 'Third Party');

    const result = await createContactLead(
      {
        listingPublicId,
        channel: 'INSURANCE_REQUEST',
        buyerName,
        buyerPhone,
        note: `طلب وثيقة تأمين: نوع التغطية ${coverageLabel}، المدينة ${city}`,
        meta: {
          coverageType,
          city,
          vehiclePriceCents: vehiclePriceCents ?? null,
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
          (ar ? 'تعذّر إرسال طلب التأمين حالياً' : 'Insurance quote request could not be sent at this time'),
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

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? 'sm' : 'default'}
          className="w-full gap-2 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 font-semibold"
          data-testid="insurance-lead-button"
        >
          <Shield className="h-4 w-4" />
          <span>{ar ? 'طلب عرض تأمين' : 'Get Insurance Quote'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-emerald-600" />
            <span>{ar ? 'طلب عروض تأمين للسيارة' : 'Request Auto Insurance Quotes'}</span>
          </DialogTitle>
          <DialogDescription>
            {ar
              ? `قارن أفضل عروض وثائق التأمين المعتمدة لسيارة ${vehicleTitle}.`
              : `Compare accredited auto insurance coverage options for ${vehicleTitle}.`}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div
            className="rounded-lg border border-emerald-600/30 bg-emerald-500/10 p-5 text-center space-y-2 text-emerald-900 dark:text-emerald-200"
            role="status"
          >
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
            <h4 className="font-bold text-base">
              {ar ? 'تم استلام طلب التأمين بنجاح' : 'Insurance Request Received'}
            </h4>
            <p className="text-sm">
              {ar
                ? 'سيتواصل معك مستشار تأمين مرخص لتقديم مقارنة الأسعار والتغطيات المتاحة.'
                : 'A licensed insurance advisor will reach out to review available coverage options with you.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="insurance-lead-form">
            {/* Honeypot field (hidden from real users) */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor={`ins-honeypot-${listingPublicId}`}>Company Fax</label>
              <input
                id={`ins-honeypot-${listingPublicId}`}
                type="text"
                name="company_fax"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`ins-coverage-${listingPublicId}`}>
                  {ar ? 'نوع التغطية' : 'Coverage Type'}
                </Label>
                <select
                  id={`ins-coverage-${listingPublicId}`}
                  value={coverageType}
                  onChange={(e) => setCoverageType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="COMPREHENSIVE">{ar ? 'تأمين شامل' : 'Comprehensive'}</option>
                  <option value="THIRD_PARTY">{ar ? 'تأمين ضد الغير' : 'Third Party Only'}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`ins-city-${listingPublicId}`}>
                  {ar ? 'المدينة / المحافظة' : 'City / Area'}
                </Label>
                <select
                  id={`ins-city-${listingPublicId}`}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="Cairo">{ar ? 'القاهرة' : 'Cairo'}</option>
                  <option value="Giza">{ar ? 'الجيزة' : 'Giza'}</option>
                  <option value="Alexandria">{ar ? 'الإسكندرية' : 'Alexandria'}</option>
                  <option value="Sharqia">{ar ? 'الشرقية' : 'Sharqia'}</option>
                  <option value="Dakahlia">{ar ? 'الدقهلية' : 'Dakahlia'}</option>
                  <option value="Other">{ar ? 'محافظة أخرى' : 'Other Governorate'}</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`ins-name-${listingPublicId}`}>{ar ? 'الاسم الكامل' : 'Full name'}</Label>
              <Input
                id={`ins-name-${listingPublicId}`}
                name="buyerName"
                maxLength={120}
                autoComplete="name"
                placeholder={ar ? 'مثال: سارة إبراهيم' : 'e.g. Sara Ibrahim'}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`ins-phone-${listingPublicId}`}>{ar ? 'رقم الهاتف' : 'Phone number'}</Label>
              <Input
                id={`ins-phone-${listingPublicId}`}
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
                id={`ins-consent-${listingPublicId}`}
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                required
              />
              <label
                htmlFor={`ins-consent-${listingPublicId}`}
                className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none"
              >
                <ShieldCheck className="h-3.5 w-3.5 inline mr-1 text-emerald-600" />
                {ar
                  ? 'أوافق صراحة على مشاركة بيانات الاتصال وتفاصيل المركبة مع شركات ووسطاء التأمين المعتمدين لتقديم عروض وثائق التأمين طبقاً لسياسة الخصوصية.'
                  : 'I consent to sharing my contact and vehicle details with licensed insurance partners to receive policy quotes in accordance with the privacy policy.'}
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
              className="w-full font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="submit-insurance-lead"
            >
              {pending
                ? ar
                  ? 'جاري الإرسال...'
                  : 'Submitting...'
                : ar
                  ? 'طلب عروض التأمين'
                  : 'Request Insurance Quotes'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
