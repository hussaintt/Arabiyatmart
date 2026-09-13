'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Locale } from '@/types/common';
import type { ResetPasswordInput, VerifyResetCodeInput } from '@/types/auth';
import {
  ResetPasswordInputSchema,
  VerifyResetCodeInputSchema,
} from '@/lib/api/schemas/auth';
import { verifyResetCode, resetPassword } from '@/server/actions/verification';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Check,
} from 'lucide-react';

interface ResetPasswordFormProps {
  locale: Locale;
  flowNonce: string;
  initialVerified?: boolean | undefined;
  initialCode?: string | undefined;
}

export function ResetPasswordForm({
  locale,
  flowNonce,
  initialVerified = false,
  initialCode = '',
}: ResetPasswordFormProps) {
  const isAr = locale === 'ar';
  const router = useRouter();

  const [step, setStep] = React.useState<'verify_code' | 'set_password' | 'completed'>(
    initialVerified ? 'set_password' : 'verify_code'
  );
  const [verifiedCode, setVerifiedCode] = React.useState<string>(initialCode);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);

  // Step 1 Form: Verify Code
  const {
    register: registerCode,
    handleSubmit: handleCodeSubmit,
    setError: setCodeError,
    formState: { errors: codeErrors, isSubmitting: isCodeSubmitting },
  } = useForm<VerifyResetCodeInput>({
    resolver: zodResolver(
      VerifyResetCodeInputSchema as unknown as Parameters<typeof zodResolver>[0]
    ) as unknown as Resolver<VerifyResetCodeInput>,
    defaultValues: {
      flow: flowNonce,
      code: initialCode,
    },
  });

  // Step 2 Form: New Password
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    setError: setPasswordError,
    setValue: setPasswordValue,
    watch: watchPassword,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(
      ResetPasswordInputSchema as unknown as Parameters<typeof zodResolver>[0]
    ) as unknown as Resolver<ResetPasswordInput>,
    defaultValues: {
      flow: flowNonce,
      code: initialCode,
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPasswordValue = watchPassword('newPassword') || '';
  const hasMinLength = newPasswordValue.length >= 8;
  const hasLowerCase = /[a-z]/.test(newPasswordValue);
  const hasUpperCase = /[A-Z]/.test(newPasswordValue);
  const hasNumber = /[0-9]/.test(newPasswordValue);

  const onVerifyCode = async (data: VerifyResetCodeInput) => {
    setGeneralError(null);
    try {
      const result = await verifyResetCode(data);
      if (result.ok) {
        setVerifiedCode(data.code);
        setPasswordValue('code', data.code);
        setStep('set_password');
      } else {
        if (result.error.fieldErrors && result.error.fieldErrors.length > 0) {
          for (const fe of result.error.fieldErrors) {
            if (fe.field === 'code') {
              setCodeError('code', { message: fe.message });
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
      setGeneralError(
        isAr
          ? 'حدث خطأ أثناء التحقق من الرمز'
          : 'Failed to verify reset code'
      );
    }
  };

  const onResetPassword = async (data: ResetPasswordInput) => {
    setGeneralError(null);
    try {
      // Ensure the verified code and flow are bound
      const payload: ResetPasswordInput = {
        ...data,
        flow: flowNonce,
        code: verifiedCode || data.code,
      };

      const result = await resetPassword(payload);

      if (result.ok) {
        setPasswordValue('newPassword', '');
        setPasswordValue('confirmPassword', '');
        setStep('completed');
      } else {
        setPasswordValue('newPassword', '');
        setPasswordValue('confirmPassword', '');

        if (result.error.fieldErrors && result.error.fieldErrors.length > 0) {
          for (const fe of result.error.fieldErrors) {
            if (fe.field === 'newPassword' || fe.field === 'confirmPassword') {
              setPasswordError(fe.field, { message: fe.message });
            }
          }
        }
        setGeneralError(
          result.error.message ||
            (isAr
              ? 'تعذر إعادة تعيين كلمة المرور، تأكد من مطابقة الشروط'
              : 'Failed to reset password, please verify requirements')
        );
      }
    } catch {
      setPasswordValue('newPassword', '');
      setPasswordValue('confirmPassword', '');
      setGeneralError(
        isAr
          ? 'حدث خطأ غير متوقع، يُرجى المحاولة مرة أخرى'
          : 'An unexpected error occurred, please try again'
      );
    }
  };

  if (step === 'completed') {
    return (
      <div
        className="text-center space-y-6 animate-in fade-in-50"
        data-testid="reset-password-success-view"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10 text-green-600 mx-auto shadow-sm">
          <CheckCircle2 className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {isAr ? 'تم تغيير كلمة المرور بنجاح' : 'Password Reset Successfully'}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            {isAr
              ? 'تم تحديث كلمة المرور الخاصة بك. يمكنك الآن تسجيل الدخول باستخدام كلمة المرور الجديدة.'
              : 'Your password has been updated. You can now sign in using your new credentials.'}
          </p>
        </div>

        <Button
          onClick={() => router.push(`/${locale}/login`)}
          data-testid="go-to-login-button"
          className="w-full h-11 text-base font-semibold"
        >
          {isAr ? 'تسجيل الدخول الآن' : 'Sign In Now'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full" data-testid="reset-password-form">
      {/* Visual Header */}
      <div className="flex flex-col items-center text-center space-y-1">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
          <KeyRound className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {step === 'verify_code'
            ? isAr
              ? 'أدخل رمز التحقق'
              : 'Enter Verification Code'
            : isAr
            ? 'تعيين كلمة مرور جديدة'
            : 'Set New Password'}
        </h2>
        <p className="text-xs text-muted-foreground">
          {step === 'verify_code'
            ? isAr
              ? 'أدخل رمز التحقق المكون من ٦ أرقام الذي أرسلناه إلى بريدك'
              : 'Enter the 6-digit code sent to your email'
            : isAr
            ? 'اختر كلمة مرور قوية وسهلة التذكر'
            : 'Choose a strong and secure password'}
        </p>
      </div>

      {generalError && (
        <Alert variant="destructive" data-testid="reset-password-error-alert" className="text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      {/* Stage 1: Verify Code */}
      {step === 'verify_code' && (
        <form onSubmit={handleCodeSubmit(onVerifyCode)} className="space-y-4">
          <input type="hidden" {...registerCode('flow')} value={flowNonce} />

          <div className="space-y-2">
            <Label htmlFor="reset-code" className="text-center block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isAr ? 'رمز التحقق' : 'Verification Code'}
            </Label>
            <Input
              id="reset-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              disabled={isCodeSubmitting}
              aria-invalid={Boolean(codeErrors.code)}
              aria-describedby={codeErrors.code ? 'reset-code-error' : undefined}
              data-testid="reset-code-input"
              className="h-14 text-center text-2xl tracking-[0.5em] font-mono font-bold"
              {...registerCode('code')}
            />
            {codeErrors.code && (
              <p
                id="reset-code-error"
                role="alert"
                data-testid="reset-code-error"
                className="text-xs font-medium text-destructive text-center mt-1"
              >
                {codeErrors.code.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isCodeSubmitting}
            data-testid="verify-code-submit-button"
            className="w-full h-11 text-base font-semibold"
          >
            {isCodeSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isAr ? 'جاري التحقق...' : 'Verifying...'}</span>
              </span>
            ) : (
              isAr ? 'متابعة تعيين كلمة المرور' : 'Continue'
            )}
          </Button>
        </form>
      )}

      {/* Stage 2: Set New Password */}
      {step === 'set_password' && (
        <form onSubmit={handlePasswordSubmit(onResetPassword)} className="space-y-4">
          <input type="hidden" {...registerPassword('flow')} value={flowNonce} />
          <input type="hidden" {...registerPassword('code')} value={verifiedCode} />

          {/* New Password */}
          <div className="space-y-1.5">
            <Label htmlFor="new-password">
              {isAr ? 'كلمة المرور الجديدة' : 'New Password'}
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                disabled={isPasswordSubmitting}
                aria-invalid={Boolean(passwordErrors.newPassword)}
                aria-describedby={passwordErrors.newPassword ? 'new-password-error' : undefined}
                data-testid="new-password-input"
                className="h-11 pe-10"
                {...registerPassword('newPassword')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword
                    ? isAr
                      ? 'إخفاء كلمة المرور'
                      : 'Hide password'
                    : isAr
                    ? 'إظهار كلمة المرور'
                    : 'Show password'
                }
                data-testid="toggle-new-password-visibility"
                className="absolute end-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {passwordErrors.newPassword && (
              <p
                id="new-password-error"
                role="alert"
                data-testid="new-password-error"
                className="text-xs font-medium text-destructive mt-1"
              >
                {passwordErrors.newPassword.message}
              </p>
            )}

            {/* Checklist */}
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs space-y-1 mt-2">
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                  <Check className={`h-3 w-3 ${hasMinLength ? 'opacity-100' : 'opacity-30'}`} />
                  <span>{isAr ? '٨ أحرف على الأقل' : 'At least 8 chars'}</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasUpperCase ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                  <Check className={`h-3 w-3 ${hasUpperCase ? 'opacity-100' : 'opacity-30'}`} />
                  <span>{isAr ? 'حرف كبير (A-Z)' : 'Uppercase letter'}</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLowerCase ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                  <Check className={`h-3 w-3 ${hasLowerCase ? 'opacity-100' : 'opacity-30'}`} />
                  <span>{isAr ? 'حرف صغير (a-z)' : 'Lowercase letter'}</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                  <Check className={`h-3 w-3 ${hasNumber ? 'opacity-100' : 'opacity-30'}`} />
                  <span>{isAr ? 'رقم (0-9)' : 'A number (0-9)'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm-new-password">
              {isAr ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
            </Label>
            <div className="relative">
              <Input
                id="confirm-new-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                disabled={isPasswordSubmitting}
                aria-invalid={Boolean(passwordErrors.confirmPassword)}
                aria-describedby={passwordErrors.confirmPassword ? 'confirm-new-password-error' : undefined}
                data-testid="confirm-new-password-input"
                className="h-11 pe-10"
                {...registerPassword('confirmPassword')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={
                  showConfirmPassword
                    ? isAr
                      ? 'إخفاء تأكيد كلمة المرور'
                      : 'Hide confirm password'
                    : isAr
                    ? 'إظهار تأكيد كلمة المرور'
                    : 'Show confirm password'
                }
                data-testid="toggle-confirm-new-password-visibility"
                className="absolute end-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {passwordErrors.confirmPassword && (
              <p
                id="confirm-new-password-error"
                role="alert"
                data-testid="confirm-new-password-error"
                className="text-xs font-medium text-destructive mt-1"
              >
                {passwordErrors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isPasswordSubmitting}
            data-testid="reset-password-submit-button"
            className="w-full h-11 text-base font-semibold mt-2"
          >
            {isPasswordSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isAr ? 'جاري الحفظ...' : 'Saving...'}</span>
              </span>
            ) : (
              isAr ? 'حفظ كلمة المرور الجديدة' : 'Save New Password'
            )}
          </Button>
        </form>
      )}

      <div className="text-center pt-2 border-t border-border/50">
        <Link
          href="/forgot-password"
          className="text-xs text-primary hover:underline font-medium"
        >
          {isAr ? 'طلب رمز جديد' : 'Request a new code'}
        </Link>
      </div>
    </div>
  );
}
