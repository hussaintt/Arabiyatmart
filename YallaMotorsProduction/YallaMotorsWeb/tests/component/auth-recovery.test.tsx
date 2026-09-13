import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

vi.mock('server-only', () => ({}));

const routingState = vi.hoisted(() => ({
  pathname: '/ar/forgot-password',
  search: '',
  push: vi.fn(),
  replace: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => routingState.pathname,
  useRouter: () => ({
    push: routingState.push,
    replace: routingState.replace,
  }),
  useSearchParams: () => new URLSearchParams(routingState.search),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: (url: string) => {
    routingState.redirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock('@/i18n/routing', () => ({
  Link: ({
    href,
    children,
    className,
    'data-testid': dataTestId,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    'data-testid'?: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a
      href={href}
      className={className}
      data-testid={dataTestId}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
    >
      {children}
    </a>
  ),
  usePathname: () => routingState.pathname,
  useRouter: () => ({
    push: routingState.push,
    replace: routingState.replace,
  }),
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
}));

// Mock server queries & actions
const mockGetSession = vi.fn();
vi.mock('@/server/queries/session', () => ({
  getSession: () => mockGetSession(),
}));

const mockForgotPassword = vi.fn();
const mockVerifyResetCode = vi.fn();
const mockResetPassword = vi.fn();
const mockVerifyOtp = vi.fn();
const mockResendEmailVerification = vi.fn();

vi.mock('@/server/actions/verification', () => ({
  forgotPassword: (...args: unknown[]) => mockForgotPassword(...args),
  verifyResetCode: (...args: unknown[]) => mockVerifyResetCode(...args),
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
  resendEmailVerification: (...args: unknown[]) => mockResendEmailVerification(...args),
}));

// Mock next/headers cookies()
const mockCookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => mockCookieGet(name),
  })),
}));

// Mock reset-flow reader
const mockReadResetFlow = vi.fn();
vi.mock('@/lib/auth/reset-flow', () => ({
  readResetFlow: (...args: unknown[]) => mockReadResetFlow(...args),
  RESET_FLOW_COOKIE: 'am_reset_flow',
}));

import ForgotPasswordPage from '@/app/[locale]/(auth)/forgot-password/page';
import ResetPasswordPage from '@/app/[locale]/(auth)/reset-password/page';
import VerifyEmailPage from '@/app/[locale]/(auth)/verify-email/page';
import RegisterSuccessPage from '@/app/[locale]/(auth)/register-success/page';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { VerifyEmailPanel } from '@/components/auth/verify-email-panel';
import type { SafeSession } from '@/types/auth';

const sampleUnverifiedSession: SafeSession = {
  user: {
    publicId: 'usr_unverified',
    email: 'hussien.nouh@example.com',
    firstName: 'Hussien',
    lastName: 'Nouh',
    phone: '+201000000000',
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
    locale: 'ar',
    kycStatus: 'NOT_SUBMITTED',
    kycApprovedAt: null,
    kycRejectionReason: null,
    avatarUrl: null,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: '2026-01-01T00:00:00Z',
    roles: [],
    permissions: [],
  },
  signInMethod: 'EMAIL_PASSWORD',
  isAuthenticated: true,
};

const sampleVerifiedSession: SafeSession = {
  ...sampleUnverifiedSession,
  user: {
    ...sampleUnverifiedSession.user,
    emailVerifiedAt: '2026-01-01T12:00:00Z',
  },
};

