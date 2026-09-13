'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  useForm,
  type FieldPath,
  type FieldValues,
  type Resolver,
  type UseFormSetError,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { updateProfile, changePassword } from '@/server/actions/profile';
import { UpdateProfileInputSchema } from '@/lib/api/schemas/profile';
import { ChangePasswordInputSchema } from '@/lib/api/schemas/auth';
import { queryKeys } from '@/lib/query/keys';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/providers/session-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AppLocale } from '@/i18n/config';
import type { ChangePasswordInput } from '@/types/auth';
import type { UpdateProfileInput, UserProfile } from '@/types/profile';

function applyFieldErrors<T extends FieldValues>(
  errors: { field: string; message: string }[],
  setError: UseFormSetError<T>,
  allowed: ReadonlySet<string>
) {
  for (const error of errors) {
    if (allowed.has(error.field)) {
      setError(error.field as FieldPath<T>, { message: error.message });
    }
  }
}

export function ProfileForm({ profile, locale }: { profile: UserProfile; locale: AppLocale }) {
  const ar = locale === 'ar';
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refetch: refetchSession } = useSession();
  const [message, setMessage] = React.useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileInputSchema as unknown as Parameters<typeof zodResolver>[0]) as unknown as Resolver<UpdateProfileInput>,
    defaultValues: {
      firstName: profile.firstName ?? undefined,
      lastName: profile.lastName ?? undefined,
      locale: profile.locale,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setMessage(null);
    const result = await updateProfile(values);
    if (!result.ok) {
      applyFieldErrors<UpdateProfileInput>(
        result.error.fieldErrors,
        form.setError,
        new Set(['firstName', 'lastName', 'phone', 'locale', 'avatarFileId'])
      );
      setMessage({ tone: 'error', text: result.error.message });
      return;
    }

    queryClient.setQueryData(queryKeys.profile(), { data: result.data });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.profile() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.me() }),
      refetchSession(),
    ]);
    setMessage({ tone: 'success', text: ar ? 'تم حفظ بياناتك' : 'Your profile was saved' });
    router.replace(`/${locale}/profile`);
    router.refresh();
  });

  return (
    <Card data-testid="profile-form-card">
      <CardHeader>
        <CardTitle>{ar ? 'البيانات الأساسية' : 'Basic information'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-5" data-testid="profile-form">
          {message ? (
            <Alert variant={message.tone === 'error' ? 'destructive' : 'success'} role="status">
              {message.tone === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-first-name">{ar ? 'الاسم الأول' : 'First name'}</Label>
              <Input id="profile-first-name" autoComplete="given-name" disabled={form.formState.isSubmitting} aria-invalid={Boolean(form.formState.errors.firstName)} aria-describedby={form.formState.errors.firstName ? 'profile-first-name-error' : undefined} {...form.register('firstName')} />
              {form.formState.errors.firstName ? <p id="profile-first-name-error" role="alert" className="text-xs text-destructive">{form.formState.errors.firstName.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-last-name">{ar ? 'اسم العائلة' : 'Last name'}</Label>
              <Input id="profile-last-name" autoComplete="family-name" disabled={form.formState.isSubmitting} aria-invalid={Boolean(form.formState.errors.lastName)} aria-describedby={form.formState.errors.lastName ? 'profile-last-name-error' : undefined} {...form.register('lastName')} />
              {form.formState.errors.lastName ? <p id="profile-last-name-error" role="alert" className="text-xs text-destructive">{form.formState.errors.lastName.message}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-locale">{ar ? 'لغة الحساب' : 'Account language'}</Label>
            <select id="profile-locale" className="flex h-12 w-full rounded-md border border-input bg-card px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={form.formState.isSubmitting} {...form.register('locale')}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto" data-testid="profile-save">
              {form.formState.isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {ar ? 'حفظ التغييرات' : 'Save changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function ChangePasswordForm({ locale }: { locale: AppLocale }) {
  const ar = locale === 'ar';
  const [show, setShow] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordInputSchema as unknown as Parameters<typeof zodResolver>[0]) as unknown as Resolver<ChangePasswordInput>,
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    setMessage(null);
    const result = await changePassword(values);
    form.setValue('currentPassword', '');
    form.setValue('newPassword', '');
    form.setValue('confirmPassword', '');
    if (!result.ok) {
      applyFieldErrors<ChangePasswordInput>(result.error.fieldErrors, form.setError, new Set(['currentPassword', 'newPassword', 'confirmPassword']));
      setMessage({ tone: 'error', text: result.error.message });
      return;
    }
    setMessage({ tone: 'success', text: ar ? 'تم تغيير كلمة المرور' : 'Password changed successfully' });
    form.reset();
  });

  return (
    <Card data-testid="change-password-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" />{ar ? 'تغيير كلمة المرور' : 'Change password'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          {message ? <Alert role="status" variant={message.tone === 'error' ? 'destructive' : 'success'}><AlertDescription>{message.text}</AlertDescription></Alert> : null}
          {([
            ['currentPassword', ar ? 'كلمة المرور الحالية' : 'Current password', 'current-password'],
            ['newPassword', ar ? 'كلمة المرور الجديدة' : 'New password', 'new-password'],
            ['confirmPassword', ar ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password', 'new-password'],
          ] as const).map(([name, label, autoComplete]) => (
            <div key={name} className="space-y-2">
              <Label htmlFor={`password-${name}`}>{label}</Label>
              <div className="relative">
                <Input id={`password-${name}`} type={show ? 'text' : 'password'} autoComplete={autoComplete} className="pe-11" disabled={form.formState.isSubmitting} aria-invalid={Boolean(form.formState.errors[name])} {...form.register(name)} />
                {name === 'newPassword' ? <Button type="button" size="icon" variant="ghost" className="absolute end-1 top-1/2 h-9 w-9 -translate-y-1/2" onClick={() => setShow((value) => !value)} aria-label={show ? (ar ? 'إخفاء كلمات المرور' : 'Hide passwords') : (ar ? 'إظهار كلمات المرور' : 'Show passwords')}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button> : null}
              </div>
              {form.formState.errors[name] ? <p role="alert" className="text-xs text-destructive">{form.formState.errors[name]?.message}</p> : null}
            </div>
          ))}
          <Button type="submit" variant="outline" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
            {form.formState.isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            {ar ? 'تحديث كلمة المرور' : 'Update password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
