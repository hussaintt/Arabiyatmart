import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isAppLocale, type AppLocale } from "@/i18n/config";
import { serverEnv } from "@/lib/env/server";
import { requireSession } from "@/lib/auth/guards";
import { listSavedSearches } from "@/server/queries/saved-searches";
import { queryKeys } from "@/lib/query/keys";
import { makeQueryClient } from "@/lib/query/client";
import { QueryHydrationBoundary } from "@/lib/query/hydration";
import { SavedSearchList } from "@/components/saved-search/saved-search-list";

export const dynamic = "force-dynamic";

interface SavedSearchesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: SavedSearchesPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  return {
    title:
      locale === "ar"
        ? "عمليات البحث المحفوظة | عربيات مارت"
        : "Saved Searches | Arabiyat Mart",
    robots: { index: false, follow: false },
    alternates: {
      canonical: `${serverEnv.SITE_ORIGIN}/${locale}/saved-searches`,
    },
  };
}

export default async function SavedSearchesPage({
  params,
}: SavedSearchesPageProps) {
  const { locale: rawLocale } = await params;
  if (!isAppLocale(rawLocale)) notFound();
  const locale: AppLocale = rawLocale;
  setRequestLocale(locale);
  await requireSession(`/${locale}/saved-searches`, locale);
  const initialData = await listSavedSearches();
  const queryClient = makeQueryClient();
  queryClient.setQueryData(queryKeys.savedSearches(), initialData);
  const ar = locale === "ar";

  return (
    <div className="space-y-6" data-testid="saved-searches-page">
      <header>
        <p className="text-sm font-semibold text-primary">
          {ar ? "حسابي" : "My account"}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {ar ? "عمليات البحث المحفوظة" : "Saved searches"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {ar
            ? "شغّل معاييرك المفضلة وعدّل طريقة تلقي التنبيهات."
            : "Run your favorite criteria and control how alerts reach you."}
        </p>
      </header>
      <QueryHydrationBoundary queryClient={queryClient}>
        <SavedSearchList initialData={initialData} locale={locale} />
      </QueryHydrationBoundary>
    </div>
  );
}