describe('TASK-038: Email Verification & Password Recovery Routes & Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routingState.push.mockReset();
    routingState.replace.mockReset();
    routingState.redirect.mockReset();
    mockGetSession.mockResolvedValue({ data: null });
    mockCookieGet.mockReturnValue(undefined);
    mockReadResetFlow.mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  /* ------------------------------------------------------------------ */
  /*  1. ForgotPasswordPage & ForgotPasswordForm (Non-Enumeration)      */
  /* ------------------------------------------------------------------ */
  describe('ForgotPasswordPage & ForgotPasswordForm', () => {
    it('redirects authenticated users away from forgot-password (guest protection)', async () => {
      mockGetSession.mockResolvedValue({ data: sampleVerifiedSession });

      await expect(
        ForgotPasswordPage({
          params: Promise.resolve({ locale: 'ar' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT:/ar');

      expect(routingState.redirect).toHaveBeenCalledWith('/ar');
    });

    it('renders ForgotPasswordPage with form for guest users', async () => {
      mockGetSession.mockResolvedValue({ data: null });

      const page = await ForgotPasswordPage({
        params: Promise.resolve({ locale: 'ar' }),
      });

      render(page);

      expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
      expect(screen.getByTestId('forgot-email-input')).toBeInTheDocument();
      expect(screen.getByTestId('forgot-password-submit-button')).toBeInTheDocument();
      expect(screen.getByText('نسيت كلمة المرور؟')).toBeInTheDocument();
    });

    it('validates email format and displays error on invalid email', async () => {
      render(<ForgotPasswordForm locale="ar" />);

      const emailInput = screen.getByTestId('forgot-email-input');
      const submitBtn = screen.getByTestId('forgot-password-submit-button');

      fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('forgot-email-error')).toBeInTheDocument();
      });

      expect(mockForgotPassword).not.toHaveBeenCalled();
    });

    it('GIVEN an existing email, WHEN submitted, THEN calls forgotPassword and renders non-enumeration success view', async () => {
      mockForgotPassword.mockResolvedValue({
        ok: true,
        data: {
          success: true,
          message: 'If this email is registered, instructions have been sent.',
        },
      });

      render(<ForgotPasswordForm locale="ar" />);

      const emailInput = screen.getByTestId('forgot-email-input');
      const submitBtn = screen.getByTestId('forgot-password-submit-button');

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockForgotPassword).toHaveBeenCalledWith({ email: 'user@example.com' });
      });

      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-success-view')).toBeInTheDocument();
        expect(screen.getByText('تم إرسال تعليمات الاستعادة')).toBeInTheDocument();
        expect(screen.getByTestId('continue-to-reset-button')).toBeInTheDocument();
      });
    });

    it('GIVEN a non-existing email or server error, WHEN submitted, THEN STILL renders identical success view (non-enumeration guarantee)', async () => {
      // Upstream error or non-existing account
      mockForgotPassword.mockRejectedValue(new Error('Internal error or account not found'));

      render(<ForgotPasswordForm locale="ar" />);

      const emailInput = screen.getByTestId('forgot-email-input');
      const submitBtn = screen.getByTestId('forgot-password-submit-button');

      fireEvent.change(emailInput, { target: { value: 'unknown-account@example.com' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockForgotPassword).toHaveBeenCalledWith({ email: 'unknown-account@example.com' });
      });

      // Must show the EXACT SAME view as for valid email
      await waitFor(() => {
        expect(screen.getByTestId('forgot-password-success-view')).toBeInTheDocument();
        expect(screen.getByText('تم إرسال تعليمات الاستعادة')).toBeInTheDocument();
      });
    });
  });

  /* ------------------------------------------------------------------ */
  /*  2. ResetPasswordPage & ResetPasswordForm                          */
  /* ------------------------------------------------------------------ */
  describe('ResetPasswordPage & ResetPasswordForm', () => {
    it('redirects authenticated users away from reset-password (guest protection)', async () => {
      mockGetSession.mockResolvedValue({ data: sampleVerifiedSession });

      await expect(
        ResetPasswordPage({
          params: Promise.resolve({ locale: 'ar' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT:/ar');

      expect(routingState.redirect).toHaveBeenCalledWith('/ar');
    });

    it('GIVEN direct access with NO flow cookie, THEN renders safe restart card with link to forgot-password', async () => {
      mockGetSession.mockResolvedValue({ data: null });
      mockReadResetFlow.mockReturnValue(null);

      const page = await ResetPasswordPage({
        params: Promise.resolve({ locale: 'ar' }),
      });

      render(page);

      expect(screen.getByTestId('reset-flow-expired-card')).toBeInTheDocument();
      expect(screen.getByText('انتهت صلاحية جلسة الاستعادة')).toBeInTheDocument();
      expect(screen.getByText('طلب استعادة كلمة المرور مجددًا')).toBeInTheDocument();
      expect(screen.queryByTestId('reset-password-form')).not.toBeInTheDocument();
    });

    it('GIVEN a valid reset flow cookie, THEN renders ResetPasswordForm', async () => {
      mockGetSession.mockResolvedValue({ data: null });
      mockReadResetFlow.mockReturnValue({
        email: 'user@example.com',
        code: null,
        verified: false,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 900_000,
        nonce: 'a1b2c3d4-0000-0000-0000-000000000000',
      });

      const page = await ResetPasswordPage({
        params: Promise.resolve({ locale: 'ar' }),
      });

      render(page);

      expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
      expect(screen.getByTestId('reset-code-input')).toBeInTheDocument();
      expect(screen.getByTestId('verify-code-submit-button')).toBeInTheDocument();
    });

    it('GIVEN stage 1 (verify_code), WHEN invalid code entered, THEN shows validation error', async () => {
      render(
        <ResetPasswordForm
          locale="ar"
          flowNonce="a1b2c3d4-0000-0000-0000-000000000000"
          initialVerified={false}
        />
      );

      const codeInput = screen.getByTestId('reset-code-input');
      const submitBtn = screen.getByTestId('verify-code-submit-button');

      fireEvent.change(codeInput, { target: { value: '12' } }); // < 6 digits
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('reset-code-error')).toBeInTheDocument();
      });

      expect(mockVerifyResetCode).not.toHaveBeenCalled();
    });

    it('GIVEN stage 1, WHEN valid 6-digit code verified successfully, THEN advances to stage 2 (set_password)', async () => {
      mockVerifyResetCode.mockResolvedValue({
        ok: true,
        data: { success: true },
      });

      render(
        <ResetPasswordForm
          locale="ar"
          flowNonce="a1b2c3d4-0000-0000-0000-000000000000"
          initialVerified={false}
        />
      );

      const codeInput = screen.getByTestId('reset-code-input');
      const submitBtn = screen.getByTestId('verify-code-submit-button');

      fireEvent.change(codeInput, { target: { value: '654321' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockVerifyResetCode).toHaveBeenCalledWith({
          flow: 'a1b2c3d4-0000-0000-0000-000000000000',
          code: '654321',
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('new-password-input')).toBeInTheDocument();
        expect(screen.getByTestId('confirm-new-password-input')).toBeInTheDocument();
        expect(screen.getByTestId('reset-password-submit-button')).toBeInTheDocument();
      });
    });

    it('GIVEN stage 2 (initialVerified: true), WHEN password and confirmation mismatch, THEN shows error', async () => {
      render(
        <ResetPasswordForm
          locale="ar"
          flowNonce="a1b2c3d4-0000-0000-0000-000000000000"
          initialVerified={true}
          initialCode="654321"
        />
      );

      const newPasswordInput = screen.getByTestId('new-password-input');
      const confirmPasswordInput = screen.getByTestId('confirm-new-password-input');
      const submitBtn = screen.getByTestId('reset-password-submit-button');

      fireEvent.change(newPasswordInput, { target: { value: 'StrongP@ss123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentP@ss456' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-new-password-error')).toBeInTheDocument();
      });

      expect(mockResetPassword).not.toHaveBeenCalled();
    });

    it('toggles password visibility on both new and confirm password fields', () => {
      render(
        <ResetPasswordForm
          locale="ar"
          flowNonce="a1b2c3d4-0000-0000-0000-000000000000"
          initialVerified={true}
          initialCode="654321"
        />
      );

      const newPassInput = screen.getByTestId('new-password-input') as HTMLInputElement;
      const confirmPassInput = screen.getByTestId('confirm-new-password-input') as HTMLInputElement;

      const toggleNew = screen.getByTestId('toggle-new-password-visibility');
      const toggleConfirm = screen.getByTestId('toggle-confirm-new-password-visibility');

      expect(newPassInput.type).toBe('password');
      expect(confirmPassInput.type).toBe('password');

      fireEvent.click(toggleNew);
      expect(newPassInput.type).toBe('text');

      fireEvent.click(toggleConfirm);
      expect(confirmPassInput.type).toBe('text');

      fireEvent.click(toggleNew);
      expect(newPassInput.type).toBe('password');
    });

    it('GIVEN valid matching passwords, WHEN submitted, THEN calls resetPassword and renders success view with sign-in button', async () => {
      mockResetPassword.mockResolvedValue({
        ok: true,
        data: { success: true },
      });

      render(
        <ResetPasswordForm
          locale="ar"
          flowNonce="a1b2c3d4-0000-0000-0000-000000000000"
          initialVerified={true}
          initialCode="654321"
        />
      );

      const newPassInput = screen.getByTestId('new-password-input') as HTMLInputElement;
      const confirmPassInput = screen.getByTestId('confirm-new-password-input') as HTMLInputElement;
      const submitBtn = screen.getByTestId('reset-password-submit-button');

      fireEvent.change(newPassInput, { target: { value: 'SecureNewP@ssw0rd' } });
      fireEvent.change(confirmPassInput, { target: { value: 'SecureNewP@ssw0rd' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith({
          flow: 'a1b2c3d4-0000-0000-0000-000000000000',
          code: '654321',
          newPassword: 'SecureNewP@ssw0rd',
          confirmPassword: 'SecureNewP@ssw0rd',
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('reset-password-success-view')).toBeInTheDocument();
        expect(screen.getByText('تم تغيير كلمة المرور بنجاح')).toBeInTheDocument();
      });

      const goToLoginBtn = screen.getByTestId('go-to-login-button');
      fireEvent.click(goToLoginBtn);
      expect(routingState.push).toHaveBeenCalledWith('/ar/login');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  3. VerifyEmailPage & VerifyEmailPanel                             */
  /* ------------------------------------------------------------------ */
  describe('VerifyEmailPage & VerifyEmailPanel', () => {
    it('redirects anonymous visitors to login with returnTo preserved', async () => {
      mockGetSession.mockResolvedValue({ data: null });

      await expect(
        VerifyEmailPage({
          params: Promise.resolve({ locale: 'ar' }),
          searchParams: Promise.resolve({ returnTo: '/ar/favorites' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT:/ar/login?returnTo=%2Far%2Fverify-email&returnTo=%2Far%2Ffavorites');
    });

    it('redirects already verified users immediately to returnTo target', async () => {
      mockGetSession.mockResolvedValue({ data: sampleVerifiedSession });

      await expect(
        VerifyEmailPage({
          params: Promise.resolve({ locale: 'ar' }),
          searchParams: Promise.resolve({ returnTo: '/ar/favorites' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT:/ar/favorites');

      expect(routingState.redirect).toHaveBeenCalledWith('/ar/favorites');
    });

    it('renders VerifyEmailPage with masked email for unverified authenticated users', async () => {
      mockGetSession.mockResolvedValue({ data: sampleUnverifiedSession });

      const page = await VerifyEmailPage({
        params: Promise.resolve({ locale: 'ar' }),
        searchParams: Promise.resolve({}),
      });

      render(page);

      expect(screen.getByTestId('verify-email-panel')).toBeInTheDocument();
      expect(screen.getByTestId('verify-email-code-input')).toBeInTheDocument();
      expect(screen.getByTestId('verify-email-submit-button')).toBeInTheDocument();
      // Masked email check: "hu***h@example.com"
      expect(screen.getByText(/hu\*\*\*h@example\.com/)).toBeInTheDocument();
    });

    it('validates 6-digit OTP code before submission', async () => {
      render(
        <VerifyEmailPanel
          locale="ar"
          maskedEmail="us***r@example.com"
          returnTo="/ar/favorites"
        />
      );

      const codeInput = screen.getByTestId('verify-email-code-input');
      const submitBtn = screen.getByTestId('verify-email-submit-button');

      fireEvent.change(codeInput, { target: { value: '123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('verify-email-code-error')).toBeInTheDocument();
      });

      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });

    it('submits valid OTP code and redirects to returnTo on success', async () => {
      mockVerifyOtp.mockResolvedValue({
        ok: true,
        data: { success: true },
      });

      render(
        <VerifyEmailPanel
          locale="ar"
          maskedEmail="us***r@example.com"
          returnTo="/ar/favorites"
        />
      );

      const codeInput = screen.getByTestId('verify-email-code-input');
      const submitBtn = screen.getByTestId('verify-email-submit-button');

      fireEvent.change(codeInput, { target: { value: '123456' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockVerifyOtp).toHaveBeenCalledWith({
          purpose: 'EMAIL_VERIFY',
          code: '123456',
        });
      });

      await waitFor(() => {
        expect(routingState.push).toHaveBeenCalledWith('/ar/favorites');
      });
    });

    it('handles resend action and activates countdown', async () => {
      mockResendEmailVerification.mockResolvedValue({
        ok: true,
        data: { success: true },
      });

      render(
        <VerifyEmailPanel
          locale="ar"
          maskedEmail="us***r@example.com"
          returnTo="/ar/favorites"
        />
      );

      const resendBtn = screen.getByTestId('resend-code-button');
      expect(resendBtn).toBeEnabled();

      fireEvent.click(resendBtn);

      await waitFor(() => {
        expect(mockResendEmailVerification).toHaveBeenCalledTimes(1);
      });

      // Cooldown timer is now active (60s)
      await waitFor(() => {
        expect(screen.getByTestId('resend-countdown')).toBeInTheDocument();
      });
      expect(resendBtn).toBeDisabled();
    });

    it('counts down the cooldown timer until enabled', async () => {
      vi.useFakeTimers();

      let resolveResend: (value: unknown) => void;
      mockResendEmailVerification.mockReturnValue(
        new Promise((resolve) => {
          resolveResend = resolve;
        })
      );

      render(
        <VerifyEmailPanel
          locale="ar"
          maskedEmail="us***r@example.com"
          returnTo="/ar/favorites"
        />
      );

      const resendBtn = screen.getByTestId('resend-code-button');
      fireEvent.click(resendBtn);

      await act(async () => {
        resolveResend!({ ok: true, data: { success: true } });
      });

      expect(screen.getByTestId('resend-countdown')).toHaveTextContent('60');

      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      expect(screen.getByTestId('resend-countdown')).toHaveTextContent('50');

      act(() => {
        vi.advanceTimersByTime(50_000);
      });

      expect(screen.getByTestId('resend-code-button')).toBeEnabled();
      vi.useRealTimers();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  4. RegisterSuccessPage                                            */
  /* ------------------------------------------------------------------ */
  describe('RegisterSuccessPage', () => {
    it('redirects anonymous visitors to login', async () => {
      mockGetSession.mockResolvedValue({ data: null });

      await expect(
        RegisterSuccessPage({
          params: Promise.resolve({ locale: 'ar' }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow('NEXT_REDIRECT:/ar/login');

      expect(routingState.redirect).toHaveBeenCalledWith('/ar/login');
    });

    it('renders celebration and verification CTA for unverified newly registered users', async () => {
      mockGetSession.mockResolvedValue({ data: sampleUnverifiedSession });

      const page = await RegisterSuccessPage({
        params: Promise.resolve({ locale: 'ar' }),
        searchParams: Promise.resolve({ returnTo: '/ar/cars' }),
      });

      render(page);

      expect(screen.getByText('أهلاً بك في عربيات مارت!')).toBeInTheDocument();
      expect(screen.getByText(/hu\*\*\*h@example\.com/)).toBeInTheDocument();
      expect(screen.getByTestId('verify-now-btn')).toBeInTheDocument();
      expect(screen.getByTestId('skip-to-marketplace-btn')).toBeInTheDocument();
    });

    it('renders verified greeting and browse CTA for already verified registered users', async () => {
      mockGetSession.mockResolvedValue({ data: sampleVerifiedSession });

      const page = await RegisterSuccessPage({
        params: Promise.resolve({ locale: 'ar' }),
        searchParams: Promise.resolve({ returnTo: '/ar/cars' }),
      });

      render(page);

      expect(screen.getByText('أهلاً بك في عربيات مارت!')).toBeInTheDocument();
      expect(screen.getByText('ابدأ التصفح الآن')).toBeInTheDocument();
      expect(screen.queryByTestId('verify-now-btn')).not.toBeInTheDocument();
    });
  });
});
