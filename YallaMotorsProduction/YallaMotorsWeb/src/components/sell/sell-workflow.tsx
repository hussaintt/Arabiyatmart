"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useStore } from "zustand";
import { Button } from "@/components/ui/button";
import { QueryClientContext } from "@tanstack/react-query";
import { QueryProvider } from "@/providers/query-provider";
import { DraftRecoveryDialog } from "@/components/sell/draft-recovery-dialog";
import { SellProgress, sellStepLabel } from "@/components/sell/sell-progress";
import { ConditionStep } from "@/components/sell/steps/condition-step";
import { VehicleStep } from "@/components/sell/steps/vehicle-step";
import { DetailsStep } from "@/components/sell/steps/details-step";
import { PricingStep } from "@/components/sell/steps/pricing-step";
import { PhotosStep } from "@/components/sell/steps/photos-step";
import { ContactLocationStep } from "@/components/sell/steps/contact-location-step";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ReviewStep } from "@/components/sell/steps/review-step";
import { projectDraftToCreateInput } from "@/lib/api/schemas/sell";
import { createListing } from "@/server/actions/listings";
import {
  SELL_STEPS,
  createInitialSellWizardState,
  createSellStore,
  isSellStepComplete,
  type SellStore,
  type SellStoreApi,
} from "@/stores/sell-store";
import type { AppLocale } from "@/i18n/config";
import type { SellWizardState } from "@/types/sell";
import { trackAnalytics } from "@/lib/analytics/client";

import { ScopeSelector } from "@/components/sell/scope-selector";
import type { ListingOwnershipScope } from "@/types/sell";

const SellStoreContext = React.createContext<SellStoreApi | null>(null);

export function useSellStore<T>(selector: (state: SellStore) => T): T {
  const store = React.useContext(SellStoreContext);
  if (!store) throw new Error("useSellStore must be used inside SellWorkflow");
  return useStore(store, selector);
}

interface SellWorkflowContentProps {
  locale: AppLocale;
  scopes: ListingOwnershipScope[];
  selectedScopeId: string | null;
  onSelectScope: (scopeId: string) => void;
}

interface SellWorkflowProps {
  userPublicId: string;
  locale: AppLocale;
  initialState?: SellWizardState | undefined;
  eligibleScopes?: ListingOwnershipScope[] | undefined;
}

