import { ArrowLeft, ArrowRight, CarFront, ChevronDown, Heart, KeyRound, ListChecks, MessagesSquare, Scale, Search, Store, Tag } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Reveal, RevealGrid } from '@/components/ui/reveal';
import type { AppLocale } from '@/i18n/config';

export function SectionHeading({ id, eyebrow, title, description, href, linkLabel, locale }: {
  id: string; eyebrow: string; title: string; description?: string; href?: string; linkLabel?: string; locale: AppLocale;
}) {
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  return <div className="home-section-heading">
    <div><p className="home-eyebrow">{eyebrow}</p><h2 id={id}>{title}</h2>{description && <p className="home-section-description">{description}</p>}</div>
    {href && <Link className="home-text-link" href={href} locale={locale}>{linkLabel}<Arrow size={17} /></Link>}
  </div>;
}

export function BrandDiscovery({ locale }: { locale: AppLocale }) {
  const ar = locale === 'ar';
  const brands = [
    { slug: 'toyota', name: 'TOYOTA', ar: 'تويوتا' },
    { slug: 'hyundai', name: 'HYUNDAI', ar: 'هيونداي' },
    { slug: 'kia', name: 'Kia', ar: 'كيا' },
    { slug: 'mercedes-benz', name: 'Mercedes-Benz', ar: 'مرسيدس بنز' },
    { slug: 'bmw', name: 'BMW', ar: 'بي إم دبليو' },
    { slug: 'nissan', name: 'NISSAN', ar: 'نيسان' },
  ];
  return <section className="home-brands" aria-labelledby="brands-heading">
    <div className="home-brand-intro"><h2 id="brands-heading">{ar ? 'ابدأ بماركتك المفضلة' : 'Start with your favourite brand'}</h2><Link href="/catalogue/makes" locale={locale} className="home-text-link">{ar ? 'جميع الماركات' : 'View all brands'}{ar ? <ArrowLeft size={15} /> : <ArrowRight size={15} />}</Link></div>
    <RevealGrid className="home-brand-grid">{brands.map(brand => <Link key={brand.slug} href={`/search?makeSlug=${brand.slug}`} locale={locale} className="home-brand" aria-label={ar ? `تصفح سيارات ${brand.ar}` : `Browse ${brand.name} cars`}><span lang="en" dir="ltr">{brand.name}</span><span>{ar ? brand.ar : 'Explore cars'}</span></Link>)}</RevealGrid>
  </section>;
}

export function ShoppingCollections({ locale }: { locale: AppLocale }) {
  const ar = locale === 'ar';
  const Arrow = ar ? ArrowLeft : ArrowRight;
  const collections = [
    { icon: CarFront, href: '/search?condition=NEW', tag: ar ? 'البداية الأولى' : 'A FRESH START', title: ar ? 'إحساس العربية الزيرو' : 'That new-car feeling', description: ar ? 'اكتشف السيارات الجديدة واختر أول طريق ليها.' : 'Explore new cars. Be the first to make it yours.', action: ar ? 'تصفح الجديد' : 'Shop new cars', number: '01' },
    { icon: Tag, href: '/search?condition=USED', tag: ar ? 'اختيار ذكي' : 'MORE POSSIBILITIES', title: ar ? 'سيارة تناسب ميزانيتك' : 'Great cars. Smart choices.', description: ar ? 'تصفح المستعمل وقارن الأسعار والمواصفات بسهولة.' : 'Find a used car that fits your life and your budget.', action: ar ? 'تصفح المستعمل' : 'Shop used cars', number: '02' },
    { icon: Store, href: '/dealers', tag: ar ? 'اعرف البائع' : 'MEET YOUR NEXT DEALER', title: ar ? 'المعرض المناسب أقرب لك' : 'Find your local showroom', description: ar ? 'اعرف المعارض، شوف سياراتهم، وتواصل معاهم مباشرة.' : 'Get to know the dealers and explore their inventory.', action: ar ? 'اكتشف المعارض' : 'Explore dealerships', number: '03' },
  ];
  return <section aria-labelledby="collections-heading" className="home-section">
    <SectionHeading id="collections-heading" eyebrow={ar ? 'اختيارات على مقاسك' : 'FIND YOUR DIRECTION'} title={ar ? 'لكل مشوار، السيارة المناسبة.' : 'A car for every kind of journey.'} locale={locale} />
    <RevealGrid className="home-collection-grid">{collections.map(({ icon: Icon, ...item }) => <Link key={item.href} href={item.href} locale={locale} className="home-collection"><div className="home-collection-top"><Icon size={28} strokeWidth={1.5} /><span>{item.number}</span></div><p className="home-eyebrow">{item.tag}</p><h3>{item.title}</h3><p>{item.description}</p><span className="home-collection-link">{item.action}<Arrow size={18} /></span></Link>)}</RevealGrid>
  </section>;
}

