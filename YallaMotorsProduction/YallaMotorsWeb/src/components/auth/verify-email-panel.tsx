'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Locale } from '@/types/common';
import type { OtpVerifyInput } from '@/types/auth';
import { OtpVerifyInputSchema } from '@/lib/api/schemas/auth';
import { sanitizeReturnTo } from '@/lib/auth/return-to';
import { verifyOtp, resendEmailVerification } from '@/server/actions/verification';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Loader2, AlertCircle, CheckCircle2, RotateCw } from 'lucide-react';

interface VerifyEmailPanelProps {
  locale: Locale;
  maskedEmail: string;
  returnTo?: string | null;
}

export function VerifyEmailPanel({
  locale,
  maskedEmail,
  returnTo,
}: VerifyEmailPanelProps) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState<number>(0);
  const [isResending, setIsResending] = React.useState<boolean>(false);

  const safeReturn = returnTo ? sanitizeReturnTo(returnTo, locale) : `/${locale}`;

  // Cooldown countdown timer
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OtpVerifyInput>({
    resolver: zodResolver(
      OtpVerifyInputSchema as unknown as Parameters<typeof zodResolver>[0]
    ) as unknown as Resolver<OtpVerifyInput>,
    defaultValues: {
      purpose: 'EMAIL_VERIFY',
      code: '',
    },
  });

  const onSubmit = async (data: OtpVerifyInput) => {
    setGeneralError(null);
    setSuccessMessage(null);

    try {
      const result = await verifyOtp(data);

      if (result.ok) {
        setSuccessMessage(
          isAr
            ? 'تم تأكيد بريدك الإلكتروني بنجاح! جاري تحويلك...'
            : 'Email verified successfully! Redirecting...'
        );
        router.push(safeReturn);
      } else {
        setValue('code', '');
        if (result.error.fieldErrors && result.error.fieldErrors.length > 0) {
          for (const fe of result.error.fieldErrors) {
            if (fe.field === 'code') {
              setError('code', { message: fe.message });
            }
          }
        }
        setGeneralError(
          result.error.message ||
            (isAr
              ? 'رمز التحقق غير صحيح أو انتهت صلاحيته'
              : 'Invalid or expired verification code')
        );
      }
    } catch {
      setValue('code', '');
      setGeneralError(
        isAr
          ? 'حدث خطأ أثناء التحقق، يُرجى المحاولة مرة أخرى'
          : 'An unexpected error occurred, please try again'
      );
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    setGeneralError(null);
    setSuccessMessage(null);

    try {
      const result = await resendEmailVerification();
      if (result.ok) {
        setCooldown(60); // 60s cooldown
        setSuccessMessage(
          isAr
            ? 'تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني'
            : 'A new verification code has been sent to your email'
        );
      } else {
        setGeneralError(
          result.error.message ||
            (isAr
              ? 'تعذر إعادة إرسال الرمز حاليًا، يُرجى الانتظار والمحاولة مرة أخرى'
              : 'Unable to resend code right now, please wait and try again')
        );
      }
    } catch {
      setGeneralError(
        isAr
          ? 'حدث خطأ أثناء إعادة إرسال الرمز'
          : 'Failed to resend verification code'
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full space-y-6" data-testid="verify-email-panel">
      {/* Visual Header */}
      <div className="flex flex-col items-center text-center space-y-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-sm">
          <Mail className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {isAr ? 'تأكيد البريد الإلكتروني' : 'Verify Your Email'}
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {isAr ? (
            <>
              أرسلنا رمز تحقق مكون من ٦ أرقام إلى{' '}
              <span className="font-semibold text-foreground dir-ltr inline-block">
                {maskedEmail}
              </span>
            </>
          ) : (
            <>
              We sent a 6-digit verification code to{' '}
              <span className="font-semibold text-foreground">{maskedEmail}</span>
            </>
          )}
        </p>
      </div>

      {/* Alerts */}
      {generalError && (
        <Alert variant="destructive" data-testid="verify-email-error-alert" className="text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-600/30 bg-green-500/10 text-green-700 dark:text-green-300 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* OTP Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input type="hidden" {...register('purpose')} value="EMAIL_VERIFY" />

        <div className="space-y-2">
          <Label htmlFor="otp-code" className="text-center block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isAr ? 'رمز التحقق (٦ أرقام)' : 'Verification Code (6 Digits)'}
          </Label>
          <Input
            id="otp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.code)}
            aria-describedby={errors.code ? 'otp-code-error' : undefined}
            data-testid="verify-email-code-input"
            className="h-14 text-center text-2xl tracking-[0.5em] font-mono font-bold"
            {...register('code')}
          />
          {errors.code && (
            <p
              id="otp-code-error"
              role="alert"
              data-testid="verify-email-code-error"
              className="text-xs font-medium text-destructive text-center mt-1"
            >
              {errors.code.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          data-testid="verify-email-submit-button"
          className="w-full h-11 text-base font-semibold"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{isAr ? 'جاري التحقق...' : 'Verifying...'}</span>
            </span>
          ) : (
            isAr ? 'تأكيد الرمز' : 'Verify Code'
          )}
        </Button>
      </form>

      {/* Resend Action with Cooldown */}
      <div className="pt-2 text-center border-t border-border/50">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>{isAr ? 'لم يصلك الرمز؟' : "Didn't receive the code?"}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            data-testid="resend-code-button"
            className="text-primary font-semibold hover:bg-primary/5 h-auto py-1 px-2"
          >
            {isResending ? (
              <span className="flex items-center gap-1.5">
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
                <span>{isAr ? 'جاري الإرسال...' : 'Sending...'}</span>
              </span>
            ) : cooldown > 0 ? (
              <span data-testid="resend-countdown">
                {isAr
                  ? `إعادة الإرسال بعد (${cooldown} ثانية)`
                  : `Resend in (${cooldown}s)`}
              </span>
            ) : (
              isAr ? 'إعادة إرسال الرمز' : 'Resend Code'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
