"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Mail, MailX, Play, Search, Trash2 } from "lucide-react";
import { browserApiRequest } from "@/lib/api/browser";
import { BFF_ENDPOINTS } from "@/lib/api/endpoints";
import { SavedSearchListResponseSchema } from "@/lib/api/schemas/saved-search";
import { SavedSearchQuerySchema } from "@/lib/api/schemas/saved-search";
import { queryKeys } from "@/lib/query/keys";
import { buildSearchUrl, canonicalizeSearchParams } from "@/lib/search/params";
import {
  deleteSavedSearch,
  updateSavedSearch,
} from "@/server/actions/saved-searches";
import { SavedSearchForm } from "./saved-search-form";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Link } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/config";
import type {
  SavedSearch,
  SavedSearchListResponse,
  SavedSearchQuery,
} from "@/types/saved-search";

export function buildSavedSearchRunHref(
  locale: AppLocale,
  query: unknown,
): string {
  const canonical = canonicalizeSearchParams(query);
  const allowed: SavedSearchQuery = {};
  const keys = [
    "makeSlug",
    "modelSlug",
    "yearMin",
    "yearMax",
    "priceMin",
    "priceMax",
    "mileageMax",
    "cityId",
    "areaId",
    "condition",
    "fuelType",
    "transmission",
    "bodyType",
    "sellerType",
    "hasWarranty",
    "isNegotiable",
    "installmentAvailable",
    "exchangeAccepted",
  ] as const satisfies readonly (keyof SavedSearchQuery)[];
  for (const key of keys) {
    if (canonical[key] !== undefined) {
      (allowed as Record<string, unknown>)[key] = canonical[key];
    }
  }
  return buildSearchUrl(
    `/${locale}/search`,
    SavedSearchQuerySchema.parse(allowed),
  );
}

function querySummary(query: SavedSearchQuery, ar: boolean): string {
  const parts: string[] = [];
  if (query.makeSlug)
    parts.push(`${ar ? "الماركة" : "Make"}: ${query.makeSlug}`);
  if (query.modelSlug)
    parts.push(`${ar ? "الموديل" : "Model"}: ${query.modelSlug}`);
  if (query.condition)
    parts.push(
      query.condition === "NEW"
        ? ar
          ? "جديدة"
          : "New"
        : ar
          ? "مستعملة"
          : "Used",
    );
  if (query.yearMin !== undefined || query.yearMax !== undefined)
    parts.push(
      `${ar ? "السنة" : "Year"}: ${query.yearMin ?? "…"}–${query.yearMax ?? "…"}`,
    );
  if (query.priceMin !== undefined || query.priceMax !== undefined)
    parts.push(
      `${ar ? "السعر" : "Price"}: ${query.priceMin ?? "…"}–${query.priceMax ?? "…"}`,
    );
  return parts.length > 0
    ? parts.join(" · ")
    : ar
      ? "كل السيارات"
      : "All vehicles";
}

interface SavedSearchListProps {
  initialData: SavedSearchListResponse;
  locale: AppLocale;
}