function SellWorkflowContent({
  locale,
  scopes,
  selectedScopeId,
  onSelectScope,
}: SellWorkflowContentProps) {
  const currentStep = useSellStore((state) => state.currentStep);
  const draft = useSellStore((state) => state.draft);
  const photos = useSellStore((state) => state.photos);
  const recoveryDraft = useSellStore((state) => state.recoveryDraft);
  const isTransitionPending = useSellStore(
    (state) => state.isTransitionPending,
  );
  const isSubmitting = useSellStore((state) => state.isSubmitting);
  const errorMessage = useSellStore((state) => state.errorMessage);
  const nextStep = useSellStore((state) => state.nextStep);
  const previousStep = useSellStore((state) => state.previousStep);
  const goToStep = useSellStore((state) => state.goToStep);
  const restoreDraft = useSellStore((state) => state.restoreDraft);
  const discardDraft = useSellStore((state) => state.discardDraft);
  const coverPhotoClientId = useSellStore((state) => state.coverPhotoClientId);
  const setSubmitting = useSellStore((state) => state.setSubmitting);
  const router = React.useContext(AppRouterContext);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const idempotencyKeyRef = React.useRef<string | null>(null);

  const activeScope = scopes.find((s) => s.id === selectedScopeId) ?? null;
  const hasMultipleScopes = scopes.length > 1;
  const isScopeSelected = Boolean(selectedScopeId);

  React.useEffect(() => {
    trackAnalytics({ name: 'sell_step', step: SELL_STEPS.indexOf(currentStep) + 1, action: 'view' });
  }, [currentStep]);

  if (!idempotencyKeyRef.current) {
    idempotencyKeyRef.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `idem_${Date.now()}`;
  }

  const handleSubmit = async () => {
    if (pending) return;
    if (hasMultipleScopes && !isScopeSelected) {
      setSubmitError(
        ar
          ? "يرجى تحديد جهة ملكية الإعلان أولاً"
          : "Please select an ownership scope first"
      );
      return;
    }
    setSubmitError(null);
    setSubmitting(true);

    try {
      const input = projectDraftToCreateInput(
        draft,
        photos,
        coverPhotoClientId,
      );
      const result = await createListing(
        input,
        idempotencyKeyRef.current ?? undefined,
        activeScope?.vendorPublicId,
      );

      if (!result.ok) {
        trackAnalytics({ name: 'sell_outcome', operation: 'submit', outcome: 'failed', code: result.error.code, status: result.error.status, requestId: result.error.requestId });
        setSubmitError(
          result.error.message ||
            (ar ? "فشل إرسال الإعلان" : "Failed to create listing"),
        );
        setSubmitting(false);
        return;
      }

      trackAnalytics({ name: 'sell_outcome', operation: 'submit', outcome: 'succeeded' });

      discardDraft();
      const targetPath = result.data.slug
        ? `/${locale}/listing/${result.data.slug}`
        : `/${locale}/me/listings`;

      if (router) {
        router.replace(targetPath);
      } else if (typeof window !== "undefined") {
        window.location.assign(targetPath);
      }
    } catch (err: unknown) {
      trackAnalytics({ name: 'sell_outcome', operation: 'submit', outcome: 'failed', code: 'UNEXPECTED_ERROR' });
      const msg =
        err instanceof Error
          ? err.message
          : ar
            ? "حدث خطأ غير متوقع"
            : "An unexpected error occurred";
      setSubmitError(msg);
      setSubmitting(false);
    }
  };

  const currentIndex = SELL_STEPS.indexOf(currentStep);
  const pending = isTransitionPending || isSubmitting;
  const canContinue = isSellStepComplete({ draft, photos }, currentStep);
  const ar = locale === "ar";
  const isQuotaExhausted = Boolean(activeScope?.quota && activeScope.quota.availableSlots <= 0);

  return (
    <>
      <div
        className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,48rem)_1fr]"
        data-testid="sell-workflow"
      >
        <aside
          aria-label={ar ? "خطوات إضافة الإعلان" : "Listing creation steps"}
          className="min-w-0 rounded-xl border bg-card p-4 lg:sticky lg:top-24 lg:self-start"
        >
          <SellProgress
            currentStep={currentStep}
            locale={locale}
            onStepSelect={(step) => {
              trackAnalytics({ name: 'sell_step', step: SELL_STEPS.indexOf(step) + 1, action: 'view' });
              void goToStep(step);
            }}
          />
        </aside>

        <section
          className="min-w-0 rounded-xl border bg-card p-5 sm:p-6"
          aria-labelledby="sell-step-heading"
          data-testid={`sell-step-${currentStep}`}
        >
          {/* Scope Selector at the top of the workflow */}
          <ScopeSelector
            scopes={scopes}
            selectedScopeId={selectedScopeId}
            onSelectScope={onSelectScope}
            locale={locale}
            disabled={pending}
          />

          {hasMultipleScopes && !isScopeSelected ? (
            <div
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-center text-amber-700 dark:text-amber-300"
              data-testid="scope-selection-prompt"
            >
              <p className="font-semibold text-sm">
                {ar
                  ? "يرجى اختيار جهة ملكية الإعلان (شخصي أو معرض) من الخيارات أعلاه للبدء."
                  : "Please select an ownership scope (personal or dealership) above to begin."}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-primary">
                {ar
                  ? `الخطوة ${currentIndex + 1} من ${SELL_STEPS.length}`
                  : `Step ${currentIndex + 1} of ${SELL_STEPS.length}`}
              </p>
              <h1 id="sell-step-heading" className="mt-1 text-2xl font-bold">
                {sellStepLabel(currentStep, locale)}
              </h1>

              <div className="mt-6">
                {currentStep === "condition" && <ConditionStep locale={locale} />}
                {currentStep === "vehicle" && <VehicleStep locale={locale} />}
                {currentStep === "details" && <DetailsStep locale={locale} />}
                {currentStep === "pricing" && <PricingStep locale={locale} />}
                {currentStep === "photos" && <PhotosStep locale={locale} />}
                {currentStep === "location" && <ContactLocationStep locale={locale} />}
                {currentStep === "review" && (
                  <ReviewStep
                    locale={locale}
                    onSubmit={handleSubmit}
                    isSubmitting={pending}
                    selectedScope={activeScope}
                  />
                )}
              </div>

              {submitError || errorMessage ? (
                <p
                  role="alert"
                  className="mt-4 text-sm text-destructive"
                  data-testid="sell-submit-error"
                >
                  {submitError || errorMessage}
                </p>
              ) : null}

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    trackAnalytics({ name: 'sell_step', step: currentIndex + 1, action: 'back' });
                    void previousStep();
                  }}
                  disabled={pending || currentIndex === 0}
                  data-testid="sell-back"
                >
                  {ar ? (
                    <ArrowRight className="me-2 h-4 w-4" />
                  ) : (
                    <ArrowLeft className="me-2 h-4 w-4" />
                  )}
                  {ar ? "السابق" : "Back"}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (currentIndex === SELL_STEPS.length - 1) {
                      void handleSubmit();
                    } else {
                      trackAnalytics({ name: 'sell_step', step: currentIndex + 1, action: 'next' });
                      void nextStep();
                    }
                  }}
                  disabled={pending || !canContinue || (hasMultipleScopes && !isScopeSelected) || (currentIndex === SELL_STEPS.length - 1 && isQuotaExhausted)}
                  data-testid="sell-next"
                >
                  {pending ? (
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {currentIndex === SELL_STEPS.length - 1
                    ? ar
                      ? "تأكيد ونشر الإعلان"
                      : "Submit"
                    : ar
                      ? "التالي"
                      : "Next"}
                  {!ar && currentIndex < SELL_STEPS.length - 1 ? (
                    <ArrowRight className="ms-2 h-4 w-4" />
                  ) : ar && currentIndex < SELL_STEPS.length - 1 ? (
                    <ArrowLeft className="ms-2 h-4 w-4" />
                  ) : null}
                </Button>
              </div>
            </>
          )}
        </section>

        <aside
          aria-label={ar ? "إرشادات إضافة الإعلان" : "Listing creation tips"}
          className="hidden rounded-xl border bg-muted/40 p-5 xl:block xl:self-start"
        >
          <h2 className="font-bold">{ar ? "نصيحة" : "Tip"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {ar
              ? "تُحفظ المسودة الآمنة لهذا الحساب فقط."
              : "The safe draft is stored only for this account."}
          </p>
        </aside>
      </div>
      <DraftRecoveryDialog
        open={recoveryDraft !== null}
        locale={locale}
        onRestore={() => {
          trackAnalytics({ name: 'sell_step', step: 1, action: 'restore' });
          restoreDraft();
        }}
        onDiscard={() => {
          trackAnalytics({ name: 'sell_step', step: 1, action: 'discard' });
          discardDraft();
        }}
      />
    </>
  );
}

