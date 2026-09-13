import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { LegalDocument, type LegalSection } from '@/components/legal/legal-document';

interface TermsPageProps { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: TermsPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const ar = locale === 'ar';
  const title = ar ? 'الشروط والأحكام | عربيات مارت' : 'Terms and Conditions | Arabiyatmart';
  const description = ar ? 'الشروط المنظمة لاستخدام سوق عربيات مارت.' : 'Terms governing use of the Arabiyatmart marketplace.';
  return {
    title,
    description,
    alternates: { canonical: `/${locale}/terms`, languages: { ar: '/ar/terms', en: '/en/terms' } },
    openGraph: { title, description, url: `/${locale}/terms`, type: 'website' },
  };
}

export default async function TermsPage({ params }: TermsPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale = rawLocale as AppLocale;
  setRequestLocale(locale);
  const ar = locale === 'ar';

  const sections: LegalSection[] = ar ? [
    { title: '١. قبول الشروط والأهلية', paragraphs: ['باستخدام عربيات مارت فإنك توافق على هذه الشروط وسياسة الخصوصية. يجب أن يكون عمرك 18 عاماً على الأقل وأن تكون قادراً قانوناً على إبرام العقود. إذا استخدمت الخدمة بالنيابة عن معرض أو شركة، فأنت تقر بأن لديك صلاحية إلزامها بهذه الشروط.'] },
    { title: '٢. دور عربيات مارت', paragraphs: ['عربيات مارت منصة إعلانات تربط المشترين والبائعين والمعارض. ما لم يُذكر صراحة، لسنا بائع السيارة أو مشتريها أو وسيطاً في العقد، ولا نمتلك المركبات المعروضة. تقع مسؤولية الفحص والتفاوض والدفع ونقل الملكية على أطراف المعاملة.'] },
    { title: '٣. الحسابات والأمان', bullets: ['قدم معلومات صحيحة وحديثة وحافظ على سرية بيانات الدخول ورموز التحقق.', 'أنت مسؤول عن النشاط الذي يتم من حسابك، ويجب إبلاغ الدعم فوراً عن أي استخدام غير مصرح به.', 'يجوز لنا طلب تحقق إضافي لحماية المستخدمين أو الامتثال للقانون.'] },
    { title: '٤. قواعد الإعلانات', bullets: ['يجب أن تكون مالك المركبة أو مخولاً قانوناً بعرضها.', 'يجب أن تكون المواصفات والسعر والصور والحالة والعداد وبيانات التواصل دقيقة وغير مضللة.', 'لا يجوز نشر مركبة مسروقة أو محظورة أو إعلان مكرر أو صور لا تخص المركبة.', 'يجب تحديث الإعلان أو إزالته عند البيع أو تغير المعلومات الجوهرية.', 'يجوز لنا مراجعة الإعلان أو رفضه أو إخفاؤه أو حذفه عند مخالفة القواعد أو الاشتباه في احتيال.'] },
    { title: '٥. السلوك المحظور', bullets: ['الاحتيال أو انتحال الهوية أو محاولة جمع بيانات المستخدمين دون غرض مشروع.', 'التحايل على ضوابط الأمان أو استخراج البيانات آلياً أو تعطيل الخدمة.', 'نشر محتوى غير قانوني أو مسيء أو ينتهك حقوق الغير.', 'استخدام بيانات التواصل للإزعاج أو التسويق غير المطلوب.'] },
    { title: '٦. الخدمات المدفوعة', paragraphs: ['قد نوفر إبراز الإعلانات أو اشتراكات أو خدمات مدفوعة. سنوضح السعر والمدة وأي تجديد قبل الدفع. رسوم الخدمات التي بدأ تنفيذها قد لا تكون قابلة للاسترداد إلا حيث يوجب القانون أو تنص سياسة العرض على خلاف ذلك.'] },
    { title: '٧. سلامة المعاملات', bullets: ['عاين المركبة والمستندات لدى جهة موثوقة قبل الدفع.', 'لا ترسل مبالغ أو رموز تحقق إلى شخص غير موثوق، واحذر الأسعار غير المنطقية.', 'استخدم الإجراءات الرسمية لنقل الملكية وتحقق من هوية الطرف الآخر.', 'أبلغنا فوراً عن إعلان أو سلوك مشتبه به.'] },
    { title: '٨. الملكية الفكرية', paragraphs: ['نحتفظ بحقوق المنصة والعلامة والتصميم والبرمجيات. تمنحنا ترخيصاً غير حصري لاستخدام المحتوى الذي تنشره بالقدر اللازم لعرض الإعلان وتشغيل الخدمة والترويج له، وتقر بأن لديك الحقوق اللازمة لهذا المحتوى.'] },
    { title: '٩. إيقاف الحساب والمسؤولية', paragraphs: ['يجوز لنا تقييد الحساب أو المحتوى أو إيقافه عند مخالفة الشروط أو وجود مخاطر أمنية أو قانونية. نقدم الخدمة على أساس توافرها ولا نضمن إتمام صفقة أو دقة كل إعلان. إلى أقصى حد يسمح به القانون، لا نتحمل الخسائر غير المباشرة الناتجة عن تعامل بين المستخدمين، ولا يؤثر ذلك في الحقوق التي لا يجوز استبعادها قانوناً.'] },
    { title: '١٠. القانون والتحديثات', paragraphs: ['تخضع هذه الشروط لقوانين جمهورية مصر العربية، وتختص المحاكم المصرية بالنزاعات ما لم يوجب القانون غير ذلك. قد نحدّث الشروط وسننشر تاريخ السريان ونخطر المستخدمين بالتغييرات الجوهرية. للاستفسارات، استخدم قنوات الدعم المنشورة داخل التطبيق.'] },
  ] : [
    { title: '1. Acceptance and eligibility', paragraphs: ['By using Arabiyatmart, you agree to these terms and the Privacy Policy. You must be at least 18 and legally able to enter contracts. If you use the service for a dealer or company, you confirm that you can bind that organization to these terms.'] },
    { title: '2. Arabiyatmart’s role', paragraphs: ['Arabiyatmart is a listings platform connecting buyers, sellers, and dealers. Unless expressly stated, we are not the vehicle seller, buyer, or a party to the sale contract, and we do not own listed vehicles. Inspection, negotiation, payment, and title transfer remain the parties’ responsibility.'] },
    { title: '3. Accounts and security', bullets: ['Provide accurate, current information and protect credentials and verification codes.', 'You are responsible for account activity and must promptly report unauthorized use.', 'We may request extra verification to protect users or comply with law.'] },
    { title: '4. Listing rules', bullets: ['You must own the vehicle or be legally authorized to list it.', 'Specifications, price, photos, condition, mileage, and contact details must be accurate and not misleading.', 'Stolen or prohibited vehicles, duplicate ads, and unrelated photos are forbidden.', 'Update or remove a listing when it is sold or material information changes.', 'We may review, reject, hide, or remove content that breaches rules or appears fraudulent.'] },
    { title: '5. Prohibited conduct', bullets: ['Fraud, impersonation, or collecting user data without a legitimate purpose.', 'Bypassing security controls, automated scraping, or disrupting the service.', 'Publishing unlawful, abusive, or rights-infringing content.', 'Using contact details for harassment or unsolicited marketing.'] },
    { title: '6. Paid services', paragraphs: ['We may offer promoted listings, subscriptions, or other paid services. Price, duration, and renewal terms will be shown before payment. Fees for services already started may be non-refundable unless law or the specific offer states otherwise.'] },
    { title: '7. Transaction safety', bullets: ['Inspect the vehicle and documents through a trusted professional before paying.', 'Never send money or verification codes to an untrusted person; be cautious of unrealistic prices.', 'Use official ownership-transfer procedures and verify the other party’s identity.', 'Report suspicious listings or conduct immediately.'] },
    { title: '8. Intellectual property', paragraphs: ['We retain rights in the platform, brand, design, and software. You grant us a non-exclusive license to use content you post as needed to display and operate or promote the listing and service, and you confirm that you have the necessary rights.'] },
    { title: '9. Suspension and liability', paragraphs: ['We may restrict or suspend accounts or content for a terms breach or security or legal risk. The service is provided as available, and we do not guarantee a transaction or every listing’s accuracy. To the maximum extent allowed by law, we are not liable for indirect loss arising from user-to-user dealings; rights that cannot legally be excluded remain unaffected.'] },
    { title: '10. Law and updates', paragraphs: ['These terms are governed by the laws of the Arab Republic of Egypt, and Egyptian courts have jurisdiction unless law requires otherwise. We may update the terms, publish the effective date, and notify users of material changes. For questions, use the support channels published inside the app.'] },
  ];

  return <LegalDocument locale={locale} title={ar ? 'الشروط والأحكام' : 'Terms and Conditions'} summary={ar ? 'تنظم هذه الشروط استخدامك لخدمات عربيات مارت وحقوق ومسؤوليات المشترين والبائعين والمعارض.' : 'These terms govern your use of Arabiyatmart and the responsibilities of buyers, sellers, and dealers.'} updatedLabel={ar ? 'تاريخ السريان: ١٠ سبتمبر ٢٠٢٦' : 'Effective: 10 September 2026'} sections={sections} />;
}
