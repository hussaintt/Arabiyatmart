'use client';

import * as React from 'react';
import { Building2 } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { Label } from '@/components/ui/label';
import { setActiveVendor } from '@/server/actions/vendors';
import type { AppLocale } from '@/i18n/config';
import type { VendorMembershipWithVendor } from '@/types/dealer';
import { trackAnalytics } from '@/lib/analytics/client';

export function VendorSwitcher({ memberships, activeVendorPublicId, locale, allowPrivate = false }: { memberships: VendorMembershipWithVendor[]; activeVendorPublicId: string | null; locale: AppLocale; allowPrivate?: boolean }) {
  const ar = locale === 'ar';
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedVendorPublicId, setSelectedVendorPublicId] = React.useState(activeVendorPublicId);
  if (memberships.length === 0) return null;

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    const nextVendorPublicId = value === 'PRIVATE' ? null : value;
    const previousVendorPublicId = selectedVendorPublicId;
    setSelectedVendorPublicId(nextVendorPublicId);
    setPending(true);
    setError(null);
    const result = await setActiveVendor({ vendorPublicId: nextVendorPublicId });
    setPending(false);
    if (!result.ok) {
      trackAnalytics({ name: 'vendor_switch', scope: nextVendorPublicId ? 'vendor' : 'private', outcome: 'failed' });
      setSelectedVendorPublicId(previousVendorPublicId);
      setError(ar ? 'تعذّر تغيير حساب البائع.' : 'The seller account could not be changed.');
      return;
    }
    trackAnalytics({ name: 'vendor_switch', scope: nextVendorPublicId ? 'vendor' : 'private', outcome: 'succeeded' });
    router.refresh();
  }

  return (
    <div className="rounded-xl border bg-card p-4" data-testid="vendor-switcher">
      <Label htmlFor="active-vendor" className="mb-2 flex items-center gap-2"><Building2 className="h-4 w-4" />{ar ? 'حساب البائع النشط' : 'Active seller account'}</Label>
      <select id="active-vendor" value={selectedVendorPublicId ?? (allowPrivate ? 'PRIVATE' : '')} onChange={handleChange} disabled={pending} className="h-11 w-full rounded-md border bg-background px-3 text-sm font-medium">
        {!allowPrivate && !selectedVendorPublicId ? <option value="" disabled>{ar ? 'اختر حسابًا' : 'Select an account'}</option> : null}
        {allowPrivate ? <option value="PRIVATE">{ar ? 'إعلاناتي الشخصية' : 'My private listings'}</option> : null}
        {memberships.map(({ vendor, membership }) => <option key={vendor.publicId} value={vendor.publicId}>{vendor.displayName[locale]} · {membership.role}</option>)}
      </select>
      {pending ? <p className="mt-2 text-xs text-muted-foreground" role="status">{ar ? 'جارٍ التغيير…' : 'Switching…'}</p> : null}
      {error ? <p className="mt-2 text-xs text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
