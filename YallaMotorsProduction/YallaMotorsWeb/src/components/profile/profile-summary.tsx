import { CalendarDays, CheckCircle2, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/i18n/format';
import type { AppLocale } from '@/i18n/config';
import type { UserProfile } from '@/types/profile';

export interface ProfileSummaryProps {
  profile: UserProfile;
  locale: AppLocale;
}

function initials(profile: UserProfile): string {
  const value = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .map((part) => part!.trim().charAt(0))
    .join('');
  return (value || profile.email.charAt(0)).slice(0, 2).toUpperCase();
}

export function ProfileSummary({ profile, locale }: ProfileSummaryProps) {
  const ar = locale === 'ar';
  const displayName =
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
    (ar ? 'مستخدم عربيات مارت' : 'Arabiyat Mart member');

  return (
    <Card data-testid="profile-summary" className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-background shadow-sm">
            {profile.avatarUrl ? (
              <AvatarImage src={profile.avatarUrl} alt={displayName} />
            ) : null}
            <AvatarFallback className="text-lg">{initials(profile)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle as="h2" className="truncate text-xl">{displayName}</CardTitle>
            <p className="mt-1 truncate text-sm text-muted-foreground" dir="ltr">
              {profile.email}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="mt-4 sm:mt-0">
          <Link href="/profile/edit" locale={locale}>
            {ar ? 'تعديل الملف الشخصي' : 'Edit profile'}
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
        <div className="flex min-w-0 items-start gap-3 rounded-lg border p-4">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{ar ? 'البريد الإلكتروني' : 'Email'}</p>
            <p className="mt-1 truncate text-sm font-medium" dir="ltr">{profile.email}</p>
            <Badge className="mt-2" variant={profile.emailVerifiedAt ? 'success' : 'outline'}>
              {profile.emailVerifiedAt
                ? ar ? 'موثّق' : 'Verified'
                : ar ? 'غير موثّق' : 'Not verified'}
            </Badge>
          </div>
        </div>

        <div className="flex min-w-0 items-start gap-3 rounded-lg border p-4">
          <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{ar ? 'رقم الهاتف' : 'Phone'}</p>
            <p className="mt-1 text-sm font-medium" dir="ltr">{profile.phone ?? (ar ? 'غير مضاف' : 'Not added')}</p>
            {profile.phoneVerifiedAt ? (
              <Badge className="mt-2" variant="success">{ar ? 'موثّق' : 'Verified'}</Badge>
            ) : (
              <Button asChild variant="link" className="mt-1 h-auto px-0 text-xs">
                <Link href="/profile?panel=verify-phone" locale={locale}>
                  {ar ? 'تأكيد رقم الهاتف' : 'Verify phone'}
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border p-4">
          <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-xs text-muted-foreground">{ar ? 'نوع الحساب' : 'Account type'}</p>
            <p className="mt-1 text-sm font-medium">
              {profile.accountType === 'VENDOR'
                ? ar ? 'بائع' : 'Vendor'
                : profile.accountType === 'ADMIN'
                  ? ar ? 'مدير' : 'Administrator'
                  : ar ? 'مشتري' : 'Customer'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border p-4">
          <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-xs text-muted-foreground">{ar ? 'عضو منذ' : 'Member since'}</p>
            <p className="mt-1 text-sm font-medium">{formatDate(profile.createdAt, locale)}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border p-4 sm:col-span-2">
          {profile.status === 'ACTIVE' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
          ) : (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          )}
          <div>
            <p className="text-xs text-muted-foreground">{ar ? 'حالة الحساب' : 'Account status'}</p>
            <p className="mt-1 text-sm font-medium">{profile.status}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

