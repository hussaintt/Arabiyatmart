'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Locale } from '@/types/common';
import type { LoginInput } from '@/types/auth';
import { LoginInputSchema } from '@/lib/api/schemas/auth';
import { sanitizeReturnTo } from '@/lib/auth/return-to';
import { login } from '@/server/actions/auth';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { trackAnalytics } from '@/lib/analytics/client';
import { QueryClientContext } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';

interface LoginFormProps {
  locale: Locale;
  returnTo?: string | null;
}

export function LoginForm({ locale, returnTo }: LoginFormProps) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const queryClient = React.useContext(QueryClientContext);
  const [showPassword, setShowPassword] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);

  const safeReturn = returnTo ? sanitizeReturnTo(returnTo, locale) : `/${locale}`;

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(
      LoginInputSchema as unknown as Parameters<typeof zodResolver>[0]
    ) as unknown as Resolver<LoginInput>,
    defaultValues: {
      email: '',
      password: '',
      returnTo: safeReturn,
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setGeneralError(null);

    try {
      const result = await login(data);

      if (result.ok) {
        trackAnalytics({ name: 'auth_outcome', operation: 'login', outcome: 'succeeded' });
        // Clear password field immediately upon success
        setValue('password', '');
        if (queryClient) {
          queryClient.setQueryData(queryKeys.me(), { data: result.data });
          await queryClient.invalidateQueries({ queryKey: queryKeys.me() });
        }
        router.refresh?.();
        router.push(safeReturn);
      } else {
        trackAnalytics({ name: 'auth_outcome', operation: 'login', outcome: 'failed', code: result.error.code, status: result.error.status, requestId: result.error.requestId });
        // Clear password on failure while preserving non-secret email
        setValue('password', '');

        if (result.error.fieldErrors && result.error.fieldErrors.length > 0) {
          for (const fe of result.error.fieldErrors) {
            if (fe.field === 'email' || fe.field === 'password' || fe.field === 'returnTo') {
              setError(fe.field, { message: fe.message });
            }
          }
        }

        setGeneralError(
          result.error.message ||
            (isAr
              ? 'فشل تسجيل الدخول، تأكد من صحة البريد الإلكتروني وكلمة المرور'
              : 'Sign in failed, please check your email and password')
        );
      }
    } catch {
      trackAnalytics({ name: 'auth_outcome', operation: 'login', outcome: 'failed', code: 'UNEXPECTED_ERROR' });
      setValue('password', '');
      setGeneralError(
        isAr
          ? 'حدث خطأ غير متوقع، يُرجى المحاولة مرة أخرى'
          : 'An unexpected error occurred, please try again'
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-4 w-full"
      data-testid="login-form"
    >
      {/* General Alert Banner */}
      {generalError && (
        <Alert variant="destructive" data-testid="login-error-alert" className="text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      {/* Hidden returnTo field */}
      <input type="hidden" {...register('returnTo')} value={safeReturn} />

      {/* Email Field */}
      <div className="space-y-1.5">
        <Label htmlFor="login-email">
          {isAr ? 'البريد الإلكتروني' : 'Email Address'}
        </Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder={isAr ? 'name@example.com' : 'name@example.com'}
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          data-testid="login-email-input"
          className="h-11"
          {...register('email')}
        />
        {errors.email && (
          <p
            id="login-email-error"
            role="alert"
            data-testid="login-email-error"
            className="text-xs font-medium text-destructive mt-1"
          >
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">
            {isAr ? 'كلمة المرور' : 'Password'}
          </Label>
          <Link
            href="/forgot-password"
            className="text-xs text-primary hover:underline font-medium"
            tabIndex={0}
          >
            {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
          </Link>
        </div>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            data-testid="login-password-input"
            className="h-11 pe-10"
            {...register('password')}
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
            data-testid="toggle-password-visibility"
            className="absolute end-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {errors.password && (
          <p
            id="login-password-error"
            role="alert"
            data-testid="login-password-error"
            className="text-xs font-medium text-destructive mt-1"
          >
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSubmitting}
        data-testid="login-submit-button"
        className="w-full h-11 text-base font-semibold mt-2"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{isAr ? 'جاري تسجيل الدخول...' : 'Signing in...'}</span>
          </span>
        ) : (
          isAr ? 'تسجيل الدخول' : 'Sign In'
        )}
      </Button>

      {/* Switch to Register */}
      <div className="text-center pt-2 text-sm text-muted-foreground">
        <span>{isAr ? 'ليس لديك حساب؟ ' : "Don't have an account? "}</span>
        <Link
          href={returnTo ? `/register?returnTo=${encodeURIComponent(safeReturn)}` : '/register'}
          className="text-primary font-semibold hover:underline"
          data-testid="register-link"
        >
          {isAr ? 'إنشاء حساب جديد' : 'Create an account'}
        </Link>
      </div>
    </form>
  );
}
