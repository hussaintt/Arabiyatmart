'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateSellerLeadStatus } from '@/server/actions/leads';
import type { AppLocale } from '@/i18n/config';
import type { LeadStatus } from '@/types/lead';

const nextStatuses: Exclude<LeadStatus, 'NEW'>[] = ['CONTACTED', 'QUALIFIED', 'WON', 'LOST', 'SPAM'];

export function LeadStatusForm({ publicId, initialStatus, locale }: { publicId: string; initialStatus: LeadStatus; locale: AppLocale }) {
  const ar = locale === 'ar';
  const [status, setStatus] = React.useState<LeadStatus>(initialStatus);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || status === 'NEW') return;
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const note = String(form.get('note') ?? '').trim();
    const result = await updateSellerLeadStatus(publicId, { status, note: note || null }, crypto.randomUUID());
    setPending(false);
    setMessage(result.ok ? (ar ? 'تم تحديث حالة الطلب.' : 'Inquiry status updated.') : (result.error.fieldErrors[0]?.message ?? (ar ? 'تعذّر تحديث الحالة.' : 'Status could not be updated.')));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-5" data-testid="lead-status-form">
      <h2 className="font-bold">{ar ? 'متابعة الطلب' : 'Manage inquiry'}</h2>
      <div className="space-y-2">
        <Label htmlFor="lead-status">{ar ? 'الحالة' : 'Status'}</Label>
        <select id="lead-status" value={status} onChange={(event) => setStatus(event.target.value as LeadStatus)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          {initialStatus === 'NEW' ? <option value="NEW" disabled>{ar ? 'جديد' : 'New'}</option> : null}
          {nextStatuses.map((value) => <option key={value} value={value}>{value === 'CONTACTED' ? (ar ? 'تم التواصل' : 'Contacted') : value === 'QUALIFIED' ? (ar ? 'مهتم' : 'Qualified') : value === 'WON' ? (ar ? 'تمت المتابعة' : 'Completed') : value === 'LOST' ? (ar ? 'لم يكتمل' : 'Closed') : (ar ? 'غير مرغوب' : 'Spam')}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="lead-status-note">{ar ? 'ملاحظة داخلية (اختياري)' : 'Internal note (optional)'}</Label>
        <Textarea id="lead-status-note" name="note" maxLength={1000} rows={3} />
      </div>
      {message ? <p className="text-sm" role="status">{message}</p> : null}
      <Button type="submit" disabled={pending || status === 'NEW'}>{pending ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ الحالة' : 'Save status')}</Button>
    </form>
  );
}
