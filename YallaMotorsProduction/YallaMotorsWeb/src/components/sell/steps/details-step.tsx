"use client";

import * as React from "react";
import { useSellStore } from "@/components/sell/sell-workflow";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppLocale } from "@/i18n/config";
import type { BodyType, FuelType, Transmission } from "@/types/listing";

interface DetailsStepProps {
  locale: AppLocale;
}

const FUEL_TYPES: { value: FuelType; labelAr: string; labelEn: string }[] = [
  { value: "PETROL", labelAr: "بنزين", labelEn: "Petrol" },
  { value: "DIESEL", labelAr: "ديزل", labelEn: "Diesel" },
  { value: "HYBRID", labelAr: "هجين (هايبرد)", labelEn: "Hybrid" },
  { value: "ELECTRIC", labelAr: "كهربائي", labelEn: "Electric" },
  { value: "GAS", labelAr: "غاز طبيعي", labelEn: "Natural Gas" },
];

const TRANSMISSIONS: { value: Transmission; labelAr: string; labelEn: string }[] = [
  { value: "AUTOMATIC", labelAr: "أوتوماتيك", labelEn: "Automatic" },
  { value: "MANUAL", labelAr: "يدوي (مانيوال)", labelEn: "Manual" },
  { value: "CVT", labelAr: "CVT", labelEn: "CVT" },
  { value: "DCT", labelAr: "ثنائي القابض (DCT)", labelEn: "Dual-Clutch (DCT)" },
];

const BODY_TYPES: { value: BodyType; labelAr: string; labelEn: string }[] = [
  { value: "SEDAN", labelAr: "سيدان", labelEn: "Sedan" },
  { value: "SUV", labelAr: "دفع رباعي (SUV)", labelEn: "SUV" },
  { value: "HATCHBACK", labelAr: "هاتشباك", labelEn: "Hatchback" },
  { value: "CROSSOVER", labelAr: "كروس أوفر", labelEn: "Crossover" },
  { value: "COUPE", labelAr: "كوبيه", labelEn: "Coupe" },
  { value: "PICKUP", labelAr: "بيك أب", labelEn: "Pickup" },
  { value: "VAN", labelAr: "فان", labelEn: "Van" },
  { value: "MINIVAN", labelAr: "ميني فان", labelEn: "Minivan" },
  { value: "CONVERTIBLE", labelAr: "كابريوليه (مكشوفة)", labelEn: "Convertible" },
  { value: "WAGON", labelAr: "ستيشن واجن", labelEn: "Station Wagon" },
];

