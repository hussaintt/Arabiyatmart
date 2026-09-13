"use client";

import * as React from "react";
import { useSellStore } from "@/components/sell/sell-workflow";
import { CentsInput } from "@/components/sell/cents-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Banknote, CheckCircle, HandCoins, RefreshCw } from "lucide-react";
import type { AppLocale } from "@/i18n/config";

interface PricingStepProps {
  locale: AppLocale;
}

export function PricingStep({ locale }: PricingStepProps) {
  const draft = useSellStore((state) => state.draft);
  const updateDraft = useSellStore((state) => state.updateDraft);
  const isTransitionPending = useSellStore((state) => state.isTransitionPending);
  const ar = locale === "ar";

  const handlePriceChange = (cents: number | null) => {
    updateDraft({ priceCents: cents });
  };

  return (
    <div className="space-y-6" data-testid="sell-pricing-step">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {ar ? "السعر وخيارات الدفع" : "Price & Payment Options"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ar
            ? "حدد السعر المطلوب بالجنيه المصري وخيارات التفاوض أو التقسيط المتاحة."
            : "Set your asking price in Egyptian Pounds (EGP) and specify sale conditions."}
        </p>
      </div>

      {/* Main Asking Price via CentsInput */}
      <div className="max-w-md">
        <CentsInput
          id="pricing-amount"
          name="priceCents"
          label={ar ? "السعر المطلوب (ج.م)" : "Asking Price (EGP)"}
          value={draft.priceCents}
          onChange={handlePriceChange}
          currency="EGP"
          locale={locale}
          disabled={isTransitionPending}
          required
        />
      </div>

      {/* Negotiation & Payment Terms */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-semibold text-foreground">
          {ar ? "شروط البيع والتفاوض" : "Sale Terms & Negotiation"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Negotiable */}
          <label
            htmlFor="pricing-negotiable"
            className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <Checkbox
              id="pricing-negotiable"
              checked={draft.isNegotiable}
              onCheckedChange={(checked) => updateDraft({ isNegotiable: Boolean(checked) })}
              disabled={isTransitionPending}
              data-testid="checkbox-negotiable"
              className="mt-0.5"
            />
            <div className="text-sm">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <HandCoins className="h-4 w-4 text-primary" />
                {ar ? "قابل للتفاوض" : "Negotiable"}
              </span>
              <span className="text-xs text-muted-foreground block mt-1">
                {ar ? "السعر قابل للتفاوض" : "Price is negotiable"}
              </span>
            </div>
          </label>

          {/* Installment */}
          <label
            htmlFor="pricing-installment"
            className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <Checkbox
              id="pricing-installment"
              checked={draft.installmentAvailable}
              onCheckedChange={(checked) => updateDraft({ installmentAvailable: Boolean(checked) })}
              disabled={isTransitionPending}
              data-testid="checkbox-installment"
              className="mt-0.5"
            />
            <div className="text-sm">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                {ar ? "إمكانية التقسيط" : "Installment"}
              </span>
              <span className="text-xs text-muted-foreground block mt-1">
                {ar ? "متاح بالتقسيط المباشر أو البنكي" : "Installment plans available"}
              </span>
            </div>
          </label>

          {/* Exchange Accepted */}
          <label
            htmlFor="pricing-exchange"
            className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card cursor-pointer hover:bg-muted/30 transition-colors"
          >
            <Checkbox
              id="pricing-exchange"
              checked={draft.exchangeAccepted}
              onCheckedChange={(checked) => updateDraft({ exchangeAccepted: Boolean(checked) })}
              disabled={isTransitionPending}
              data-testid="checkbox-exchange"
              className="mt-0.5"
            />
            <div className="text-sm">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                {ar ? "إمكانية البدل" : "Exchange Accepted"}
              </span>
              <span className="text-xs text-muted-foreground block mt-1">
                {ar ? "قبول استبدال بسيارة أخرى مع فرق السعر" : "Trade-in or vehicle exchange accepted"}
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Validation hint */}
      {draft.priceCents && draft.priceCents > 0 ? (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            {ar ? "تم إدخال السعر بشكل سليم ويمكنك الانتقال إلى خطوة الصور." : "Valid asking price set. You may continue to photos."}
          </span>
        </div>
      ) : null}
    </div>
  );
}
