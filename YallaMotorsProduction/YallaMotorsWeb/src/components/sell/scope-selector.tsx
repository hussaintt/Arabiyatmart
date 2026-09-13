'use client';

import * as React from 'react';
import { Building2, Check, CheckCircle2, ShieldCheck, User } from 'lucide-react';
import type { AppLocale } from '@/i18n/config';
import type { ListingOwnershipScope } from '@/types/sell';

interface ScopeSelectorProps {
  scopes: ListingOwnershipScope[];
  selectedScopeId: string | null;
  onSelectScope: (scopeId: string) => void;
  locale: AppLocale;
  disabled?: boolean;
}

function roleLabel(role: string, locale: AppLocale): string {
  const isAr = locale === 'ar';
  switch (role) {
    case 'OWNER':
      return isAr ? 'مالك المعرض' : 'Dealership Owner';
    case 'MANAGER':
      return isAr ? 'مدير المعرض' : 'Dealership Manager';
    case 'STAFF':
      return isAr ? 'موظف المعرض' : 'Dealership Staff';
    case 'INDIVIDUAL':
    default:
      return isAr ? 'بائع شخصي (أفراد)' : 'Individual Seller';
  }
}

export function ScopeSelector({
  scopes,
  selectedScopeId,
  onSelectScope,
  locale,
  disabled = false,
}: ScopeSelectorProps) {
  const isAr = locale === 'ar';

  if (!scopes || scopes.length === 0) return null;

  return (
    <section
      aria-labelledby="scope-selector-heading"
      className="rounded-xl border bg-card p-5 mb-6 shadow-sm"
      data-testid="listing-scope-selector"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4 mb-4">
        <div>
          <h2 id="scope-selector-heading" className="text-lg font-bold">
            {isAr ? 'جهة ملكية الإعلان' : 'Listing Ownership Scope'}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {scopes.length > 1
              ? isAr
                ? 'يرجى تحديد الحساب (الشخصي أو المعرض) الذي ترغب في نشر الإعلان من خلاله.'
                : 'Select whether to publish this listing under your personal account or an authorized dealership.'
              : isAr
                ? 'يتم نشر هذا الإعلان تحت حسابك الموثق.'
                : 'This listing will be published under your verified account.'}
          </p>
        </div>
        {scopes.length > 1 && (
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            {isAr ? 'اختيار إلزامي' : 'Selection required'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {scopes.map((scope) => {
          const isSelected = selectedScopeId === scope.id;
          const isDealer = scope.type === 'dealership';

          return (
            <button
              key={scope.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectScope(scope.id)}
              aria-pressed={isSelected}
              data-testid={`scope-card-${scope.id}`}
              className={`relative flex flex-col justify-between rounded-lg border-2 p-4 text-start transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                  : 'border-muted hover:border-muted-foreground/30 hover:bg-muted/30'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      isDealer
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isDealer ? (
                      <Building2 className="h-5 w-5" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">
                      {scope.displayName}
                    </h3>
                    <span className="inline-block mt-1 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {roleLabel(scope.role, locale)}
                    </span>
                  </div>
                </div>

                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/30'
                  }`}
                >
                  {isSelected ? <Check className="h-3 w-3 stroke-[3]" /> : null}
                </div>
              </div>

              {/* Prerequisites & Quota info */}
              <div className="mt-4 border-t pt-3 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    {isAr
                      ? scope.phoneVerified
                        ? 'الهاتف موثق وجاهز للنشر'
                        : 'يتطلب توثيق الهاتف'
                      : scope.phoneVerified
                        ? 'Phone verified and ready to publish'
                        : 'Phone verification required'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>
                    {isAr
                      ? `سعة الحساب: حتى ${scope.quota.maxLimit} إعلانات نشطة`
                      : `Active quota: Up to ${scope.quota.maxLimit} listings`}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
