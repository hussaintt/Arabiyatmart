'use client';

import * as React from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Locale } from '@/types/common';
import type { ForgotPasswordInput } from '@/types/auth';
import { ForgotPasswordInputSchema } from '@/lib/api/schemas/auth';
import { forgotPassword } from '@/server/actions/verification';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MailCheck, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';

interface ForgotPasswordFormProps {
  locale: Locale;
}

export function ForgotPasswordForm({ locale }: ForgotPasswordFormProps) {
  const isAr = locale === 'ar';
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(
      ForgotPasswordInputSchema as unknown as Parameters<typeof zodResolver>[0]
    ) as unknown as Resolver<ForgotPasswordInput>,
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      // Regardless of whether the upstream account exists or not,
      // forgotPassword writes the encrypted HttpOnly reset flow cookie and returns
      // the exact same non-enumerating message.
      await forgotPassword(data);
    } catch {
      // Non-disclosure: even if an upstream 500 occurred or account not found,
      // present the same accepted view to prevent email enumeration.
    } finally {
      setIsSubmitted(true);
    }
  };

  if (isSubmitted) {
    return (
      <div
        className="text-center space-y-6 animate-in fade-in-50"
        data-testid="forgot-password-success-view"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 text-green-600 mx-auto shadow-sm">
          <MailCheck className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {isAr ? 'تم إرسال تعليمات الاستعادة' : 'Check Your Email'}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            {isAr
              ? 'إذا كان هذا البريد مسجلاً لدينا، فقد أرسلنا إليه رمز تحقق صالح لمدة ١٥ دقيقة لاستعادة كلمة المرور.'
              : 'If this email is registered with us, we have sent a 15-minute verification code to reset your password.'}
          </p>
        </div>

        <Alert className="text-xs text-muted-foreground text-start bg-muted/30 border-border">
          <AlertDescription>
            {isAr
              ? 'تأكد من فحص مجلد الرسائل غير المرغوب فيها (Spam) إذا لم تجد الرسالة في صندوق الوارد.'
              : 'Please check your spam or junk folder if you do not see the email in your inbox.'}
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-3 pt-2">
          <Link href="/reset-password">
            <Button
              className="w-full h-11 text-base font-semibold"
              data-testid="continue-to-reset-button"
            >
              {isAr ? 'إدخال رمز التحقق' : 'Enter Verification Code'}
            </Button>
          </Link>

          <Link href="/login">
            <Button
              variant="outline"
              className="w-full h-11 text-sm font-medium gap-2"
            >
              {isAr ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              <span>{isAr ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-4 w-full"
      data-testid="forgot-password-form"
    >
      <div className="space-y-1.5">
        <Label htmlFor="forgot-email">
          {isAr ? 'البريد الإلكتروني' : 'Email Address'}
        </Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          placeholder={isAr ? 'name@example.com' : 'name@example.com'}
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'forgot-email-error' : undefined}
          data-testid="forgot-email-input"
          className="h-11"
          {...register('email')}
        />
        {errors.email && (
          <p
            id="forgot-email-error"
            role="alert"
            data-testid="forgot-email-error"
            className="text-xs font-medium text-destructive mt-1"
          >
            {errors.email.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        data-testid="forgot-password-submit-button"
        className="w-full h-11 text-base font-semibold mt-2"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{isAr ? 'جاري الإرسال...' : 'Sending...'}</span>
          </span>
        ) : (
          isAr ? 'إرسال رمز الاستعادة' : 'Send Reset Code'
        )}
      </Button>

      <div className="text-center pt-2">
        <Link
          href="/login"
          className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
        >
          {isAr ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
          <span>{isAr ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}</span>
        </Link>
      </div>
    </form>
  );
}
