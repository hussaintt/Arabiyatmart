import { Link } from '@/i18n/routing';
import type { AppLocale } from '@/i18n/config';

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

interface LegalDocumentProps {
  locale: AppLocale;
  title: string;
  summary: string;
  updatedLabel: string;
  sections: LegalSection[];
}

export function LegalDocument({ locale, title, summary, updatedLabel, sections }: LegalDocumentProps) {
  const ar = locale === 'ar';

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <header className="border-b border-line bg-primary-soft px-6 py-8 sm:px-10 sm:py-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Arabiyatmart</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{summary}</p>
          <p className="mt-4 text-xs font-semibold text-primary">{updatedLabel}</p>
        </header>

        <div className="space-y-9 px-6 py-8 sm:px-10 sm:py-10">
          {sections.map((section, index) => (
            <section key={section.title} aria-labelledby={`legal-section-${index}`} className="scroll-mt-28">
              <h2 id={`legal-section-${index}`} className="text-xl font-black text-foreground">
                {section.title}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-sm leading-8 text-muted-foreground sm:text-base">
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="mt-3 list-disc space-y-2 ps-5 text-sm leading-8 text-muted-foreground sm:text-base">
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <div className="border-t border-line px-6 py-5 sm:px-10">
          <Link href="/" locale={locale} className="text-sm font-bold text-primary hover:underline">
            {ar ? 'العودة إلى الرئيسية' : 'Back to home'}
          </Link>
        </div>
      </div>
    </main>
  );
}
