import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { defaultLocale, isAppLocale, type AppLocale } from '@/i18n/config';
import { verifyLocalePreference } from '@/lib/auth/locale-cookie';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RootPage() {
  const cookieStore = await cookies();
  const rawLocaleCookie = cookieStore.get('am_locale')?.value;

  let targetLocale: AppLocale = defaultLocale;

  if (rawLocaleCookie) {
    const verified = await verifyLocalePreference(rawLocaleCookie);
    if (verified && isAppLocale(verified)) {
      targetLocale = verified;
    } else if (isAppLocale(rawLocaleCookie)) {
      targetLocale = rawLocaleCookie;
    }
  }

  redirect(`/${targetLocale}`);
}
