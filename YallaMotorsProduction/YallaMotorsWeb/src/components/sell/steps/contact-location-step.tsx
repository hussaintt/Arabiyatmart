"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, MapPin, MessageSquare, Phone } from "lucide-react";
import { useSellStore } from "@/components/sell/sell-workflow";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppLocale } from "@/i18n/config";
import type { Area, City } from "@/types/taxonomy";

interface ContactLocationStepProps {
  locale: AppLocale;
}

export function ContactLocationStep({ locale }: ContactLocationStepProps) {
  const draft = useSellStore((state) => state.draft);
  const selectCity = useSellStore((state) => state.selectCity);
  const selectArea = useSellStore((state) => state.selectArea);
  const updateDraft = useSellStore((state) => state.updateDraft);
  const isTransitionPending = useSellStore((state) => state.isTransitionPending);
  const ar = locale === "ar";

  const [sameAsPhone, setSameAsPhone] = React.useState(false);

  // 1. Fetch Cities for Egypt ('EG')
  const {
    data: citiesData,
    isLoading: citiesLoading,
    error: citiesError,
  } = useQuery<{ data: City[] }>({
    queryKey: ["locations", "cities", "EG"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/bff/locations/countries/EG/cities", { signal });
      if (!res.ok) throw new Error("Failed to load cities");
      return res.json();
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  const cities = citiesData?.data ?? [];

  // 2. Fetch Areas for selected City
  const cityId = draft.cityId;
  const {
    data: areasData,
    isLoading: areasLoading,
  } = useQuery<{ data: Area[] }>({
    queryKey: cityId ? ["locations", "areas", cityId] : ["locations", "areas", "none"],
    queryFn: async ({ signal }) => {
      if (!cityId) return { data: [] };
      const res = await fetch(`/api/bff/locations/cities/${cityId}/areas`, { signal });
      if (!res.ok) throw new Error("Failed to load areas");
      return res.json();
    },
    enabled: Boolean(cityId),
    staleTime: 1000 * 60 * 60,
  });

  const areas = areasData?.data ?? [];

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    updateDraft({ contactPhone: val || null });
    if (sameAsPhone) {
      updateDraft({ whatsappPhone: val || null });
    }
  };

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    updateDraft({ whatsappPhone: val || null });
  };

  const handleSameAsPhoneToggle = (checked: boolean) => {
    setSameAsPhone(checked);
    if (checked) {
      updateDraft({ whatsappPhone: draft.contactPhone });
    }
  };

  const handleCityChange = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      selectCity(num);
    }
  };

  const handleAreaChange = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      selectArea(num);
    }
  };

  const hasContactChannel =
    draft.allowChat ||
    Boolean(draft.contactPhone?.trim()) ||
    Boolean(draft.whatsappPhone?.trim());

  return (
    <div className="space-y-6" data-testid="sell-location-step">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {ar ? "الموقع ومعلومات التواصل" : "Location & Contact Information"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ar
            ? "حدد مكان معاينة السيارة وطرق التواصل المفضلة مع المشترين المحتملين."
            : "Set the inspection location and preferred contact channels for prospective buyers."}
        </p>
      </div>

      {/* Location Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-primary" />
          {ar ? "مكان المعاينة" : "Inspection Location"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* City */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="location-city" className="text-sm font-medium text-foreground">
              {ar ? "المحافظة / المدينة" : "Governorate / City"}
              <span className="text-destructive ms-1" aria-hidden="true">
                *
              </span>
            </label>
            <Select
              value={draft.cityId ? String(draft.cityId) : ""}
              onValueChange={handleCityChange}
              disabled={isTransitionPending || citiesLoading}
            >
              <SelectTrigger id="location-city" className="h-11" data-testid="select-city-trigger">
                <SelectValue placeholder={ar ? "اختر المدينة..." : "Select city..."} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {cities.map((city) => (
                  <SelectItem key={city.id} value={String(city.id)} data-testid={`city-option-${city.id}`}>
                    {ar ? city.name.ar : city.name.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {citiesError ? (
              <span className="text-xs text-destructive">
                {ar ? "فشل تحميل المدن" : "Failed to load cities"}
              </span>
            ) : null}
          </div>

          {/* Area */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="location-area" className="text-sm font-medium text-foreground">
              {ar ? "المنطقة / الحي (اختياري)" : "Area / District (Optional)"}
            </label>
            <Select
              value={draft.areaId ? String(draft.areaId) : ""}
              onValueChange={handleAreaChange}
              disabled={!draft.cityId || isTransitionPending || areasLoading || areas.length === 0}
            >
              <SelectTrigger id="location-area" className="h-11" data-testid="select-area-trigger">
                <SelectValue
                  placeholder={
                    !draft.cityId
                      ? ar
                        ? "اختر المدينة أولاً"
                        : "Select city first"
                      : areas.length === 0 && !areasLoading
                        ? ar
                          ? "لا توجد مناطق مسجلة"
                          : "No areas recorded"
                        : ar
                          ? "اختر المنطقة..."
                          : "Select area..."
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {areas.map((area) => (
                  <SelectItem key={area.id} value={String(area.id)} data-testid={`area-option-${area.id}`}>
                    {ar ? area.name.ar : area.name.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Contact Channels Section */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Phone className="h-4 w-4 text-primary" />
          {ar ? "قنوات التواصل" : "Contact Methods"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-phone" className="text-sm font-medium text-foreground">
              {ar ? "رقم الهاتف للاتصال" : "Contact Phone"}
            </label>
            <Input
              id="contact-phone"
              type="tel"
              placeholder="+201012345678"
              value={draft.contactPhone ?? ""}
              onChange={handlePhoneChange}
              disabled={isTransitionPending}
              data-testid="input-contact-phone"
              className="h-11"
            />
          </div>

          {/* WhatsApp */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="whatsapp-phone" className="text-sm font-medium text-foreground">
                {ar ? "رقم الواتساب" : "WhatsApp Number"}
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={sameAsPhone}
                  onCheckedChange={(checked) => handleSameAsPhoneToggle(Boolean(checked))}
                  disabled={!draft.contactPhone || isTransitionPending}
                  data-testid="checkbox-same-whatsapp"
                />
                {ar ? "نفس رقم الهاتف" : "Same as phone"}
              </label>
            </div>
            <Input
              id="whatsapp-phone"
              type="tel"
              placeholder="+201012345678"
              value={draft.whatsappPhone ?? ""}
              onChange={handleWhatsappChange}
              disabled={sameAsPhone || isTransitionPending}
              data-testid="input-whatsapp-phone"
              className="h-11"
            />
          </div>
        </div>

        {/* In-app Chat Toggle */}
        <label
          htmlFor="allow-chat"
          className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/30 transition-colors"
        >
          <Checkbox
            id="allow-chat"
            checked={draft.allowChat}
            onCheckedChange={(checked) => updateDraft({ allowChat: Boolean(checked) })}
            disabled={isTransitionPending}
            data-testid="checkbox-allow-chat"
          />
          <div className="text-sm">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-primary" />
              {ar ? "تفعيل المحادثة الفورية داخل الموقع" : "Enable In-App Chat"}
            </span>
            <span className="text-xs text-muted-foreground block mt-0.5">
              {ar
                ? "يسمح للمشترين بالتواصل معك مباشرة عبر رسائل الموقع دون إظهار رقم هاتفك"
                : "Allows buyers to message you securely within the platform"}
            </span>
          </div>
        </label>

        {!hasContactChannel ? (
          <p role="alert" className="text-xs text-destructive">
            {ar
              ? "يجب توفير وسيلة تواصل واحدة على الأقل (هاتف، واتساب، أو محادثة داخلية)."
              : "At least one contact method must be provided (phone, WhatsApp, or chat)."}
          </p>
        ) : null}

        {draft.cityId && hasContactChannel ? (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              {ar
                ? "بيانات الموقع والتواصل مكتملة. يمكنك المتابعة."
                : "Location and contact methods complete."}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
