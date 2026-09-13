'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { deleteAccount } from '@/server/actions/profile';
import { DeleteAccountInputSchema } from '@/lib/api/schemas/auth';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AppLocale } from '@/i18n/config';
import type { DeleteAccountInput } from '@/types/auth';

export function DeleteAccountDialog({ locale }: { locale: AppLocale }) {
  const ar = locale === 'ar';
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const form = useForm<DeleteAccountInput>({
    resolver: zodResolver(DeleteAccountInputSchema as unknown as Parameters<typeof zodResolver>[0]) as unknown as Resolver<DeleteAccountInput>,
    defaultValues: { password: '', reason: null },
  });

  const submit = form.handleSubmit(async (values) => {
    setGeneralError(null);
    const result = await deleteAccount({
      password: values.password,
      reason: values.reason?.trim() ? values.reason.trim() : null,
    });

    if (!result.ok) {
      form.setValue('password', '');
      for (const error of result.error.fieldErrors) {
        if (error.field === 'password' || error.field === 'reason') {
          form.setError(error.field, { message: error.message });
        }
      }
      setGeneralError(result.error.message);
      return;
    }

    queryClient.clear();
    setOpen(false);
    router.replace(`/${locale}`);
    router.refresh();
  });

  return (
    <AlertDialog open={open} onOpenChange={(value) => { if (!form.formState.isSubmitting) { setOpen(value); if (!value) { setGeneralError(null); form.reset(); } } }}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" data-testid="delete-account-trigger"><Trash2 className="me-2 h-4 w-4" />{ar ? 'حذف الحساب' : 'Delete account'}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="delete-account-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />{ar ? 'حذف الحساب نهائيًا' : 'Permanently delete account'}</AlertDialogTitle>
          <AlertDialogDescription>{ar ? 'لا يمكن التراجع عن هذا الإجراء. لن يتم حذف الحساب حتى يؤكد الخادم كلمة المرور.' : 'This cannot be undone. Your account will only be deleted after the server verifies your password.'}</AlertDialogDescription>
        </AlertDialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {generalError ? <Alert variant="destructive" role="alert"><AlertDescription>{generalError}</AlertDescription></Alert> : null}
          <div className="space-y-2">
            <Label htmlFor="delete-account-password">{ar ? 'كلمة المرور' : 'Password'}</Label>
            <Input id="delete-account-password" type="password" autoComplete="current-password" disabled={form.formState.isSubmitting} aria-invalid={Boolean(form.formState.errors.password)} {...form.register('password')} />
            {form.formState.errors.password ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.password.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="delete-account-reason">{ar ? 'السبب (اختياري)' : 'Reason (optional)'}</Label>
            <Textarea id="delete-account-reason" maxLength={500} disabled={form.formState.isSubmitting} {...form.register('reason', { setValueAs: (value) => value === '' ? null : value })} />
            {form.formState.errors.reason ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.reason.message}</p> : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={form.formState.isSubmitting}>{ar ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting} data-testid="delete-account-submit">
              {form.formState.isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Trash2 className="me-2 h-4 w-4" />}
              {ar ? 'حذف حسابي نهائيًا' : 'Delete my account'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