export function SavedSearchList({ initialData, locale }: SavedSearchListProps) {
  const ar = locale === "ar";
  const queryClient = useQueryClient();
  const queryKey = queryKeys.savedSearches();
  const [pendingIds, setPendingIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [error, setError] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey,
    initialData,
    staleTime: 30_000,
    queryFn: () =>
      browserApiRequest({
        path: BFF_ENDPOINTS.meSavedSearches(),
        outputSchema: SavedSearchListResponseSchema,
      }),
  });

  const setItemPending = (publicId: string, pending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) next.add(publicId);
      else next.delete(publicId);
      return next;
    });
  };

  const reconcile = (savedSearch: SavedSearch) => {
    queryClient.setQueryData<SavedSearchListResponse>(queryKey, (current) => {
      if (!current) return { data: [savedSearch] };
      const exists = current.data.some(
        (item) => item.publicId === savedSearch.publicId,
      );
      return {
        data: exists
          ? current.data.map((item) =>
              item.publicId === savedSearch.publicId ? savedSearch : item,
            )
          : [savedSearch, ...current.data],
      };
    });
  };

  const togglePreference = async (
    savedSearch: SavedSearch,
    field: "isActive" | "notifyPush" | "notifyEmail",
    value: boolean,
  ) => {
    if (pendingIds.has(savedSearch.publicId)) return;
    setError(null);
    setItemPending(savedSearch.publicId, true);
    const snapshot =
      queryClient.getQueryData<SavedSearchListResponse>(queryKey);
    reconcile({ ...savedSearch, [field]: value });
    const result = await updateSavedSearch(savedSearch.publicId, {
      [field]: value,
    });
    setItemPending(savedSearch.publicId, false);
    if (!result.ok) {
      if (snapshot) queryClient.setQueryData(queryKey, snapshot);
      setError(result.error.message);
      return;
    }
    reconcile(result.data);
  };

  const remove = async (savedSearch: SavedSearch) => {
    if (pendingIds.has(savedSearch.publicId)) return;
    setError(null);
    setItemPending(savedSearch.publicId, true);
    const snapshot =
      queryClient.getQueryData<SavedSearchListResponse>(queryKey);
    queryClient.setQueryData<SavedSearchListResponse>(queryKey, (current) => ({
      data:
        current?.data.filter(
          (item) => item.publicId !== savedSearch.publicId,
        ) ?? [],
    }));
    const result = await deleteSavedSearch({ publicId: savedSearch.publicId });
    setItemPending(savedSearch.publicId, false);
    if (!result.ok) {
      if (snapshot) queryClient.setQueryData(queryKey, snapshot);
      setError(result.error.message);
    }
  };

  const searches = query.data.data;

  return (
    <div className="space-y-5" data-testid="saved-search-list">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {ar
            ? `${searches.length} عمليات بحث محفوظة`
            : `${searches.length} saved searches`}
        </p>
        <SavedSearchForm locale={locale} onSaved={reconcile} />
      </div>

      {error ? (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {searches.length === 0 ? (
        <div
          className="rounded-xl border border-dashed bg-card px-6 py-14 text-center"
          data-testid="saved-search-empty"
        >
          <Search
            className="mx-auto h-11 w-11 text-muted-foreground/50"
            aria-hidden
          />
          <h2 className="mt-4 text-lg font-bold">
            {ar ? "لا توجد عمليات بحث محفوظة" : "No saved searches yet"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {ar
              ? "احفظ معاييرك لتعود إلى أحدث النتائج بسرعة."
              : "Save criteria to return to fresh results quickly."}
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/search" locale={locale}>
              {ar ? "استكشف السيارات" : "Explore vehicles"}
            </Link>
          </Button>
        </div>
      ) : (
        <div
          className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"
          data-testid="saved-search-grid"
        >
          {searches.map((savedSearch) => {
            const pending = pendingIds.has(savedSearch.publicId);
            return (
              <article
                key={savedSearch.publicId}
                className="min-w-0 rounded-xl border bg-card p-5 shadow-sm"
                data-testid={`saved-search-${savedSearch.publicId}`}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-bold">
                      {savedSearch.name ??
                        (ar ? "بحث بدون اسم" : "Unnamed search")}
                    </h2>
                    <p className="mt-1 break-words text-sm text-muted-foreground">
                      {querySummary(savedSearch.query, ar)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${savedSearch.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                  >
                    {savedSearch.isActive
                      ? ar
                        ? "نشط"
                        : "Active"
                      : ar
                        ? "متوقف"
                        : "Paused"}
                  </span>
                </div>

                <div className="mt-4 space-y-3 border-y py-4">
                  <label className="flex min-h-10 items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      {ar ? "تشغيل التنبيه" : "Alert active"}
                    </span>
                    <Switch
                      checked={savedSearch.isActive}
                      disabled={pending}
                      onCheckedChange={(value) =>
                        void togglePreference(savedSearch, "isActive", value)
                      }
                      aria-label={ar ? "تشغيل التنبيه" : "Toggle alert"}
                    />
                  </label>
                  <label className="flex min-h-10 items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      {savedSearch.notifyPush ? (
                        <Bell className="h-4 w-4" />
                      ) : (
                        <BellOff className="h-4 w-4" />
                      )}
                      {ar ? "إشعارات المتصفح" : "Browser notifications"}
                    </span>
                    <Switch
                      checked={savedSearch.notifyPush}
                      disabled={pending}
                      onCheckedChange={(value) =>
                        void togglePreference(savedSearch, "notifyPush", value)
                      }
                      aria-label={
                        ar ? "إشعارات المتصفح" : "Browser notifications"
                      }
                    />
                  </label>
                  <label className="flex min-h-10 items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      {savedSearch.notifyEmail ? (
                        <Mail className="h-4 w-4" />
                      ) : (
                        <MailX className="h-4 w-4" />
                      )}
                      {ar ? "البريد الإلكتروني" : "Email notifications"}
                    </span>
                    <Switch
                      checked={savedSearch.notifyEmail}
                      disabled={pending}
                      onCheckedChange={(value) =>
                        void togglePreference(savedSearch, "notifyEmail", value)
                      }
                      aria-label={
                        ar ? "البريد الإلكتروني" : "Email notifications"
                      }
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <a
                      href={buildSavedSearchRunHref(locale, savedSearch.query)}
                    >
                      <Play className="me-2 h-4 w-4" />
                      {ar ? "عرض النتائج" : "Run search"}
                    </a>
                  </Button>
                  <SavedSearchForm
                    locale={locale}
                    savedSearch={savedSearch}
                    onSaved={reconcile}
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        data-testid={`delete-saved-search-${savedSearch.publicId}`}
                      >
                        <Trash2 className="me-2 h-4 w-4" />
                        {ar ? "حذف" : "Delete"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {ar ? "حذف البحث المحفوظ؟" : "Delete saved search?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {ar
                            ? "يمكنك إنشاء بحث جديد لاحقاً، لكن لا يمكن التراجع عن الحذف."
                            : "You can create another search later, but this deletion cannot be undone."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {ar ? "إلغاء" : "Cancel"}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => void remove(savedSearch)}
                          data-testid={`confirm-delete-saved-search-${savedSearch.publicId}`}
                        >
                          {ar ? "تأكيد الحذف" : "Confirm delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
