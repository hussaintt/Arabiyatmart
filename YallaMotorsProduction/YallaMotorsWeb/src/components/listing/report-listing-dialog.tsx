'use client';

import * as React from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createListingReport } from '@/server/actions/reports';
import type { AppLocale } from '@/i18n/config';
import type { ReportCategory } from '@/types/lead';
import { trackAnalytics } from '@/lib/analytics/client';

const CATEGORIES: ReportCategory[] = ['FRAUD', 'WRONG_INFO', 'SOLD_ALREADY', 'DUPLICATE', 'OFFENSIVE', 'OTHER'];

const labels: Record<ReportCategory, { ar: string; en: string }> = {
  FRAUD: { ar: 'احتيال أو إعلان مضلل', en: 'Fraud or misleading' },
  WRONG_INFO: { ar: 'معلومات غير صحيحة', en: 'Incorrect information' },
  SOLD_ALREADY: { ar: 'تم بيع السيارة بالفعل', en: 'Already sold' },
  DUPLICATE: { ar: 'إعلان مكرر', en: 'Duplicate listing' },
  OFFENSIVE: { ar: 'محتوى مسيء', en: 'Offensive content' },
  OTHER: { ar: 'سبب آخر', en: 'Other' },
};

export function ReportListingDialog({ listingPublicId, locale }: { listingPublicId: string; locale: AppLocale }) {
  const ar = locale === 'ar';
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const idempotencyKey = React.useRef<string>(crypto.randomUUID());

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const category = String(form.get('category')) as ReportCategory;
    const details = String(form.get('details') ?? '').trim();
    const result = await createListingReport({ listingPublicId, category, details: details || null }, idempotencyKey.current);
    setPending(false);
    if (!result.ok) {
      trackAnalytics({ name: 'report_outcome', outcome: 'failed', code: result.error.code, status: result.error.status, requestId: result.error.requestId });
      const fallback = result.error.status === 401
        ? (ar ? 'سجّل الدخول وأكّد رقم هاتفك لإرسال البلاغ.' : 'Sign in and verify your phone to submit a report.')
        : (ar ? 'تعذّر إرسال البلاغ' : 'The report could not be submitted');
      setError(result.error.fieldErrors[0]?.message ?? fallback);
      return;
    }
    trackAnalytics({ name: 'report_outcome', outcome: 'succeeded' });
    setSent(true);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (pending) return;
      setOpen(next);
      if (next) {
        setError(null);
        setSent(false);
        idempotencyKey.current = crypto.randomUUID();
      }
    }}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" data-testid="report-listing-button">
          <Flag className="h-4 w-4" />
          {ar ? 'الإبلاغ عن الإعلان' : 'Report listing'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ar ? 'الإبلاغ عن الإعلان' : 'Report this listing'}</DialogTitle>
          <DialogDescription>{ar ? 'اختر السبب وسيراجع فريقنا البلاغ. يلزم تسجيل الدخول وتأكيد الهاتف.' : 'Choose a reason and our team will review it. Sign-in and phone verification are required.'}</DialogDescription>
        </DialogHeader>
        {sent ? (
          <p className="rounded-lg border border-green-600/30 bg-green-500/10 p-4 text-sm font-medium text-green-800 dark:text-green-300" role="status">{ar ? 'تم استلام البلاغ. شكرًا لمساعدتنا.' : 'Report received. Thank you for helping us.'}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="report-listing-form">
            <div className="space-y-2">
              <Label htmlFor={`report-category-${listingPublicId}`}>{ar ? 'السبب' : 'Reason'}</Label>
              <select id={`report-category-${listingPublicId}`} name="category" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="WRONG_INFO">
                {CATEGORIES.map((category) => <option key={category} value={category}>{labels[category][locale]}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`report-details-${listingPublicId}`}>{ar ? 'التفاصيل (مطلوبة عند اختيار سبب آخر)' : 'Details (required for Other)'}</Label>
              <Textarea id={`report-details-${listingPublicId}`} name="details" maxLength={1000} rows={4} />
            </div>
            {error ? <p className="text-sm font-medium text-destructive" role="alert">{error}</p> : null}
            <DialogFooter><Button type="submit" disabled={pending}>{pending ? (ar ? 'جارٍ الإرسال…' : 'Submitting…') : (ar ? 'إرسال البلاغ' : 'Submit report')}</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
