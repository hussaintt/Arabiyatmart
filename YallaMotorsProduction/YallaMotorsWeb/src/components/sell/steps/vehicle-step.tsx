"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Car, CheckCircle, Info } from "lucide-react";
import { useSellStore } from "@/components/sell/sell-workflow";
import {
  VehicleCombobox,
  type VehicleComboboxItem,
} from "@/components/sell/vehicle-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryKeys } from "@/lib/query/keys";
import type { AppLocale } from "@/i18n/config";
import type {
  Generation,
  Make,
  Trim,
  VehicleModel,
} from "@/types/taxonomy";

interface VehicleStepProps {
  locale: AppLocale;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from(
  { length: CURRENT_YEAR - 1970 + 2 },
  (_, i) => CURRENT_YEAR + 1 - i,
);

export function VehicleStep({ locale }: VehicleStepProps) {
  const draft = useSellStore((state) => state.draft);
  const selectMake = useSellStore((state) => state.selectMake);
  const selectModel = useSellStore((state) => state.selectModel);
  const selectGeneration = useSellStore((state) => state.selectGeneration);
  const selectTrim = useSellStore((state) => state.selectTrim);
  const updateDraft = useSellStore((state) => state.updateDraft);
  const isTransitionPending = useSellStore((state) => state.isTransitionPending);

  const ar = locale === "ar";

  // 1. Fetch Makes
  const {
    data: makesData,
    isLoading: makesLoading,
    error: makesError,
    refetch: refetchMakes,
  } = useQuery<{ data: Make[] }>({
    queryKey: queryKeys.taxonomyMakes(),
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/bff/taxonomy/makes", { signal });
      if (!res.ok) throw new Error("Failed to load vehicle makes");
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const makes = React.useMemo(() => makesData?.data ?? [], [makesData?.data]);
  const selectedMake = React.useMemo(
    () => makes.find((m) => m.publicId === draft.makePublicId),
    [makes, draft.makePublicId],
  );

  const makeItems: VehicleComboboxItem[] = React.useMemo(
    () =>
      makes.map((m) => ({
        publicId: m.publicId,
        slug: m.slug,
        name: ar ? m.name.ar : m.name.en,
        sublabel: m.countryOfOrigin ?? undefined,
      })),
    [makes, ar],
  );

  // 2. Fetch Models (dependent on makeSlug)
  const makeSlug = selectedMake?.slug;
  const {
    data: modelsData,
    isLoading: modelsLoading,
    error: modelsError,
    refetch: refetchModels,
  } = useQuery<{ data: VehicleModel[] }>({
    queryKey: makeSlug ? queryKeys.taxonomyModels(makeSlug) : ["taxonomy", "models", "none"],
    queryFn: async ({ signal }) => {
      if (!makeSlug) return { data: [] };
      const res = await fetch(
        `/api/bff/taxonomy/makes/${encodeURIComponent(makeSlug)}/models`,
        { signal },
      );
      if (!res.ok) throw new Error("Failed to load vehicle models");
      return res.json();
    },
    enabled: Boolean(makeSlug),
    staleTime: 1000 * 60 * 30,
  });

  const models = React.useMemo(() => modelsData?.data ?? [], [modelsData?.data]);
  const selectedModel = React.useMemo(
    () => models.find((m) => m.publicId === draft.modelPublicId),
    [models, draft.modelPublicId],
  );

  const modelItems: VehicleComboboxItem[] = React.useMemo(
    () =>
      models.map((m) => ({
        publicId: m.publicId,
        slug: m.slug,
        name: ar ? m.name.ar : m.name.en,
        sublabel: m.bodyType ?? undefined,
      })),
    [models, ar],
  );

  // 3. Fetch Generations (dependent on modelPublicId)
  const modelPublicId = draft.modelPublicId;
  const {
    data: generationsData,
    isLoading: generationsLoading,
    error: generationsError,
    refetch: refetchGenerations,
  } = useQuery<{ data: Generation[] }>({
    queryKey: modelPublicId
      ? ["taxonomy", "generations", modelPublicId]
      : ["taxonomy", "generations", "none"],
    queryFn: async ({ signal }) => {
      if (!modelPublicId) return { data: [] };
      const res = await fetch(
        `/api/bff/taxonomy/models/${encodeURIComponent(modelPublicId)}/generations`,
        { signal },
      );
      if (!res.ok) throw new Error("Failed to load generations");
      return res.json();
    },
    enabled: Boolean(modelPublicId),
    staleTime: 1000 * 60 * 30,
  });

  const generations = React.useMemo(
    () => generationsData?.data ?? [],
    [generationsData?.data],
  );
  const selectedGeneration = React.useMemo(
    () => generations.find((g) => g.publicId === draft.generationPublicId),
    [generations, draft.generationPublicId],
  );

  const generationItems: VehicleComboboxItem[] = React.useMemo(
    () =>
      generations.map((g) => ({
        publicId: g.publicId,
        name: g.name,
        sublabel: g.endYear
          ? `${g.startYear} - ${g.endYear}`
          : `${g.startYear} - ${ar ? "الآن" : "Present"}`,
      })),
    [generations, ar],
  );

  // 4. Fetch Trims (dependent on generationPublicId)
  const generationPublicId = draft.generationPublicId;
  const {
    data: trimsData,
    isLoading: trimsLoading,
    error: trimsError,
    refetch: refetchTrims,
  } = useQuery<{ data: Trim[] }>({
    queryKey: generationPublicId
      ? ["taxonomy", "trims", generationPublicId]
      : ["taxonomy", "trims", "none"],
    queryFn: async ({ signal }) => {
      if (!generationPublicId) return { data: [] };
      const res = await fetch(
        `/api/bff/taxonomy/generations/${encodeURIComponent(generationPublicId)}/trims`,
        { signal },
      );
      if (!res.ok) throw new Error("Failed to load vehicle trims");
      return res.json();
    },
    enabled: Boolean(generationPublicId),
    staleTime: 1000 * 60 * 30,
  });

  const trims = React.useMemo(() => trimsData?.data ?? [], [trimsData?.data]);
  const selectedTrim = React.useMemo(
    () => trims.find((t) => t.publicId === draft.trimPublicId),
    [trims, draft.trimPublicId],
  );

  const trimItems: VehicleComboboxItem[] = React.useMemo(
    () =>
      trims.map((t) => ({
        publicId: t.publicId,
        name: ar ? t.name.ar : t.name.en,
        sublabel: t.engineCc ? `${t.engineCc} cc` : undefined,
      })),
    [trims, ar],
  );

  const handleMakeSelect = (publicId: string | null) => {
    selectMake(publicId);
  };

  const handleModelSelect = (publicId: string | null) => {
    selectModel(publicId);
  };

  const handleGenerationSelect = (publicId: string | null) => {
    selectGeneration(publicId);
  };

  const handleTrimSelect = (publicId: string | null) => {
    selectTrim(publicId);
  };

  const handleYearChange = (yearString: string) => {
    const parsedYear = parseInt(yearString, 10);
    if (!isNaN(parsedYear)) {
      updateDraft({ year: parsedYear });
    }
  };

  return (
    <div className="space-y-6" data-testid="sell-vehicle-step">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {ar ? "حدد بيانات السيارة" : "Select Vehicle Specifications"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ar
            ? "اختر الشركة المصنعة والطراز وسنة الصنع لمطابقة المواصفات بدقة."
            : "Choose the make, model, and manufacturing year to match exact catalogue specs."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Make Combobox */}
        <VehicleCombobox
          id="vehicle-make"
          label={ar ? "الشركة المصنعة (الماركة)" : "Make / Brand"}
          placeholder={ar ? "ابحث أو اختر الماركة..." : "Search or select make..."}
          items={makeItems}
          value={draft.makePublicId}
          onSelect={handleMakeSelect}
          disabled={isTransitionPending}
          isLoading={makesLoading}
          error={makesError ? (ar ? "فشل تحميل الماركات" : "Failed to load makes") : null}
          onRetry={() => void refetchMakes()}
          locale={locale}
          required
        />

        {/* Model Combobox */}
        <VehicleCombobox
          id="vehicle-model"
          label={ar ? "طراز السيارة (الموديل)" : "Model"}
          placeholder={
            !draft.makePublicId
              ? ar
                ? "اختر الماركة أولاً"
                : "Select make first"
              : ar
                ? "اختر الموديل..."
                : "Select model..."
          }
          items={modelItems}
          value={draft.modelPublicId}
          onSelect={handleModelSelect}
          disabled={!draft.makePublicId || isTransitionPending}
          isLoading={modelsLoading}
          error={modelsError ? (ar ? "فشل تحميل الموديلات" : "Failed to load models") : null}
          onRetry={() => void refetchModels()}
          locale={locale}
          required
        />

        {/* Year Select */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="vehicle-year"
            className="text-sm font-medium text-foreground"
          >
            {ar ? "سنة الصنع" : "Manufacturing Year"}
            <span className="text-destructive ms-1" aria-hidden="true">
              *
            </span>
          </label>
          <Select
            value={draft.year ? String(draft.year) : ""}
            onValueChange={handleYearChange}
            disabled={!draft.modelPublicId || isTransitionPending}
          >
            <SelectTrigger
              id="vehicle-year"
              className="h-11"
              data-testid="select-year-trigger"
            >
              <SelectValue
                placeholder={
                  !draft.modelPublicId
                    ? ar
                      ? "اختر الموديل أولاً"
                      : "Select model first"
                    : ar
                      ? "اختر سنة الصنع..."
                      : "Select year..."
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {YEARS.map((year) => (
                <SelectItem
                  key={year}
                  value={String(year)}
                  data-testid={`year-option-${year}`}
                >
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Generation Combobox (Optional) */}
        <VehicleCombobox
          id="vehicle-generation"
          label={ar ? "الجيل (اختياري)" : "Generation (Optional)"}
          placeholder={
            !draft.modelPublicId
              ? ar
                ? "اختر الموديل أولاً"
                : "Select model first"
              : generationItems.length === 0 && !generationsLoading
                ? ar
                  ? "لا توجد أجيال مسجلة"
                  : "No generations recorded"
                : ar
                  ? "اختر الجيل..."
                  : "Select generation..."
          }
          items={generationItems}
          value={draft.generationPublicId}
          onSelect={handleGenerationSelect}
          disabled={!draft.modelPublicId || isTransitionPending || generationItems.length === 0}
          isLoading={generationsLoading}
          error={generationsError ? (ar ? "فشل تحميل الأجيال" : "Failed to load generations") : null}
          onRetry={() => void refetchGenerations()}
          locale={locale}
        />

        {/* Trim Combobox (Optional) */}
        <div className="md:col-span-2">
          <VehicleCombobox
            id="vehicle-trim"
            label={ar ? "الفئة / التجهيز (اختياري)" : "Trim / Trim Level (Optional)"}
            placeholder={
              !draft.generationPublicId
                ? ar
                  ? "اختر الجيل أولاً"
                  : "Select generation first"
                : trimItems.length === 0 && !trimsLoading
                  ? ar
                    ? "لا توجد فئات مسجلة"
                    : "No trims recorded"
                  : ar
                    ? "اختر الفئة..."
                    : "Select trim..."
            }
            items={trimItems}
            value={draft.trimPublicId}
            onSelect={handleTrimSelect}
            disabled={!draft.generationPublicId || isTransitionPending || trimItems.length === 0}
            isLoading={trimsLoading}
            error={trimsError ? (ar ? "فشل تحميل الفئات" : "Failed to load trims") : null}
            onRetry={() => void refetchTrims()}
            locale={locale}
          />
        </div>
      </div>

      {/* Selection Summary */}
      {selectedMake || selectedModel || draft.year ? (
        <div
          className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3 mt-4"
          data-testid="vehicle-selection-summary"
        >
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <Car className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">
              {ar ? "السيارة المختارة حتى الآن" : "Selected Vehicle"}
            </p>
            <p className="font-semibold text-base text-foreground truncate mt-0.5">
              {[
                selectedMake ? (ar ? selectedMake.name.ar : selectedMake.name.en) : null,
                selectedModel ? (ar ? selectedModel.name.ar : selectedModel.name.en) : null,
                selectedGeneration ? selectedGeneration.name : null,
                draft.year,
                selectedTrim ? (ar ? selectedTrim.name.ar : selectedTrim.name.en) : null,
              ]
                .filter(Boolean)
                .join(" - ")}
            </p>
            {draft.year && selectedMake && selectedModel ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle className="h-3.5 w-3.5" />
                {ar ? "البيانات الأساسية مكتملة، يمكنك الانتقال للخطوة التالية." : "Core specifications complete."}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Info className="h-3.5 w-3.5" />
                {ar
                  ? "يرجى تحديد الماركة والموديل وسنة الصنع لإكمال هذه الخطوة."
                  : "Please select make, model, and year to complete this step."}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
