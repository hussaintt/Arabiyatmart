import Image from 'next/image';
import { ArrowLeft, ArrowRight, BadgePercent, BookOpenText, KeyRound, Scale, Store } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { RevealGrid } from '@/components/ui/reveal';
import type { AppLocale } from '@/i18n/config';

export function MarketplacePaths({ locale }: { locale: AppLocale }) {
  const ar = locale === 'ar';
  const ArrowIcon = ar ? ArrowLeft : ArrowRight;
  const paths = [
    {
      href: '/search?sellerType=PRIVATE',
      image: '/images/home-services/private-seller.png',
      title: ar ? 'شراء من المالك مباشرة' : 'Buy directly from owners',
      description: ar ? 'تواصل مباشر بدون عمولات' : 'Direct contact with no commission',
    },
    {
      href: '/search?sellerType=DEALER&condition=USED',
      image: '/images/home-services/used-cars.png',
      title: ar ? 'شراء مستعمل من معرض' : 'Buy used from a dealer',
      description: ar ? 'سيارات مستعملة من معارض موثوقة' : 'Used cars from trusted dealers',
    },
    {
      href: '/search?sellerType=DEALER&condition=NEW',
      image: '/images/home-services/new-cars.png',
      title: ar ? 'شراء سيارة زيرو' : 'Buy a new car',
      description: ar ? 'سيارات جديدة من الوكلاء والمعارض' : 'New cars from dealers and agents',
    },
  ];

  return (
    <section aria-labelledby="buying-paths-heading" className="space-y-5">
      <div className="max-w-2xl">
        <h2 id="buying-paths-heading" className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          {ar ? 'اختر الطريقة المناسبة لشراء سيارتك' : 'Choose how you want to buy'}
        </h2>
        <p className="mt-1 text-sm leading-7 text-muted-foreground">
          {ar ? 'وصول أسرع للسيارات المناسبة من المالك أو المعرض أو الوكيل.' : 'A faster path to the right car from an owner, dealer, or agent.'}
        </p>
      </div>

      <RevealGrid className="grid gap-4 md:grid-cols-3">
        {paths.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            locale={locale}
            className="group relative block h-full min-h-[270px] overflow-hidden rounded-2xl border border-white/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Image src={item.image} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-b from-card/95 via-card/30 to-primary-dark/45" aria-hidden="true" />
            <div className="relative z-10 flex h-full min-h-[270px] flex-col p-5">
              <h3 className="text-lg font-black text-foreground">{item.title}</h3>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{item.description}</p>
              <span className="mt-auto flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-brand transition-transform duration-200 group-hover:-translate-x-1 rtl:group-hover:translate-x-1">
                <ArrowIcon className="h-5 w-5" />
              </span>
            </div>
          </Link>
        ))}
      </RevealGrid>
    </section>
  );
}

export function QuickActions({ locale }: { locale: AppLocale }) {
  const ar = locale === 'ar';
  const actions = [
    { href: '/compare', label: ar ? 'مقارنة السيارات' : 'Compare cars', icon: Scale },
    { href: '/best-offer', label: ar ? 'أفضل عرض' : 'Best offer', icon: BadgePercent },
    { href: '/dealers', label: ar ? 'معارض السيارات' : 'Dealers', icon: Store },
    { href: '/sell', label: ar ? 'بيع سيارتك' : 'Sell your car', icon: KeyRound },
    { href: '/catalogue/makes', label: ar ? 'دليل السيارات' : 'Car guide', icon: BookOpenText },
  ];

  return (
    <section aria-label={ar ? 'خدمات سريعة' : 'Quick services'}>
      <RevealGrid className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            locale={locale}
            className="group flex h-full min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-white/80 bg-card px-3 py-5 text-center shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary transition-transform duration-200 group-hover:scale-110">
              <Icon className="h-6 w-6" />
            </span>
            <span className="text-sm font-black text-foreground group-hover:text-primary">{label}</span>
          </Link>
        ))}
      </RevealGrid>
    </section>
  );
}
