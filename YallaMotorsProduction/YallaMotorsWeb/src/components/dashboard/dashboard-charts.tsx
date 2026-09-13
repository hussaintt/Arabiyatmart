import * as React from 'react';
import { Phone, MessageCircle, MessageSquareText, BadgePercent, Shield, TrendingUp, Users } from 'lucide-react';
import type { AppLocale } from '@/i18n/config';

interface DashboardChartsProps {
  leadsByChannel: Record<string, number>;
  locale: AppLocale;
}

const CHANNEL_CONFIG: Record<
  string,
  { ar: string; en: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  WHATSAPP: {
    ar: 'محادثات واتساب المباشرة',
    en: 'Direct WhatsApp Chats',
    icon: MessageCircle,
    color: 'bg-green-500',
  },
  CALL_REVEAL: {
    ar: 'إظهار رقم الهاتف والاتصال',
    en: 'Phone Call Reveals',
    icon: Phone,
    color: 'bg-blue-500',
  },
  CHAT: {
    ar: 'رسائل واستفسارات الموقع',
    en: 'Direct In-App Messages',
    icon: MessageSquareText,
    color: 'bg-primary',
  },
  FINANCE_REQUEST: {
    ar: 'طلبات التمويل والتقسيط الشريكة',
    en: 'Partner Financing Inquiries',
    icon: BadgePercent,
    color: 'bg-amber-500',
  },
  INSURANCE_REQUEST: {
    ar: 'طلبات عروض وثائق التأمين',
    en: 'Insurance Policy Quotes',
    icon: Shield,
    color: 'bg-emerald-600',
  },
};

export function DashboardCharts({ leadsByChannel, locale }: DashboardChartsProps) {
  const ar = locale === 'ar';
  const entries = Object.entries(leadsByChannel).sort((a, b) => b[1] - a[1]);
  const totalInquiries = entries.reduce((acc, [, count]) => acc + count, 0);
  const max = Math.max(1, ...entries.map(([, count]) => count));

  // Partner high-intent leads count
  const partnerLeadsCount =
    (leadsByChannel['FINANCE_REQUEST'] || 0) + (leadsByChannel['INSURANCE_REQUEST'] || 0);

  return (
    <section className="rounded-xl border bg-card p-5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {ar ? 'طلبات التواصل حسب القناة' : 'Inquiries by channel'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ar
              ? 'توزيع استفسارات المشترين المؤكدة حسب نقطة الاتصال والخدمات الشريكة'
              : 'Breakdown of buyer inquiries across contact channels and partner requests'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-primary text-xs font-semibold">
            <Users className="h-4 w-4" />
            <span>
              {ar ? `${totalInquiries} استفسار إجمالي` : `${totalInquiries} Total Leads`}
            </span>
          </div>
          {partnerLeadsCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <TrendingUp className="h-4 w-4" />
              <span>
                {ar ? `${partnerLeadsCount} طلب مؤهل شريك` : `${partnerLeadsCount} Partner Qualified`}
              </span>
            </div>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {ar ? 'لا توجد استفسارات مسجلة خلال هذه الفترة.' : 'No buyer inquiries recorded in this period.'}
        </p>
      ) : (
        <>
          <div className="space-y-4" aria-hidden="true">
            {entries.map(([channel, count]) => {
              const conf = CHANNEL_CONFIG[channel];
              const label = conf ? (ar ? conf.ar : conf.en) : channel;
              const Icon = conf?.icon || MessageSquareText;
              const barColor = conf?.color || 'bg-primary';
              const percent = Math.round((count / (totalInquiries || 1)) * 100);

              return (
                <div key={channel} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{label}</span>
                    </span>
                    <div className="flex items-center gap-2 tabular-nums text-xs">
                      <span className="text-muted-foreground">({percent}%)</span>
                      <span className="font-bold text-foreground text-sm">{count}</span>
                    </div>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${barColor} transition-all duration-300`}
                      style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <table className="sr-only">
            <caption>{ar ? 'جدول طلبات التواصل حسب القناة' : 'Inquiry totals by channel'}</caption>
            <thead>
              <tr>
                <th>{ar ? 'القناة' : 'Channel'}</th>
                <th>{ar ? 'العدد' : 'Count'}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([channel, count]) => (
                <tr key={channel}>
                  <td>{channel}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
