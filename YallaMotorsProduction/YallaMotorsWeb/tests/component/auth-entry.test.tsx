import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import * as fs from 'node:fs';
import * as path from 'node:path';

vi.mock('server-only', () => ({}));

const routingState = vi.hoisted(() => ({
  pathname: '/ar/login',
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

const mockLoginAction = vi.fn();
const mockRegisterAction = vi.fn();
vi.mock('@/server/actions/auth', () => ({
  login: (...args: unknown[]) => mockLoginAction(...args),
  register: (...args: unknown[]) => mockRegisterAction(...args),
}));

// Mock browser API for social buttons
const mockBrowserApiRequest = vi.fn();
vi.mock('@/lib/api/browser', () => ({
  browserApiRequest: (...args: unknown[]) => mockBrowserApiRequest(...args),
}));

const mockClientEnv = vi.hoisted(() => ({
  NEXT_PUBLIC_SITE_ORIGIN: 'http://localhost:3000',
  NEXT_PUBLIC_APP_ENV: 'test',
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: undefined as string | undefined,
  NEXT_PUBLIC_APPLE_CLIENT_ID: undefined as string | undefined,
}));

vi.mock('@/lib/env/client', () => ({
  clientEnv: mockClientEnv,
}));

import LoginPage from '@/app/[locale]/(auth)/login/page';
import RegisterPage from '@/app/[locale]/(auth)/register/page';
import { LoginForm } from '@/components/auth/login-form';
import { RegisterForm } from '@/components/auth/register-form';
import { SocialLoginButtons } from '@/components/auth/social-login-buttons';
import type { SafeSession } from '@/types/auth';

const sampleSession: SafeSession = {
  user: {
    publicId: 'usr_01HXYZ',
    email: 'test@example.com',
    firstName: 'Hussien',
    lastName: 'Nouh',
    phone: '+201000000000',
    accountType: 'CUSTOMER',
    status: 'ACTIVE',
    locale: 'ar',
    kycStatus: 'APPROVED',
    kycApprovedAt: null,
    kycRejectionReason: null,
    avatarUrl: null,
    emailVerifiedAt: '2026-01-01T00:00:00Z',
    phoneVerifiedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: '2026-01-01T00:00:00Z',
    roles: [],
    permissions: [],
  },
  signInMethod: 'EMAIL_PASSWORD',
  isAuthenticated: true,
};

describe('TASK-037: Login and Registration Routes & Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routingState.push.mockReset();
    routingState.replace.mockReset();
    routingState.redirect.mockReset();
    mockGetSession.mockResolvedValue({ data: null });
    mockClientEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID = undefined;
    mockClientEnv.NEXT_PUBLIC_APPLE_CLIENT_ID = undefined;
    delete (window as unknown as Record<string, unknown>).google;
    delete (window as unknown as Record<string, unknown>).AppleID;
    mockBrowserApiRequest.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe('LoginPage & LoginForm', () => {
    it('redirects authenticated users away when visiting login page (guest guard)', async () => {
      mockGetSession.mockResolvedValue({ data: sampleSession });

      await expect(
        LoginPage({
          params: Promise.resolve({ locale: 'ar' }),
          searchParams: Promise.resolve({ returnTo: '/ar/favorites' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT:/ar/favorites');

      expect(routingState.redirect).toHaveBeenCalledWith('/ar/favorites');
    });

    it('sanitizes unsafe external returnTo destinations to localized root', async () => {
      mockGetSession.mockResolvedValue({ data: sampleSession });

      await expect(
        LoginPage({
          params: Promise.resolve({ locale: 'ar' }),
          searchParams: Promise.resolve({ returnTo: 'https://malicious-site.com/steal' }),
        })
      ).rejects.toThrow('NEXT_REDIRECT:/ar');

      expect(routingState.redirect).toHaveBeenCalledWith('/ar');
    });

    it('renders LoginPage with LoginForm, social login buttons, and context panel for guests', async () => {
      mockGetSession.mockResolvedValue({ data: null });

      const page = await LoginPage({
        params: Promise.resolve({ locale: 'ar' }),
        searchParams: Promise.resolve({ returnTo: '/ar/favorites' }),
      });

      render(page);

      expect(screen.getByTestId('login-form')).toBeInTheDocument();
      expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
      expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
      expect(screen.getByTestId('login-submit-button')).toBeInTheDocument();
      expect(screen.getByTestId('social-login-buttons')).toBeInTheDocument();
      expect(screen.getByText('مرحبًا بك مجددًا في سوق السيارات الأكبر')).toBeInTheDocument();
    });

    it('GIVEN valid credentials and safe returnTo /ar/favorites, WHEN user submits, THEN login action runs and navigates to returnTo', async () => {
      mockLoginAction.mockResolvedValue({
        ok: true,
        data: sampleSession,
      });

      render(<LoginForm locale="ar" returnTo="/ar/favorites" />);

      const emailInput = screen.getByTestId('login-email-input') as HTMLInputElement;
      const passwordInput = screen.getByTestId('login-password-input') as HTMLInputElement;
      const submitBtn = screen.getByTestId('login-submit-button');

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'SecretP@ss1' } });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockLoginAction).toHaveBeenCalledWith({
          email: 'user@example.com',
          password: 'SecretP@ss1',
          returnTo: '/ar/favorites',
        });
      });

      await waitFor(() => {
        expect(routingState.push).toHaveBeenCalledWith('/ar/favorites');
      });

      // Password should be cleared after submit
      expect(passwordInput.value).toBe('');
    });

    it('toggles password visibility accessibly', () => {
      render(<LoginForm locale="ar" returnTo="/ar/favorites" />);

      const passwordInput = screen.getByTestId('login-password-input') as HTMLInputElement;
      const toggleBtn = screen.getByTestId('toggle-password-visibility');

      expect(passwordInput.type).toBe('password');

      fireEvent.click(toggleBtn);
      expect(passwordInput.type).toBe('text');

      fireEvent.click(toggleBtn);
      expect(passwordInput.type).toBe('password');
    });

    it('displays validation errors for invalid email format', async () => {
      render(<LoginForm locale="ar" returnTo="/ar/favorites" />);

      const emailInput = screen.getByTestId('login-email-input');
      const passwordInput = screen.getByTestId('login-password-input');
      const submitBtn = screen.getByTestId('login-submit-button');

      fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('login-email-error')).toBeInTheDocument();
      });

      expect(mockLoginAction).not.toHaveBeenCalled();
    });

    it('displays server error alert, clears password, and preserves email on action failure', async () => {
      mockLoginAction.mockResolvedValue({
        ok: false,
        error: {
          status: 401,
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        },
      });

      render(<LoginForm locale="ar" returnTo="/ar/favorites" />);

      const emailInput = screen.getByTestId('login-email-input') as HTMLInputElement;
      const passwordInput = screen.getByTestId('login-password-input') as HTMLInputElement;
      const submitBtn = screen.getByTestId('login-submit-button');

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'WrongPass123' } });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('login-error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();

      // Email is preserved, password is cleared
      expect(emailInput.value).toBe('user@example.com');
      expect(passwordInput.value).toBe('');
    });

    it('disables submit button while submission is in progress (prevents double submit)', async () => {
      let resolveAction: (val: unknown) => void;
      mockLoginAction.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveAction = resolve;
          })
      );

      render(<LoginForm locale="ar" returnTo="/ar/favorites" />);

      fireEvent.change(screen.getByTestId('login-email-input'), {
        target: { value: 'user@example.com' },
      });
      fireEvent.change(screen.getByTestId('login-password-input'), {
        target: { value: 'SecretP@ss1' },
      });

      const submitBtn = screen.getByTestId('login-submit-button');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(submitBtn).toBeDisabled();
      });

      // Second click does nothing
      fireEvent.click(submitBtn);
      expect(mockLoginAction).toHaveBeenCalledTimes(1);

      resolveAction!({ ok: true, data: sampleSession });
      await waitFor(() => {
        expect(routingState.push).toHaveBeenCalled();
      });
    });
  });

  describe('RegisterPage & RegisterForm', () => {
    it('redirects authenticated users away from register page', async () => {
      mockGetSession.mockResolvedValue({ data: sampleSession });

      await expect(
        RegisterPage({
          params: Promise.resolve({ locale: 'ar' }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow('NEXT_REDIRECT:/ar');

      expect(routingState.redirect).toHaveBeenCalledWith('/ar');
    });

    it('renders RegisterPage with fields for names, email, password, confirmPassword, and accountType', async () => {
      mockGetSession.mockResolvedValue({ data: null });

      const page = await RegisterPage({
        params: Promise.resolve({ locale: 'ar' }),
        searchParams: Promise.resolve({}),
      });

      render(page);

      expect(screen.getByTestId('register-form')).toBeInTheDocument();
      expect(screen.getByTestId('account-type-customer')).toBeInTheDocument();
      expect(screen.getByTestId('account-type-vendor')).toBeInTheDocument();
      expect(screen.getByTestId('register-first-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('register-last-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('register-email-input')).toBeInTheDocument();
      expect(screen.getByTestId('register-password-input')).toBeInTheDocument();
      expect(screen.getByTestId('register-confirm-password-input')).toBeInTheDocument();
      expect(screen.getByTestId('register-submit-button')).toBeInTheDocument();
    });

    it('switches account type between CUSTOMER and VENDOR', () => {
      render(<RegisterForm locale="ar" />);

      const vendorChoice = screen.getByTestId('account-type-vendor');
      fireEvent.click(vendorChoice);

      expect(vendorChoice).toHaveClass('border-primary');
    });

    it('enforces password criteria and password match confirmation', async () => {
      render(<RegisterForm locale="ar" />);

      fireEvent.change(screen.getByTestId('register-first-name-input'), {
        target: { value: 'محمد' },
      });
      fireEvent.change(screen.getByTestId('register-last-name-input'), {
        target: { value: 'أحمد' },
      });
      fireEvent.change(screen.getByTestId('register-email-input'), {
        target: { value: 'test@example.com' },
      });
      // Weak password (too short, no uppercase)
      fireEvent.change(screen.getByTestId('register-password-input'), {
        target: { value: 'weak1' },
      });
      fireEvent.change(screen.getByTestId('register-confirm-password-input'), {
        target: { value: 'mismatch2' },
      });

      fireEvent.click(screen.getByTestId('register-submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('register-password-error')).toBeInTheDocument();
      });

      expect(mockRegisterAction).not.toHaveBeenCalled();
    });

    it('submits valid registration, runs action, and navigates to register-success', async () => {
      mockRegisterAction.mockResolvedValue({
        ok: true,
        data: sampleSession,
      });

      render(<RegisterForm locale="ar" />);

      fireEvent.change(screen.getByTestId('register-first-name-input'), {
        target: { value: 'محمد' },
      });
      fireEvent.change(screen.getByTestId('register-last-name-input'), {
        target: { value: 'أحمد' },
      });
      fireEvent.change(screen.getByTestId('register-email-input'), {
        target: { value: 'mohamed@example.com' },
      });
      fireEvent.change(screen.getByTestId('register-password-input'), {
        target: { value: 'StrongP@ssw0rd' },
      });
      fireEvent.change(screen.getByTestId('register-confirm-password-input'), {
        target: { value: 'StrongP@ssw0rd' },
      });

      fireEvent.click(screen.getByTestId('register-submit-button'));

      await waitFor(() => {
        expect(mockRegisterAction).toHaveBeenCalledWith(
          expect.objectContaining({
            firstName: 'محمد',
            lastName: 'أحمد',
            email: 'mohamed@example.com',
            password: 'StrongP@ssw0rd',
            confirmPassword: 'StrongP@ssw0rd',
            accountType: 'CUSTOMER',
          })
        );
      });

      await waitFor(() => {
        expect(routingState.push).toHaveBeenCalledWith('/ar/register-success');
      });
    });

    it('clears password fields on registration error while preserving names and email', async () => {
      mockRegisterAction.mockResolvedValue({
        ok: false,
        error: {
          status: 409,
          code: 'CONFLICT',
          message: 'An account with this email already exists',
        },
      });

      render(<RegisterForm locale="ar" />);

      const firstNameInput = screen.getByTestId('register-first-name-input') as HTMLInputElement;
      const emailInput = screen.getByTestId('register-email-input') as HTMLInputElement;
      const passwordInput = screen.getByTestId('register-password-input') as HTMLInputElement;
      const confirmPasswordInput = screen.getByTestId(
        'register-confirm-password-input'
      ) as HTMLInputElement;

      fireEvent.change(firstNameInput, { target: { value: 'محمد' } });
      fireEvent.change(screen.getByTestId('register-last-name-input'), { target: { value: 'أحمد' } });
      fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'StrongP@ssw0rd' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'StrongP@ssw0rd' } });

      fireEvent.click(screen.getByTestId('register-submit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('register-error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText('An account with this email already exists')).toBeInTheDocument();
      expect(firstNameInput.value).toBe('محمد');
      expect(emailInput.value).toBe('existing@example.com');
      expect(passwordInput.value).toBe('');
      expect(confirmPasswordInput.value).toBe('');
    });
  });

  describe('SocialLoginButtons', () => {
    it('handles Google login button click and displays graceful error when config is unavailable (no BFF call)', async () => {
      mockClientEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID = undefined;
      const onProviderError = vi.fn();
      render(<SocialLoginButtons locale="ar" onProviderError={onProviderError} />);

      const googleBtn = screen.getByTestId('google-login-button');
      fireEvent.click(googleBtn);

      await waitFor(() => {
        expect(onProviderError).toHaveBeenCalled();
      });

      expect(
        screen.getByText(/خدمة تسجيل الدخول بواسطة Google غير متوفرة حاليًا/)
      ).toBeInTheDocument();
      expect(mockBrowserApiRequest).not.toHaveBeenCalled();
    });

    it('handles Apple login button click and displays graceful error when config is unavailable (no BFF call)', async () => {
      mockClientEnv.NEXT_PUBLIC_APPLE_CLIENT_ID = undefined;
      const onProviderError = vi.fn();
      render(<SocialLoginButtons locale="ar" onProviderError={onProviderError} />);

      const appleBtn = screen.getByTestId('apple-login-button');
      fireEvent.click(appleBtn);

      await waitFor(() => {
        expect(onProviderError).toHaveBeenCalled();
      });

      expect(
        screen.getByText(/خدمة تسجيل الدخول بواسطة Apple غير متوفرة حاليًا/)
      ).toBeInTheDocument();
      expect(mockBrowserApiRequest).not.toHaveBeenCalled();
    });

    it('extracts real credential from Google Identity Services SDK and exchanges via BFF immediately with no simulated token', async () => {
      mockClientEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'google-client-id-real-123.apps.googleusercontent.com';
      mockBrowserApiRequest.mockResolvedValue({
        data: sampleSession,
      });

      let callbackRef: ((response: { credential: string }) => void) | undefined;
      const mockInitialize = vi.fn((config: { callback: (response: { credential: string }) => void }) => {
        callbackRef = config.callback;
      });
      const mockPrompt = vi.fn();

      (window as unknown as Record<string, unknown>).google = {
        accounts: {
          id: {
            initialize: mockInitialize,
            prompt: mockPrompt,
          },
        },
      };

      render(<SocialLoginButtons locale="ar" returnTo="/ar/favorites" accountType="CUSTOMER" />);

      const googleBtn = screen.getByTestId('google-login-button');
      fireEvent.click(googleBtn);

      expect(mockInitialize).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: 'google-client-id-real-123.apps.googleusercontent.com',
          callback: expect.any(Function),
        })
      );
      expect(mockPrompt).toHaveBeenCalled();

      // Trigger the callback with a real identity credential
      const REAL_GOOGLE_ID_TOKEN = 'real_google_jwt_header.payload.signature_xyz789';
      callbackRef!({ credential: REAL_GOOGLE_ID_TOKEN });

      await waitFor(() => {
        expect(mockBrowserApiRequest).toHaveBeenCalledWith({
          path: '/api/bff/auth/google',
          method: 'POST',
          input: {
            idToken: REAL_GOOGLE_ID_TOKEN,
            accountType: 'CUSTOMER',
            returnTo: '/ar/favorites',
          },
          outputSchema: expect.anything(),
        });
      });

      // Explicitly prove no simulated token string is transmitted
      const sentInput = (mockBrowserApiRequest.mock.calls[0] as [{ input: { idToken: string } }])[0].input;
      expect(sentInput.idToken).toBe(REAL_GOOGLE_ID_TOKEN);
      expect(sentInput.idToken).not.toContain('simulated_google_token');

      await waitFor(() => {
        expect(routingState.push).toHaveBeenCalledWith('/ar/favorites');
      });
    });

    it('extracts real credential and name from Apple SDK and exchanges via BFF immediately with no simulated token', async () => {
      mockClientEnv.NEXT_PUBLIC_APPLE_CLIENT_ID = 'com.arabiyatmart.web.client';
      mockBrowserApiRequest.mockResolvedValue({
        data: sampleSession,
      });

      const REAL_APPLE_ID_TOKEN = 'real_apple_identity_jwt_eyJhbGciOiJSUzI1NiIsIn.payload.sig_456';
      const mockAppleInit = vi.fn();
      const mockAppleSignIn = vi.fn().mockResolvedValue({
        authorization: {
          id_token: REAL_APPLE_ID_TOKEN,
          code: 'real_apple_auth_code_123',
        },
        user: {
          name: {
            firstName: 'Tariq',
            lastName: 'Mansour',
          },
          email: 'tariq@example.com',
        },
      });

      (window as unknown as Record<string, unknown>).AppleID = {
        auth: {
          init: mockAppleInit,
          signIn: mockAppleSignIn,
        },
      };

      render(<SocialLoginButtons locale="ar" returnTo="/ar/favorites" accountType="CUSTOMER" />);

      const appleBtn = screen.getByTestId('apple-login-button');
      fireEvent.click(appleBtn);

      await waitFor(() => {
        expect(mockAppleInit).toHaveBeenCalledWith(
          expect.objectContaining({
            clientId: 'com.arabiyatmart.web.client',
            scope: 'name email',
            usePopup: true,
          })
        );
      });

      expect(mockAppleSignIn).toHaveBeenCalled();

      await waitFor(() => {
        expect(mockBrowserApiRequest).toHaveBeenCalledWith({
          path: '/api/bff/auth/apple',
          method: 'POST',
          input: {
            identityToken: REAL_APPLE_ID_TOKEN,
            firstName: 'Tariq',
            lastName: 'Mansour',
            accountType: 'CUSTOMER',
            returnTo: '/ar/favorites',
          },
          outputSchema: expect.anything(),
        });
      });

      // Explicitly prove no simulated token string is transmitted
      const sentInput = (mockBrowserApiRequest.mock.calls[0] as [{ input: { identityToken: string } }])[0].input;
      expect(sentInput.identityToken).toBe(REAL_APPLE_ID_TOKEN);
      expect(sentInput.identityToken).not.toContain('simulated_apple_token');

      await waitFor(() => {
        expect(routingState.push).toHaveBeenCalledWith('/ar/favorites');
      });
    });

    it('explicitly proves no simulated token string remains in the source code of social-login-buttons', () => {
      const sourcePath = path.resolve(__dirname, '../../src/components/auth/social-login-buttons.tsx');
      const sourceCode = fs.readFileSync(sourcePath, 'utf-8');

      expect(sourceCode).not.toContain('simulated_google_token');
      expect(sourceCode).not.toContain('simulated_apple_token');
      expect(sourceCode).not.toContain('simulated_');
    });
  });
});
