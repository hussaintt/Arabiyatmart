'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Locale } from '@/types/common';
import type { RegisterInput } from '@/types/auth';
import { RegisterInputSchema } from '@/lib/api/schemas/auth';
import { sanitizeReturnTo } from '@/lib/auth/return-to';
import { register as registerAction } from '@/server/actions/auth';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Loader2, AlertCircle, Check, User, Store } from 'lucide-react';
import { QueryClientContext } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/keys';

interface RegisterFormProps {
  locale: Locale;
  returnTo?: string | null;
}

export function RegisterForm({ locale, returnTo }: RegisterFormProps) {
  const isAr = locale === 'ar';
  const router = useRouter();
  const queryClient = React.useContext(QueryClientContext);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);

  const safeReturn = returnTo ? sanitizeReturnTo(returnTo, locale) : `/${locale}`;

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(
      RegisterInputSchema as unknown as Parameters<typeof zodResolver>[0]
    ) as unknown as Resolver<RegisterInput>,
    defaultValues: {
      accountType: 'CUSTOMER',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      returnTo: safeReturn,
    },
  });

  const accountType = watch('accountType');
  const passwordValue = watch('password') || '';

  const hasMinLength = passwordValue.length >= 8;
  const hasLowerCase = /[a-z]/.test(passwordValue);
  const hasUpperCase = /[A-Z]/.test(passwordValue);
  const hasNumber = /[0-9]/.test(passwordValue);

  const onSubmit = async (data: RegisterInput) => {
    setGeneralError(null);

    try {
      const result = await registerAction(data);

      if (result.ok) {
        // Clear passwords immediately upon success
        setValue('password', '');
        setValue('confirmPassword', '');
        if (queryClient) {
          if (result.data) {
            queryClient.setQueryData(queryKeys.me(), { data: result.data });
          }
          await queryClient.invalidateQueries({ queryKey: queryKeys.me() });
        }
        router.refresh?.();
        router.push(`/${locale}/register-success`);
      } else {
        // Clear passwords on failure while preserving non-secret names and email
        setValue('password', '');
        setValue('confirmPassword', '');

        if (result.error.fieldErrors && result.error.fieldErrors.length > 0) {
          for (const fe of result.error.fieldErrors) {
            if (
              fe.field === 'firstName' ||
              fe.field === 'lastName' ||
              fe.field === 'email' ||
              fe.field === 'password' ||
              fe.field === 'confirmPassword' ||
              fe.field === 'accountType' ||
              fe.field === 'returnTo'
            ) {
              setError(fe.field, { message: fe.message });
            }
          }
        }

        setGeneralError(
          result.error.message ||
            (isAr
              ? 'فشل إنشاء الحساب، يُرجى التأكد من صحة البيانات المدخلة'
              : 'Registration failed, please check your input')
        );
      }
    } catch {
      setValue('password', '');
      setValue('confirmPassword', '');
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
      data-testid="register-form"
    >
      {/* General Alert Banner */}
      {generalError && (
        <Alert variant="destructive" data-testid="register-error-alert" className="text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <AlertDescription>{generalError}</AlertDescription>
        </Alert>
      )}

      {/* Hidden returnTo field */}
      <input type="hidden" {...register('returnTo')} value={safeReturn} />

      {/* Account Type Choice */}
      <div className="space-y-1.5">
        <Label>{isAr ? 'نوع الحساب' : 'Account Type'}</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setValue('accountType', 'CUSTOMER')}
            data-testid="account-type-customer"
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
              accountType === 'CUSTOMER'
                ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                : 'border-border bg-card hover:bg-muted/50 text-foreground'
            }`}
          >
            <User className="h-4 w-4" />
            <span>{isAr ? 'مشتري / فرد' : 'Buyer / Individual'}</span>
          </button>
          <button
            type="button"
            onClick={() => setValue('accountType', 'VENDOR')}
            data-testid="account-type-vendor"
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
              accountType === 'VENDOR'
                ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                : 'border-border bg-card hover:bg-muted/50 text-foreground'
            }`}
          >
            <Store className="h-4 w-4" />
            <span>{isAr ? 'معرض / تاجر' : 'Dealer / Vendor'}</span>
          </button>
        </div>
        <input type="hidden" {...register('accountType')} />
      </div>

      {/* Name Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="register-first-name">
            {isAr ? 'الاسم الأول' : 'First Name'}
          </Label>
          <Input
            id="register-first-name"
            type="text"
            autoComplete="given-name"
            placeholder={isAr ? 'محمد' : 'John'}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.firstName)}
            aria-describedby={errors.firstName ? 'register-first-name-error' : undefined}
            data-testid="register-first-name-input"
            className="h-11"
            {...register('firstName')}
          />
          {errors.firstName && (
            <p
              id="register-first-name-error"
              role="alert"
              data-testid="register-first-name-error"
              className="text-xs font-medium text-destructive mt-1"
            >
              {errors.firstName.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="register-last-name">
            {isAr ? 'اسم العائلة' : 'Last Name'}
          </Label>
          <Input
            id="register-last-name"
            type="text"
            autoComplete="family-name"
            placeholder={isAr ? 'أحمد' : 'Doe'}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.lastName)}
            aria-describedby={errors.lastName ? 'register-last-name-error' : undefined}
            data-testid="register-last-name-input"
            className="h-11"
            {...register('lastName')}
          />
          {errors.lastName && (
            <p
              id="register-last-name-error"
              role="alert"
              data-testid="register-last-name-error"
              className="text-xs font-medium text-destructive mt-1"
            >
              {errors.lastName.message}
            </p>
          )}
        </div>
      </div>

      {/* Email Field */}
      <div className="space-y-1.5">
        <Label htmlFor="register-email">
          {isAr ? 'البريد الإلكتروني' : 'Email Address'}
        </Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder={isAr ? 'name@example.com' : 'name@example.com'}
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'register-email-error' : undefined}
          data-testid="register-email-input"
          className="h-11"
          {...register('email')}
        />
        {errors.email && (
          <p
            id="register-email-error"
            role="alert"
            data-testid="register-email-error"
            className="text-xs font-medium text-destructive mt-1"
          >
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-1.5">
        <Label htmlFor="register-password">
          {isAr ? 'كلمة المرور' : 'Password'}
        </Label>
        <div className="relative">
          <Input
            id="register-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'register-password-error' : undefined}
            data-testid="register-password-input"
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
            data-testid="toggle-register-password-visibility"
            className="absolute end-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {errors.password && (
          <p
            id="register-password-error"
            role="alert"
            data-testid="register-password-error"
            className="text-xs font-medium text-destructive mt-1"
          >
            {errors.password.message}
          </p>
        )}

        {/* Password Strength Checklist */}
        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs space-y-1 mt-2">
          <p className="font-semibold text-muted-foreground mb-1">
            {isAr ? 'يجب أن تحتوي كلمة المرور على:' : 'Password must contain:'}
          </p>
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

      {/* Confirm Password Field */}
      <div className="space-y-1.5">
        <Label htmlFor="register-confirm-password">
          {isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}
        </Label>
        <div className="relative">
          <Input
            id="register-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? 'register-confirm-password-error' : undefined}
            data-testid="register-confirm-password-input"
            className="h-11 pe-10"
            {...register('confirmPassword')}
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
            data-testid="toggle-register-confirm-password-visibility"
            className="absolute end-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        {errors.confirmPassword && (
          <p
            id="register-confirm-password-error"
            role="alert"
            data-testid="register-confirm-password-error"
            className="text-xs font-medium text-destructive mt-1"
          >
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isSubmitting}
        data-testid="register-submit-button"
        className="w-full h-11 text-base font-semibold mt-4"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{isAr ? 'جاري إنشاء الحساب...' : 'Creating account...'}</span>
          </span>
        ) : (
          isAr ? 'إنشاء حساب' : 'Create Account'
        )}
      </Button>

      {/* Switch to Login */}
      <div className="text-center pt-2 text-sm text-muted-foreground">
        <span>{isAr ? 'لديك حساب بالفعل؟ ' : 'Already have an account? '}</span>
        <Link
          href={returnTo ? `/login?returnTo=${encodeURIComponent(safeReturn)}` : '/login'}
          className="text-primary font-semibold hover:underline"
          data-testid="login-link"
        >
          {isAr ? 'تسجيل الدخول' : 'Sign In'}
        </Link>
      </div>
    </form>
  );
}