export function SellWorkflow({
  userPublicId,
  locale,
  initialState = createInitialSellWizardState(),
  eligibleScopes,
}: SellWorkflowProps) {
  const scopes: ListingOwnershipScope[] = React.useMemo(() => {
    if (eligibleScopes && eligibleScopes.length > 0) return eligibleScopes;
    return [
      {
        id: "personal",
        type: "personal",
        displayName:
          locale === "ar"
            ? "حساب شخصي (أفراد)"
            : "Personal Account (Individual)",
        role: "INDIVIDUAL",
        isVerified: true,
        phoneVerified: true,
        quota: { currentCount: 0, maxLimit: 5, availableSlots: 5 },
      },
    ];
  }, [eligibleScopes, locale]);

  const firstScope = scopes[0];
  const [selectedScopeId, setSelectedScopeId] = React.useState<string | null>(
    scopes.length === 1 && firstScope ? firstScope.id : null,
  );

  const initialScopeId = (scopes.length === 1 && firstScope) ? firstScope.id : "personal";

  const storeRef = React.useRef<SellStoreApi | null>(null);
  if (!storeRef.current) {
    storeRef.current = createSellStore({
      userPublicId,
      scopeId: initialScopeId,
      initialState,
    });
  }
  const store = storeRef.current;

  const handleSelectScope = React.useCallback(
    (scopeId: string) => {
      setSelectedScopeId(scopeId);
      store.getState().setScopeId(scopeId);
      store.getState().hydrate();
    },
    [store],
  );

  React.useEffect(() => {
    store.getState().hydrate();
    return () => store.destroySellStore();
  }, [store]);

  React.useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!store.getState().isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [store]);

  const hasQueryClient = Boolean(React.useContext(QueryClientContext));

  const content = (
    <SellStoreContext.Provider value={store}>
      <SellWorkflowContent
        locale={locale}
        scopes={scopes}
        selectedScopeId={selectedScopeId}
        onSelectScope={handleSelectScope}
      />
    </SellStoreContext.Provider>
  );

  if (!hasQueryClient) {
    return <QueryProvider>{content}</QueryProvider>;
  }

  return content;
}