export function OwnershipTools({ locale }: { locale: AppLocale }) {
  const ar = locale === 'ar';
  const tools = [
    { icon: Scale, href: '/compare', title: ar ? 'قارن قبل ما تختار' : 'Compare your shortlist', description: ar ? 'المواصفات والأسعار، جنب بعض.' : 'See specifications and prices side by side.' },
    { icon: Heart, href: '/favorites', title: ar ? 'احتفظ باختياراتك' : 'Keep your favourites close', description: ar ? 'احفظ السيارات وارجع لها في أي وقت.' : 'Save the cars you love and come back anytime.' },
    { icon: ListChecks, href: '/catalogue/makes', title: ar ? 'اعرف كل التفاصيل' : 'Get to know every detail', description: ar ? 'استكشف الموديلات والفئات والمواصفات.' : 'Explore models, trims, and specifications.' },
  ];
  return <section aria-labelledby="tools-heading" className="home-section">
    <SectionHeading id="tools-heading" eyebrow={ar ? 'اختيارك، بثقة أكبر' : 'A LITTLE CLARITY GOES A LONG WAY'} title={ar ? 'كل التفاصيل. قرار أوضح.' : 'Less guesswork. More confidence.'} locale={locale} />
    <RevealGrid className="home-tools-grid">{tools.map(({ icon: Icon, ...item }) => <Link key={item.href} href={item.href} locale={locale} prefetch={item.href !== '/favorites'} className="home-tool"><span className="home-tool-icon"><Icon size={23} strokeWidth={1.6} /></span><div><h3>{item.title}</h3><p>{item.description}</p></div>{ar ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}</Link>)}</RevealGrid>
  </section>;
}

export function SellCarSection({ locale }: { locale: AppLocale }) {
  const ar = locale === 'ar';
  const steps = [
    { icon: CarFront, title: ar ? 'عرّفنا بسيارتك' : 'Tell us about your car', description: ar ? 'أضف المواصفات، السعر، وصور واضحة.' : 'Add the details, your price, and clear photos.' },
    { icon: Search, title: ar ? 'خلّي المشترين يلاقوك' : 'Give your car a place to shine', description: ar ? 'جهّز إعلانك وقدّمه للنشر على السوق.' : 'Prepare your listing and submit it to the marketplace.' },
    { icon: MessagesSquare, title: ar ? 'تواصل واتفق' : 'Make the connection', description: ar ? 'رد على الاستفسارات ورتّب المعاينة مباشرة.' : 'Answer enquiries and arrange a viewing directly.' },
  ];
  return <Reveal><section className="home-sell" aria-labelledby="sell-heading"><div className="home-sell-copy"><p className="home-eyebrow">{ar ? 'دور عربيتك تبدأ حكاية جديدة' : 'TIME FOR YOUR NEXT CHAPTER?'}</p><h2 id="sell-heading">{ar ? 'سيارتك تستاهل' : 'Your car deserves'}<br />{ar ? 'مشتريها المناسب.' : 'its next great owner.'}</h2><p>{ar ? 'من أول صورة لحد أول مكالمة، ابدأ رحلة بيع سيارتك بخطوات واضحة وبسيطة.' : 'From the first photo to the first conversation. Start selling with a few simple steps.'}</p><Link href="/sell" prefetch={false} locale={locale} className="home-primary-button"><KeyRound size={18} />{ar ? 'ابدأ بيع سيارتك' : 'Start selling your car'}{ar ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}</Link></div><ol className="home-sell-steps">{steps.map(({ icon: Icon, ...step }, index) => <li key={step.title}><span className="home-step-number">{String(index + 1).padStart(2, '0')}</span><div><h3><Icon size={17} />{step.title}</h3><p>{step.description}</p></div></li>)}</ol></section></Reveal>;
}

export function HomeFaq({ locale }: { locale: AppLocale }) {
  const ar = locale === 'ar';
  const questions = [
    { q: ar ? 'إزاي ألاقي السيارة المناسبة؟' : 'How do I find the right car?', a: ar ? 'ابدأ بالبحث عن الماركة أو الموديل وحدد الجديد أو المستعمل وميزانيتك. في صفحة النتائج، تقدر تضيف فلاتر للموقع وسنة الصنع والممشى والمواصفات.' : 'Search by make or model, choose new or used, and set your budget. On the results page, narrow your search by location, year, mileage, and specifications.' },
    { q: ar ? 'إزاي أتواصل مع البائع؟' : 'How do I contact a seller?', a: ar ? 'افتح إعلان السيارة لمشاهدة تفاصيلها ووسائل التواصل المتاحة. تواصل مع البائع مباشرة لترتيب المعاينة والاستفسار عن السيارة.' : 'Open a vehicle listing to see its details and available contact options. Connect directly with the seller to ask questions and arrange a viewing.' },
    { q: ar ? 'أقدر أقارن بين السيارات؟' : 'Can I compare cars before deciding?', a: ar ? 'استخدم أداة مقارنة السيارات لاختيار الموديلات ومراجعة المواصفات جنب بعض، واحفظ الإعلانات التي تعجبك في المفضلة للرجوع لها لاحقاً.' : 'Use the car comparison tool to review models and specifications side by side. Save listings to your favourites so you can return to them later.' },
    { q: ar ? 'إيه المطلوب عشان أعلن عن سيارتي؟' : 'What do I need to list my car?', a: ar ? 'سجّل الدخول، واختر «بيع سيارتك». جهّز بيانات السيارة ومواصفاتها، السعر، صور واضحة، ومعلومات التواصل والموقع، ثم راجع الإعلان وقدّمه للنشر.' : 'Sign in and choose “Sell your car”. Have your vehicle details, asking price, clear photos, contact information, and location ready, then review and submit your listing.' },
  ];
  return <section className="home-faq home-section" aria-labelledby="faq-heading"><div><p className="home-eyebrow">{ar ? 'إجابات قبل ما تبدأ' : 'GOOD TO KNOW'} </p><h2 id="faq-heading">{ar ? 'عندك أسئلة؟' : 'A few things you'}<br />{ar ? 'خلّينا نساعدك.' : 'might be wondering.'}</h2><p>{ar ? 'دليلك للخطوة الجاية في رحلة البيع والشراء.' : 'A little guidance for the road ahead.'}</p></div><div className="home-faq-list">{questions.map(item => <details key={item.q}><summary>{item.q}<ChevronDown size={18} /></summary><p>{item.a}</p></details>)}</div></section>;
}
