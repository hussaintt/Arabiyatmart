import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { isAppLocale, type AppLocale } from '@/i18n/config';
import { LegalDocument, type LegalSection } from '@/components/legal/legal-document';

interface PrivacyPageProps { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PrivacyPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const ar = locale === 'ar';
  const title = ar ? 'سياسة الخصوصية | عربيات مارت' : 'Privacy Policy | Arabiyatmart';
  const description = ar ? 'تعرف على كيفية جمع عربيات مارت لبياناتك واستخدامها وحمايتها.' : 'Learn how Arabiyatmart collects, uses, and protects your data.';
  return {
    title,
    description,
    alternates: { canonical: `/${locale}/privacy`, languages: { ar: '/ar/privacy', en: '/en/privacy' } },
    openGraph: { title, description, url: `/${locale}/privacy`, type: 'website' },
  };
}

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale = rawLocale as AppLocale;
  setRequestLocale(locale);
  const ar = locale === 'ar';

  const sections: LegalSection[] = ar ? [
    { title: '١. نطاق السياسة', paragraphs: ['توضح هذه السياسة كيفية تعامل عربيات مارت مع البيانات عند استخدام الموقع أو تطبيق الهاتف أو التواصل مع فريق الدعم. باستخدام خدماتنا، فإنك تقر بأن بياناتك ستتم معالجتها وفقاً لهذه السياسة والقوانين المصرية المعمول بها.'] },
    { title: '٢. البيانات التي نجمعها', bullets: ['بيانات الحساب مثل الاسم ورقم الهاتف والبريد الإلكتروني ووسائل التحقق.', 'بيانات الإعلانات مثل مواصفات السيارة والصور والسعر والموقع وبيانات التواصل التي تختار نشرها.', 'بيانات الاستخدام والجهاز، بما فيها الصفحات التي تزورها وعنوان IP ومعرّفات الجلسة والأعطال ومعلومات المتصفح.', 'المراسلات وطلبات الدعم وبلاغات الأمان والاحتيال.', 'بيانات تقريبية للموقع عند منح الإذن، لتخصيص نتائج البحث والخدمات القريبة.'] },
    { title: '٣. كيف نستخدم البيانات', bullets: ['إنشاء الحسابات وتشغيل الإعلانات والبحث والمفضلة والمقارنات والتنبيهات.', 'التحقق من المستخدمين والمعارض ومنع الاحتيال وإساءة الاستخدام.', 'تمكين التواصل بين المشترين والبائعين وتسجيل نوع التواصل لأغراض الجودة والأمان.', 'تحسين ترتيب نتائج البحث وأداء المنتج وتجربة الاستخدام.', 'إرسال إشعارات خدمية أو تسويقية وفق اختياراتك، ويمكنك إيقاف التسويق في أي وقت.', 'الامتثال للالتزامات القانونية والاستجابة للطلبات الرسمية الصحيحة.'] },
    { title: '٤. مشاركة البيانات', paragraphs: ['لا نبيع بياناتك الشخصية. قد نشارك القدر اللازم منها مع مزودي الاستضافة والتحليلات والإشعارات والتحقق والدفع، ومع الأطراف الأخرى عندما تطلب ميزة تستلزم ذلك، أو عند وجود التزام قانوني. بيانات التواصل التي تكشفها في إعلان قد يراها مستخدمو السوق.'] },
    { title: '٥. الحفظ والأمان', paragraphs: ['نحتفظ بالبيانات للمدة اللازمة لتقديم الخدمة والوفاء بالالتزامات القانونية وتسوية النزاعات ومنع الاحتيال. نستخدم ضوابط وصول وتشفيراً أثناء النقل ومراقبة أمنية، لكن لا توجد وسيلة تخزين أو نقل مضمونة بنسبة 100%.'] },
    { title: '٦. حقوقك واختياراتك', bullets: ['الوصول إلى بيانات حسابك وتصحيحها من إعدادات الملف الشخصي.', 'حذف الحساب أو طلب حذف البيانات، مع مراعاة مدد الحفظ القانونية والأمنية.', 'التحكم في إشعارات البريد والتنبيهات الفورية.', 'سحب إذن الموقع أو الإشعارات من إعدادات الجهاز.', 'تقديم شكوى أو استفسار عن الخصوصية عبر قنوات الدعم داخل التطبيق.'] },
    { title: '٧. القُصّر', paragraphs: ['الخدمة غير موجهة لمن هم دون 18 عاماً، ولا نجمع بياناتهم عن علم. إذا اعتقدت أن قاصراً قدم بياناته إلينا، يرجى التواصل مع الدعم.'] },
    { title: '٨. التحديثات والتواصل', paragraphs: ['قد نحدّث هذه السياسة عند تغير الخدمة أو المتطلبات القانونية، وسننشر التاريخ الجديد ونقدم إشعاراً إضافياً إذا كان التغيير جوهرياً. للاستفسارات، استخدم مركز الدعم أو بيانات التواصل المنشورة داخل عربيات مارت.'] },
  ] : [
    { title: '1. Scope', paragraphs: ['This policy explains how Arabiyatmart handles data when you use our website, mobile application, or support channels. By using the service, you acknowledge that data is processed under this policy and applicable Egyptian law.'] },
    { title: '2. Data we collect', bullets: ['Account data such as name, phone number, email address, and verification records.', 'Listing data such as vehicle specifications, photos, price, location, and contact details you choose to publish.', 'Usage and device data, including visited pages, IP address, session identifiers, crashes, and browser information.', 'Support messages, safety reports, and fraud reports.', 'Approximate location when you grant permission, to tailor nearby results and services.'] },
    { title: '3. How we use data', bullets: ['Operate accounts, listings, search, favorites, comparisons, and alerts.', 'Verify users and dealers and prevent fraud or abuse.', 'Enable buyer–seller contact and record the contact channel for quality and safety.', 'Improve search ranking, product performance, and user experience.', 'Send service or marketing notifications according to your choices; marketing can be disabled at any time.', 'Meet legal obligations and respond to valid official requests.'] },
    { title: '4. Data sharing', paragraphs: ['We do not sell personal data. We may share the minimum necessary data with hosting, analytics, notification, verification, and payment providers; with parties needed for a feature you request; or where the law requires it. Contact details you reveal in a listing may be visible to marketplace users.'] },
    { title: '5. Retention and security', paragraphs: ['We retain data as needed to provide the service, meet legal duties, resolve disputes, and prevent fraud. We use access controls, encryption in transit, and security monitoring, but no storage or transmission method is completely secure.'] },
    { title: '6. Your rights and choices', bullets: ['Access and correct profile data through account settings.', 'Delete your account or request data deletion, subject to legal and security retention periods.', 'Control email and push notifications.', 'Withdraw location or notification permissions in device settings.', 'Raise a privacy question or complaint through in-app support channels.'] },
    { title: '7. Children', paragraphs: ['The service is not intended for anyone under 18, and we do not knowingly collect their data. Contact support if you believe a minor has provided data.'] },
    { title: '8. Updates and contact', paragraphs: ['We may update this policy when the service or legal requirements change. We will publish the new date and provide additional notice for material changes. For questions, use the support center or contact details published inside Arabiyatmart.'] },
  ];

  return <LegalDocument locale={locale} title={ar ? 'سياسة الخصوصية' : 'Privacy Policy'} summary={ar ? 'نحترم خصوصيتك ونلتزم بالوضوح بشأن البيانات التي نحتاجها لتشغيل سوق سيارات آمن وموثوق.' : 'We respect your privacy and explain the data needed to operate a safe, trusted automotive marketplace.'} updatedLabel={ar ? 'آخر تحديث: ١٠ سبتمبر ٢٠٢٦' : 'Last updated: 10 September 2026'} sections={sections} />;
}
