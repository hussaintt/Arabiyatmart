"use client";

import * as React from "react";
import { Sparkles, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useSellStore } from "@/components/sell/sell-workflow";
import { CarConditionSchema } from "@/lib/api/schemas/listing";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/i18n/config";
import type { CarCondition } from "@/types/listing";

interface ConditionStepProps {
  locale: AppLocale;
}

interface ConditionOption {
  value: CarCondition;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CONDITIONS: readonly ConditionOption[] = [
  {
    value: "NEW",
    titleAr: "سيارة جديدة",
    titleEn: "Brand New",
    descAr: "سيارة بدون لوحات أو استهلاك، لم تُسجل من قبل وضمان الوكيل سارٍ.",
    descEn: "Zero-mileage, unregistered vehicle with active factory warranty.",
    icon: Sparkles,
  },
  {
    value: "USED",
    titleAr: "سيارة مستعملة",
    titleEn: "Pre-Owned / Used",
    descAr: "سيارة قيد الاستخدام أو مسجلة مسبقاً، مع تحديد الكيلومترات والمواصفات بدقة.",
    descEn: "Previously registered vehicle with specified mileage and condition history.",
    icon: ShieldCheck,
  },
] as const;

export function ConditionStep({ locale }: ConditionStepProps) {
  const currentCondition = useSellStore((state) => state.draft.condition);
  const setCondition = useSellStore((state) => state.setCondition);
  const isTransitionPending = useSellStore((state) => state.isTransitionPending);
  const ar = locale === "ar";

  const handleSelect = (raw: CarCondition) => {
    const parsed = CarConditionSchema.safeParse(raw);
    if (!parsed.success) return;
    setCondition(parsed.data);
  };

  return (
    <div className="space-y-6" data-testid="sell-condition-step">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {ar ? "ما هي حالة السيارة التي تود بيعها؟" : "What is the condition of your vehicle?"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ar
            ? "حدد ما إذا كانت السيارة جديدة بالكامل أو مستعملة لعرض الحقول المناسبة لاحقاً."
            : "Choose whether the vehicle is brand new or pre-owned to configure relevant fields."}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label={ar ? "حالة السيارة" : "Vehicle Condition"}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {CONDITIONS.map((option) => {
          const isSelected = currentCondition === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isTransitionPending}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "relative flex flex-col items-start p-5 rounded-xl border-2 text-start transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                "hover:border-primary/50 hover:bg-muted/30 cursor-pointer min-h-[7.5rem]",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card",
              )}
              data-testid={`condition-option-${option.value.toLowerCase()}`}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {isSelected ? (
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                ) : (
                  <div className="h-5 w-5 rounded-full border border-muted-foreground/40" />
                )}
              </div>

              <div className="mt-4">
                <span className="font-semibold text-base block text-foreground">
                  {ar ? option.titleAr : option.titleEn}
                </span>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {ar ? option.descAr : option.descEn}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
