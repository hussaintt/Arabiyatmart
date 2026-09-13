'use client';

import { useId, useState } from 'react';
import { ArrowLeft, ArrowRight, CarFront, RefreshCw } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { ListingGrid } from '@/components/listing/listing-grid';
import type { ListingCard } from '@/types/listing';
import type { AppLocale } from '@/i18n/config';

export function HomeInventory({ latest, popular, unavailable, locale }: {
  latest: ListingCard[]; popular: ListingCard[]; unavailable: { latest: boolean; popular: boolean }; locale: AppLocale;
}) {
  const ar = locale === 'ar';
  const [selection, setSelection] = useState<'latest' | 'popular'>('latest');
  const id = useId();
  const listings = selection === 'latest' ? latest : popular;
  const failed = unavailable[selection];
  const href = `/search?sort=${selection === 'latest' ? 'newest' : 'most_viewed'}`;
  const labels = { latest: ar ? 'أحدث الإعلانات' : 'Latest arrivals', popular: ar ? 'الأكثر مشاهدة' : 'Most viewed' };

  return <section className="home-section home-inventory" aria-labelledby="inventory-heading">
    <div className="home-section-heading"><div><p className="home-eyebrow">{ar ? 'اكتشف اختياراتك' : 'THE SEARCH GETS INTERESTING'}</p><h2 id="inventory-heading">{ar ? 'سيارتك الجاية مستنياك.' : 'Find a car you’ll love.'}</h2><p className="home-section-description">{ar ? 'استكشف السيارات المعروضة وتواصل مع البائع المناسب لك.' : 'Explore the listings. Discover the possibilities. Make your next move.'}</p></div><Link href={href} locale={locale} className="home-text-link">{ar ? 'تصفح كل السيارات' : 'Browse all cars'}{ar ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}</Link></div>
    <div className="home-inventory-toolbar"><div className="home-inventory-tabs" role="tablist" aria-label={ar ? 'ترتيب السيارات' : 'Vehicle collections'}>{(['latest', 'popular'] as const).map((key, index, keys) => <button type="button" key={key} role="tab" id={`${id}-${key}`} aria-controls={`${id}-panel`} aria-selected={selection === key} tabIndex={selection === key ? 0 : -1} onClick={() => setSelection(key)} onKeyDown={event => {
      let next: 'latest' | 'popular' | undefined;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = keys[(index + 1) % keys.length];
      if (event.key === 'Home') next = 'latest';
      if (event.key === 'End') next = 'popular';
      if (next) { event.preventDefault(); setSelection(next); document.getElementById(`${id}-${next}`)?.focus(); }
    }}>{labels[key]}</button>)}</div><span className="home-inventory-note">{ar ? 'اختيارات جديدة لكل مشوار' : 'Your next journey, your choice'}</span></div>
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${selection}`} tabIndex={0} className="home-inventory-panel">
      {listings.length > 0 ? <ListingGrid listings={listings.slice(0, 8)} locale={locale} columns={4} priorityCount={0} /> : <div className="home-inventory-empty" role="status"><div className="home-empty-icon"><CarFront size={38} strokeWidth={1.25} /></div><div><p className="home-eyebrow">{failed ? (ar ? 'نحاول الوصول للسيارات' : 'A QUICK PIT STOP') : (ar ? 'مساحة لرحلة جديدة' : 'ROOM FOR A NEW JOURNEY')}</p><h3>{failed ? (ar ? 'الإعلانات غير متاحة مؤقتاً' : 'Listings are temporarily unavailable') : (ar ? 'السيارات الجديدة في الطريق' : 'New possibilities are on the way')}</h3><p>{failed ? (ar ? 'تعذر تحميل السيارات الآن. حاول مرة أخرى، أو استكشف دليل السيارات.' : 'We couldn’t load the cars right now. Try again, or explore the car guide in the meantime.') : (ar ? 'لا توجد إعلانات في هذا القسم حالياً. استكشف السوق أو ابدأ بإعلان سيارتك.' : 'There are no listings in this collection yet. Explore the marketplace or give your own car its next chapter.')}</p><div className="home-empty-actions">{failed ? <a href={`/${locale}`} className="home-text-link"><RefreshCw size={16} />{ar ? 'حاول مرة أخرى' : 'Try again'}</a> : <Link href="/sell" locale={locale} prefetch={false} className="home-text-link">{ar ? 'أضف إعلان سيارتك' : 'List your car'}</Link>}<Link href="/catalogue/makes" locale={locale} className="home-text-link">{ar ? 'استكشف دليل السيارات' : 'Explore the car guide'}{ar ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}</Link></div></div></div>}
    </div>
  </section>;
}
