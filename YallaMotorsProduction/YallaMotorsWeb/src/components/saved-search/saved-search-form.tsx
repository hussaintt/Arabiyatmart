"use client";

import * as React from "react";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createSavedSearch,
  updateSavedSearch,
} from "@/server/actions/saved-searches";
import type { AppLocale } from "@/i18n/config";
import type { SavedSearch, SavedSearchQuery } from "@/types/saved-search";

interface SavedSearchFormProps {
  locale: AppLocale;
  savedSearch?: SavedSearch | undefined;
  onSaved: (savedSearch: SavedSearch) => void;
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function SavedSearchForm({
  locale,
  savedSearch,
  onSaved,
}: SavedSearchFormProps) {
  const ar = locale === "ar";
  const isEdit = Boolean(savedSearch);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const nameValue = String(form.get("name") ?? "").trim();
    const conditionValue = form.get("condition");
    const preferences = {
      name: nameValue || null,
      notifyPush: form.get("notifyPush") === "on",
      notifyEmail: form.get("notifyEmail") === "on",
    };

    const result = savedSearch
      ? await updateSavedSearch(savedSearch.publicId, preferences)
      : await createSavedSearch({
          ...preferences,
          query: {
            makeSlug: String(form.get("makeSlug") ?? "").trim() || undefined,
            modelSlug: String(form.get("modelSlug") ?? "").trim() || undefined,
            condition:
              conditionValue === "NEW" || conditionValue === "USED"
                ? conditionValue
                : undefined,
            yearMin: optionalNumber(form.get("yearMin")),
            yearMax: optionalNumber(form.get("yearMax")),
            priceMin: optionalNumber(form.get("priceMin")),
            priceMax: optionalNumber(form.get("priceMax")),
          } satisfies SavedSearchQuery,
        });

    setPending(false);
    if (!result.ok) {
      const fieldMessage = result.error.fieldErrors[0]?.message;
      setError(
        fieldMessage ??
          (ar ? "تعذّر حفظ البحث" : "The saved search could not be saved"),
      );
      return;
    }

    onSaved(result.data);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={isEdit ? "outline" : "default"}
          size={isEdit ? "sm" : "default"}
          data-testid={
            isEdit
              ? `edit-saved-search-${savedSearch?.publicId}`
              : "create-saved-search"
          }
        >
          {isEdit ? (
            <Save className="me-2 h-4 w-4" />
          ) : (
            <Plus className="me-2 h-4 w-4" />
          )}
          {isEdit
            ? ar
              ? "تعديل"
              : "Edit"
            : ar
              ? "حفظ بحث جديد"
              : "Save a new search"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? ar
                ? "تعديل البحث"
                : "Edit saved search"
              : ar
                ? "حفظ معايير البحث"
                : "Save search criteria"}
          </DialogTitle>
          <DialogDescription>
            {ar
              ? "تُحفظ المعايير المسموح بها فقط وتُنشأ روابط البحث بصيغة آمنة."
              : "Only supported criteria are stored and run links are rebuilt safely."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="space-y-5"
          data-testid="saved-search-form"
        >
          <div className="space-y-2">
            <Label htmlFor={`saved-name-${savedSearch?.publicId ?? "new"}`}>
              {ar ? "الاسم (اختياري)" : "Name (optional)"}
            </Label>
            <Input
              id={`saved-name-${savedSearch?.publicId ?? "new"}`}
              name="name"
              maxLength={100}
              defaultValue={savedSearch?.name ?? ""}
              autoComplete="off"
            />
          </div>

          {!isEdit ? (
            <fieldset className="grid min-w-0 grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-2">
              <legend className="px-2 text-sm font-semibold">
                {ar ? "معايير البحث" : "Search criteria"}
              </legend>
              <div className="space-y-2">
                <Label htmlFor="saved-make">
                  {ar ? "معرّف الماركة" : "Make slug"}
                </Label>
                <Input
                  id="saved-make"
                  name="makeSlug"
                  placeholder="toyota"
                  autoCapitalize="none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saved-model">
                  {ar ? "معرّف الموديل" : "Model slug"}
                </Label>
                <Input
                  id="saved-model"
                  name="modelSlug"
                  placeholder="corolla"
                  autoCapitalize="none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saved-condition">
                  {ar ? "الحالة" : "Condition"}
                </Label>
                <select
                  id="saved-condition"
                  name="condition"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">{ar ? "الكل" : "Any"}</option>
                  <option value="NEW">{ar ? "جديدة" : "New"}</option>
                  <option value="USED">{ar ? "مستعملة" : "Used"}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="saved-year-min">
                    {ar ? "من سنة" : "Year from"}
                  </Label>
                  <Input
                    id="saved-year-min"
                    name="yearMin"
                    type="number"
                    min={1900}
                    max={2100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="saved-year-max">
                    {ar ? "إلى سنة" : "Year to"}
                  </Label>
                  <Input
                    id="saved-year-max"
                    name="yearMax"
                    type="number"
                    min={1900}
                    max={2100}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="saved-price-min">
                  {ar ? "أقل سعر (قرش)" : "Minimum price (cents)"}
                </Label>
                <Input
                  id="saved-price-min"
                  name="priceMin"
                  type="number"
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saved-price-max">
                  {ar ? "أعلى سعر (قرش)" : "Maximum price (cents)"}
                </Label>
                <Input
                  id="saved-price-max"
                  name="priceMax"
                  type="number"
                  min={0}
                />
              </div>
            </fieldset>
          ) : null}

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">
              {ar ? "التنبيهات" : "Alerts"}
            </legend>
            <label className="flex min-h-11 items-center gap-3 rounded-md border px-3">
              <Checkbox
                name="notifyPush"
                defaultChecked={savedSearch?.notifyPush ?? false}
              />
              <span>{ar ? "إشعارات المتصفح" : "Browser notifications"}</span>
            </label>
            <label className="flex min-h-11 items-center gap-3 rounded-md border px-3">
              <Checkbox
                name="notifyEmail"
                defaultChecked={savedSearch?.notifyEmail ?? false}
              />
              <span>{ar ? "البريد الإلكتروني" : "Email notifications"}</span>
            </label>
          </fieldset>

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending}
              data-testid="saved-search-submit"
            >
              {pending
                ? ar
                  ? "جارٍ الحفظ..."
                  : "Saving…"
                : ar
                  ? "حفظ"
                  : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