export function DetailsStep({ locale }: DetailsStepProps) {
  const draft = useSellStore((state) => state.draft);
  const updateDraft = useSellStore((state) => state.updateDraft);
  const isTransitionPending = useSellStore((state) => state.isTransitionPending);
  const ar = locale === "ar";

  const handleMileageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (!val) {
      updateDraft({ mileageKm: null });
      return;
    }
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 999999) {
      updateDraft({ mileageKm: parsed });
    }
  };

  const handleEngineCcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (!val) {
      updateDraft({ engineCc: null });
      return;
    }
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 20000) {
      updateDraft({ engineCc: parsed });
    }
  };

  return (
    <div className="space-y-6" data-testid="sell-details-step">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {ar ? "المواصفات والتفاصيل الفنية" : "Vehicle Specifications & Details"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ar
            ? "أدخل تفاصيل المسافة المقطوعة والمحرك وناقل الحركة بدقة لزيادة فرصة بيع السيارة."
            : "Enter mileage, engine, transmission and body specifications to attract serious buyers."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Mileage (Km) */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="details-mileage" className="text-sm font-medium text-foreground">
            {ar ? "المسافة المقطوعة (كم)" : "Mileage (km)"}
            <span className="text-destructive ms-1" aria-hidden="true">
              *
            </span>
          </label>
          <Input
            id="details-mileage"
            type="number"
            min={0}
            max={999999}
            placeholder={ar ? "مثال: 45000" : "e.g. 45000"}
            value={draft.mileageKm !== null ? draft.mileageKm : ""}
            onChange={handleMileageChange}
            disabled={isTransitionPending}
            data-testid="input-mileage"
            className="h-11"
          />
        </div>

        {/* Engine Capacity (CC) */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="details-engine-cc" className="text-sm font-medium text-foreground">
            {ar ? "سعة المحرك (سي سي) - اختياري" : "Engine Capacity (CC) - Optional"}
          </label>
          <Input
            id="details-engine-cc"
            type="number"
            min={500}
            max={20000}
            placeholder={ar ? "مثال: 1600" : "e.g. 1600"}
            value={draft.engineCc !== null ? draft.engineCc : ""}
            onChange={handleEngineCcChange}
            disabled={isTransitionPending}
            data-testid="input-engine-cc"
            className="h-11"
          />
        </div>

        {/* Fuel Type */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="details-fuel-type" className="text-sm font-medium text-foreground">
            {ar ? "نوع الوقود" : "Fuel Type"}
            <span className="text-destructive ms-1" aria-hidden="true">
              *
            </span>
          </label>
          <Select
            value={draft.fuelType ?? ""}
            onValueChange={(val) => updateDraft({ fuelType: val as FuelType })}
            disabled={isTransitionPending}
          >
            <SelectTrigger id="details-fuel-type" className="h-11" data-testid="select-fuel-trigger">
              <SelectValue placeholder={ar ? "اختر نوع الوقود..." : "Select fuel type..."} />
            </SelectTrigger>
            <SelectContent>
              {FUEL_TYPES.map((fuel) => (
                <SelectItem key={fuel.value} value={fuel.value} data-testid={`fuel-option-${fuel.value.toLowerCase()}`}>
                  {ar ? fuel.labelAr : fuel.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Transmission */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="details-transmission" className="text-sm font-medium text-foreground">
            {ar ? "ناقل الحركة (الفتيس)" : "Transmission"}
            <span className="text-destructive ms-1" aria-hidden="true">
              *
            </span>
          </label>
          <Select
            value={draft.transmission ?? ""}
            onValueChange={(val) => updateDraft({ transmission: val as Transmission })}
            disabled={isTransitionPending}
          >
            <SelectTrigger id="details-transmission" className="h-11" data-testid="select-transmission-trigger">
              <SelectValue placeholder={ar ? "اختر نوع ناقل الحركة..." : "Select transmission..."} />
            </SelectTrigger>
            <SelectContent>
              {TRANSMISSIONS.map((tx) => (
                <SelectItem key={tx.value} value={tx.value} data-testid={`tx-option-${tx.value.toLowerCase()}`}>
                  {ar ? tx.labelAr : tx.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Body Type */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="details-body-type" className="text-sm font-medium text-foreground">
            {ar ? "نوع الهيكل" : "Body Type"}
            <span className="text-destructive ms-1" aria-hidden="true">
              *
            </span>
          </label>
          <Select
            value={draft.bodyType ?? ""}
            onValueChange={(val) => updateDraft({ bodyType: val as BodyType })}
            disabled={isTransitionPending}
          >
            <SelectTrigger id="details-body-type" className="h-11" data-testid="select-body-type-trigger">
              <SelectValue placeholder={ar ? "اختر نوع الهيكل..." : "Select body type..."} />
            </SelectTrigger>
            <SelectContent>
              {BODY_TYPES.map((bt) => (
                <SelectItem key={bt.value} value={bt.value} data-testid={`body-option-${bt.value.toLowerCase()}`}>
                  {ar ? bt.labelAr : bt.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Exterior Color */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="details-color-exterior" className="text-sm font-medium text-foreground">
            {ar ? "اللون الخارجي (اختياري)" : "Exterior Color (Optional)"}
          </label>
          <Input
            id="details-color-exterior"
            type="text"
            placeholder={ar ? "مثال: أبيض، أسود ميتاليك" : "e.g. White, Metallic Black"}
            value={draft.colorExterior ?? ""}
            onChange={(e) => updateDraft({ colorExterior: e.target.value || null })}
            disabled={isTransitionPending}
            data-testid="input-color-exterior"
            className="h-11"
          />
        </div>
      </div>

      {/* Toggles: Warranty and Service History */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <label
          htmlFor="details-warranty"
          className="flex items-center gap-3 p-3.5 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/40 transition-colors"
        >
          <Checkbox
            id="details-warranty"
            checked={draft.hasWarranty}
            onCheckedChange={(checked) => updateDraft({ hasWarranty: Boolean(checked) })}
            disabled={isTransitionPending}
            data-testid="checkbox-warranty"
          />
          <div className="text-sm">
            <span className="font-medium text-foreground block">
              {ar ? "سارية الضمان" : "Under Warranty"}
            </span>
            <span className="text-xs text-muted-foreground block">
              {ar ? "السيارة مشمولة بضمان الوكيل أو مركز معتمد" : "Vehicle has active warranty"}
            </span>
          </div>
        </label>

        <label
          htmlFor="details-service-history"
          className="flex items-center gap-3 p-3.5 rounded-lg border border-border bg-card cursor-pointer hover:bg-muted/40 transition-colors"
        >
          <Checkbox
            id="details-service-history"
            checked={draft.hasServiceHistory}
            onCheckedChange={(checked) => updateDraft({ hasServiceHistory: Boolean(checked) })}
            disabled={isTransitionPending}
            data-testid="checkbox-service-history"
          />
          <div className="text-sm">
            <span className="font-medium text-foreground block">
              {ar ? "سجل الصيانة متوفر" : "Service History Available"}
            </span>
            <span className="text-xs text-muted-foreground block">
              {ar ? "فواتير وسجلات الصيانات الدورية متوفرة" : "Documented regular maintenance history"}
            </span>
          </div>
        </label>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5 pt-2">
        <label htmlFor="details-description" className="text-sm font-medium text-foreground flex justify-between">
          <span>{ar ? "وصف إضافي للإعلان (اختياري)" : "Additional Description (Optional)"}</span>
          <span className="text-xs text-muted-foreground">
            {draft.description.length} / 5000
          </span>
        </label>
        <Textarea
          id="details-description"
          rows={4}
          maxLength={5000}
          placeholder={
            ar
              ? "اكتب تفاصيل إضافية عن حالة السيارة، التعديلات، أو سبب البيع..."
              : "Describe any special features, vehicle condition, modifications..."
          }
          value={draft.description}
          onChange={(e) => updateDraft({ description: e.target.value })}
          disabled={isTransitionPending}
          data-testid="textarea-description"
        />
      </div>
    </div>
  );
}
