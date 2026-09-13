import { Newspaper } from 'lucide-react';
import type { AppLocale } from '@/i18n/config';

export function NewsPlaceholder({ locale, fullPage = false }: { locale: AppLocale; fullPage?: boolean }) {
  const ar = locale === 'ar';

  return (
    <section
      aria-labelledby="car-news-heading"
      className={fullPage ? 'flex min-h-[55vh] items-center justify-center py-12' : undefined}
      data-testid="car-news-placeholder"
    >
      <div className="relative w-full overflow-hidden rounded-2xl border border-primary/15 bg-primary-soft p-7 shadow-xs sm:p-9">
        <div className="absolute -end-10 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-2xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-brand">
            <Newspaper className="h-7 w-7" />
          </span>
          <div>
            <h2 id="car-news-heading" className="text-xl font-black text-foreground sm:text-2xl">
              {ar ? 'أخبار السيارات' : 'Car News'}
            </h2>
            <p className="mt-1 text-sm leading-7 text-muted-foreground">
              {ar ? 'هذا القسم قيد التجهيز. سنضيف الأخبار والتغطيات المتخصصة قريباً.' : 'This section is being prepared. Automotive news and expert coverage are coming soon.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
