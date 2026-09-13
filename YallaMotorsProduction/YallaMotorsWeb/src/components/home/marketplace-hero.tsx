import Image from 'next/image';
import { ArrowLeft, ArrowRight, Check, MapPin } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { HeroSearch } from './hero-search';
import type { AppLocale } from '@/i18n/config';
import type { SpotlightItem } from '@/types/taxonomy';

export function MarketplaceHero({ spotlight, locale }: { spotlight: SpotlightItem[]; locale: AppLocale }) {
  const ar = locale === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const seedSuggestions = spotlight.map((item) => ({
    type: 'MODEL' as const,
    label: `${item.makeName[locale] ?? item.makeSlug} ${item.modelName[locale] ?? item.modelSlug}`,
    makeSlug: item.makeSlug,
    modelSlug: item.modelSlug,
    comparisonRef: null,
  }));

  return (
    <section aria-labelledby="home-heading" className="home-hero">
      <div className="home-hero-scene">
        <div className="home-hero-photo">
          <Image src="/images/marketplace-hero.webp" alt="" fill priority sizes="(max-width: 767px) 100vw, 75vw" className="object-cover" />
        </div>
        <div className="home-hero-shade" aria-hidden="true" />
        <div className="home-container relative z-10">
          <div className="home-hero-copy">
            <p className="home-hero-eyebrow"><span />{ar ? 'رحلتك القادمة تبدأ هنا' : 'YOUR NEXT CHAPTER STARTS HERE'}</p>
            <h1 id="home-heading">{ar ? 'سيارتك القادمة.' : 'Your next car.'}<br /><span>{ar ? 'بداية لحكاية جديدة.' : 'A whole new journey.'}</span></h1>
            <p className="home-hero-description">{ar ? 'اكتشف الجديد والمستعمل، قارن اختياراتك، وتواصل مع البائع مباشرة. كل ما تحتاجه لسيارتك القادمة، في مكان واحد.' : 'Discover new and used cars, compare your favourites, and connect with sellers. Your next move starts with the right car.'}</p>
            <Link href="/search" locale={locale} className="home-hero-link">{ar ? 'اكتشف السيارات' : 'Explore the marketplace'}<Arrow size={18} /></Link>
            <div className="home-hero-benefits">
              <span><Check size={15} />{ar ? 'جديد ومستعمل' : 'New & used cars'}</span>
              <span><Check size={15} />{ar ? 'تواصل مباشر' : 'Direct seller contact'}</span>
            </div>
          </div>
        </div>
        <div className="home-hero-caption"><MapPin size={14} />{ar ? 'اختيارات لكل طريق' : 'Made for your next adventure'}</div>
      </div>
      <div className="home-container home-search-container">
        <HeroSearch locale={locale} seedSuggestions={seedSuggestions} />
      </div>
    </section>
  );
}
