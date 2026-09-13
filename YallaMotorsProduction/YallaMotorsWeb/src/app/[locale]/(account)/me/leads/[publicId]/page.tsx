import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ArrowLeft, ArrowRight, MessageSquareText, Phone } from 'lucide-react';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { serverEnv } from '@/lib/env/server';
import { ApiContractError } from '@/lib/api/error';
import { getSellerLead } from '@/server/queries/leads';
import { localizedLeadChannel, localizedLeadStatus } from '@/components/leads/lead-list';
import { LeadStatusForm } from '@/components/leads/lead-status-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface LeadDetailPageProps { params: Promise<{ locale: string; publicId: string }> }

export async function generateMetadata({ params }: LeadDetailPageProps): Promise<Metadata> {
  const { locale, publicId } = await params;
  if (!isAppLocale(locale)) return {};
  return {
    title: locale === 'ar' ? 'تفاصيل طلب التواصل | عربيات مارت' : 'Inquiry Details | Arabiyat Mart',
    robots: { index: false, follow: false },
    alternates: { canonical: `${serverEnv.SITE_ORIGIN}/${locale}/me/leads/${encodeURIComponent(publicId)}` },
  };
}

function safePhone(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[\s\-().]/g, '');
  return /^\+?[0-9]{7,15}$/.test(cleaned) ? cleaned : null;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { locale: rawLocale, publicId } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale: AppLocale = rawLocale;
  setRequestLocale(locale);
  const ar = locale === 'ar';
  let response;
  try {
    response = await getSellerLead(publicId);
  } catch (error) {
    if (error instanceof ApiContractError && error.body.error.status === 404) notFound();
    throw error;
  }
  const lead = response.data;
  const phone = safePhone(lead.buyerPhone ?? lead.buyer?.phone ?? null);
  const BackIcon = ar ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6" data-testid="lead-detail-page">
      <Button asChild variant="ghost" size="sm"><Link href="/me/leads" locale={locale}><BackIcon className="me-2 h-4 w-4" />{ar ? 'العودة إلى الطلبات' : 'Back to inquiries'}</Link></Button>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2"><Badge>{localizedLeadStatus(lead.status, locale)}</Badge><span className="text-sm text-muted-foreground">{localizedLeadChannel(lead.channel, locale)}</span></div>
        <h1 className="text-2xl font-bold sm:text-3xl">{lead.listing.title}</h1>
        <Link href={`/listing/${lead.listing.slug}`} locale={locale} className="text-sm font-medium text-primary hover:underline">{ar ? 'فتح الإعلان' : 'Open listing'}</Link>
      </header>
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="space-y-5 rounded-xl border bg-card p-5 lg:col-span-3">
          <div><p className="text-xs font-medium text-muted-foreground">{ar ? 'المشتري' : 'Buyer'}</p><p className="mt-1 font-semibold">{lead.buyerName || (ar ? 'مشتري مهتم' : 'Interested buyer')}</p></div>
          {phone ? <a href={`tel:${phone}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 font-semibold text-primary hover:bg-muted"><Phone className="h-4 w-4" />{phone}</a> : <p className="text-sm text-muted-foreground">{ar ? 'لم يشارك المشتري رقم هاتف.' : 'The buyer did not share a phone number.'}</p>}
          {lead.note ? <div className="rounded-lg bg-muted/60 p-4"><p className="mb-1 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground"><MessageSquareText className="h-4 w-4" />{ar ? 'الرسالة' : 'Message'}</p><p className="whitespace-pre-wrap text-sm">{lead.note}</p></div> : null}
          {lead.events.length > 0 ? <div><h2 className="mb-3 font-bold">{ar ? 'سجل النشاط' : 'Activity'}</h2><ol className="space-y-3 border-s ps-4">{lead.events.map((event, index) => <li key={`${event.type}-${event.createdAt ?? index}`} className="text-sm"><p className="font-medium">{event.type}</p>{event.createdAt ? <time className="text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.createdAt))}</time> : null}</li>)}</ol></div> : null}
        </section>
        <aside className="lg:col-span-2"><LeadStatusForm publicId={lead.publicId} initialStatus={lead.status} locale={locale} /></aside>
      </div>
    </div>
  );
}
