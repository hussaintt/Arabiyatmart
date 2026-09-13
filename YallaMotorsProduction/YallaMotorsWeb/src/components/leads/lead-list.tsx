import { MessageSquareText, Phone, ExternalLink } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AppLocale } from '@/i18n/config';
import type { Lead, LeadChannel, LeadStatus } from '@/types/lead';

const statusLabels: Record<LeadStatus, { ar: string; en: string }> = {
  NEW: { ar: 'جديد', en: 'New' },
  CONTACTED: { ar: 'تم التواصل', en: 'Contacted' },
  QUALIFIED: { ar: 'مهتم', en: 'Qualified' },
  WON: { ar: 'تمت المتابعة', en: 'Completed' },
  LOST: { ar: 'لم يكتمل', en: 'Closed' },
  SPAM: { ar: 'غير مرغوب', en: 'Spam' },
};

const channelLabels: Record<LeadChannel, { ar: string; en: string }> = {
  CALL_REVEAL: { ar: 'اتصال', en: 'Phone call' },
  WHATSAPP: { ar: 'واتساب', en: 'WhatsApp' },
  CHAT: { ar: 'رسالة', en: 'Message' },
  CALLBACK_FORM: { ar: 'طلب اتصال', en: 'Callback' },
  FINANCE_REQUEST: { ar: 'تمويل', en: 'Finance' },
  INSURANCE_REQUEST: { ar: 'تأمين', en: 'Insurance' },
  TEST_DRIVE: { ar: 'تجربة قيادة', en: 'Test drive' },
  INSPECTION: { ar: 'فحص', en: 'Inspection' },
};

export function localizedLeadStatus(status: LeadStatus, locale: AppLocale): string {
  return statusLabels[status][locale];
}

export function localizedLeadChannel(channel: LeadChannel, locale: AppLocale): string {
  return channelLabels[channel][locale];
}

export function LeadList({ leads, locale }: { leads: Lead[]; locale: AppLocale }) {
  const ar = locale === 'ar';
  if (leads.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center" data-testid="leads-empty">
        <MessageSquareText className="mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{ar ? 'لا توجد طلبات تواصل بعد' : 'No buyer inquiries yet'}</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{ar ? 'ستظهر هنا الاتصالات ورسائل واتساب والرسائل المرتبطة بإعلاناتك.' : 'Calls, WhatsApp contacts, and messages connected to your listings will appear here.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="lead-list">
      {leads.map((lead) => (
        <article key={lead.publicId} className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={lead.status === 'NEW' ? 'default' : 'secondary'}>{localizedLeadStatus(lead.status, locale)}</Badge>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  {lead.channel === 'CALL_REVEAL' ? <Phone className="h-3.5 w-3.5" /> : <MessageSquareText className="h-3.5 w-3.5" />}
                  {localizedLeadChannel(lead.channel, locale)}
                </span>
              </div>
              <h2 className="truncate text-base font-bold">{lead.listing.title}</h2>
              <p className="text-sm text-muted-foreground">
                {lead.buyerName || (ar ? 'مشتري مهتم' : 'Interested buyer')}
                {lead.createdAt ? ` · ${new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium' }).format(new Date(lead.createdAt))}` : ''}
              </p>
              {lead.note ? <p className="line-clamp-2 text-sm">{lead.note}</p> : null}
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href={`/me/leads/${lead.publicId}`} locale={locale}>
                {ar ? 'عرض التفاصيل' : 'View details'}
                <ExternalLink className="ms-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
