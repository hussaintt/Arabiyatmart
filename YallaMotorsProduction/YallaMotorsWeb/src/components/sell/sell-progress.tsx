"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SELL_STEPS } from "@/stores/sell-store";
import type { AppLocale } from "@/i18n/config";
import type { SellStep } from "@/types/sell";

const LABELS: Record<SellStep, { ar: string; en: string }> = {
  condition: { ar: "الحالة", en: "Condition" },
  vehicle: { ar: "السيارة", en: "Vehicle" },
  details: { ar: "التفاصيل", en: "Details" },
  pricing: { ar: "السعر", en: "Pricing" },
  photos: { ar: "الصور", en: "Photos" },
  location: { ar: "الموقع", en: "Location" },
  review: { ar: "المراجعة", en: "Review" },
};

interface SellProgressProps {
  currentStep: SellStep;
  locale: AppLocale;
  onStepSelect: (step: SellStep) => void;
}

export function SellProgress({
  currentStep,
  locale,
  onStepSelect,
}: SellProgressProps) {
  const currentIndex = SELL_STEPS.indexOf(currentStep);
  const ar = locale === "ar";
  return (
    <nav aria-label={ar ? "خطوات إضافة الإعلان" : "Sell listing progress"}>
      <div className="mb-4 lg:hidden">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold">
          <span>{LABELS[currentStep][locale]}</span>
          <span>
            {currentIndex + 1}/{SELL_STEPS.length}
          </span>
        </div>
        <Progress value={currentIndex + 1} max={SELL_STEPS.length} />
      </div>
      <ol className="hidden space-y-2 lg:block" data-testid="sell-step-rail">
        {SELL_STEPS.map((step, index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step}>
              <Button
                type="button"
                variant={active ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => onStepSelect(step)}
                disabled={index > currentIndex}
                aria-current={active ? "step" : undefined}
              >
                <span className="me-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs">
                  {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                {LABELS[step][locale]}
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function sellStepLabel(step: SellStep, locale: AppLocale): string {
  return LABELS[step][locale];
}
