'use client';

import * as React from 'react';
import { MessageSquareText, Send } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createContactLead } from '@/server/actions/leads';
import type { AppLocale } from '@/i18n/config';
import { trackAnalytics } from '@/lib/analytics/client';

interface CreateLeadDialogProps {
  listingPublicId: string;
  locale: AppLocale;
  compact?: boolean;
}

export function CreateLeadDialog({ listingPublicId, locale, compact = false }: CreateLeadDialogProps) {
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
    const buyerName = String(form.get('buyerName') ?? '').trim();
    const buyerPhone = String(form.get('buyerPhone') ?? '').trim();
    const note = String(form.get('note') ?? '').trim();
    const result = await createContactLead(
      {
        listingPublicId,
        channel: 'CHAT',
        buyerName: buyerName || null,
        buyerPhone: buyerPhone || null,
        note: note || null,
        meta: null,
      },
      idempotencyKey.current,
    );
    setPending(false);
    if (!result.ok) {
      trackAnalytics({ name: 'lead_outcome', operation: 'create', channel: 'message', outcome: 'failed', code: result.error.code, status: result.error.status, requestId: result.error.requestId });
      setError(result.error.fieldErrors[0]?.message ?? (ar ? 'تعذّر إرسال الرسالة' : 'The message could not be sent'));
      return;
    }
    trackAnalytics({ name: 'lead_outcome', operation: 'create', channel: 'message', outcome: 'succeeded' });
    setSent(true);
  }

  function handleOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) {
      setError(null);
      setSent(false);
      idempotencyKey.current = crypto.randomUUID();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size={compact ? 'sm' : 'lg'} className="w-full gap-2 font-bold" data-testid={`${compact ? 'mobile' : 'desktop'}-message-button`}>
          <MessageSquareText className="h-4 w-4" />
          <span>{ar ? 'إرسال رسالة' : 'Send Message'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ar ? 'راسل البائع' : 'Message the seller'}</DialogTitle>
          <DialogDescription>
            {ar ? 'أرسل استفسارك مباشرة. لا تتم أي عروض أسعار أو عمليات بيع داخل الموقع.' : 'Send your inquiry directly. Price offers and sales are not handled on the website.'}
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="rounded-lg border border-green-600/30 bg-green-500/10 p-4 text-sm font-medium text-green-800 dark:text-green-300" role="status">
            {ar ? 'تم إرسال رسالتك إلى البائع.' : 'Your message was sent to the seller.'}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="create-lead-form">
            <div className="space-y-2">
              <Label htmlFor={`lead-name-${listingPublicId}`}>{ar ? 'الاسم (اختياري)' : 'Name (optional)'}</Label>
              <Input id={`lead-name-${listingPublicId}`} name="buyerName" maxLength={160} autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`lead-phone-${listingPublicId}`}>{ar ? 'رقم الهاتف (اختياري)' : 'Phone number (optional)'}</Label>
              <Input id={`lead-phone-${listingPublicId}`} name="buyerPhone" type="tel" inputMode="tel" maxLength={32} autoComplete="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`lead-note-${listingPublicId}`}>{ar ? 'رسالتك' : 'Your message'}</Label>
              <Textarea id={`lead-note-${listingPublicId}`} name="note" maxLength={1000} required rows={5} />
            </div>
            {error ? <p className="text-sm font-medium text-destructive" role="alert">{error}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={pending} className="gap-2">
                <Send className="h-4 w-4" />
                {pending ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : (ar ? 'إرسال' : 'Send')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
