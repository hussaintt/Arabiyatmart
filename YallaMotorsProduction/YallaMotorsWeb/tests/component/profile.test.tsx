import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUserProfile } from '../fixtures/factories';
import type { UserProfile } from '@/types/profile';

vi.mock('server-only', () => ({}));

const state = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  requireSession: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
  setPhone: vi.fn(),
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  refetchSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: state.replace, refresh: state.refresh, push: vi.fn() }),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  redirect: vi.fn((target: string) => { throw new Error(`NEXT_REDIRECT:${target}`); }),
}));

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => <a href={href} {...props}>{children}</a>,
  usePathname: () => '/en/profile',
  useRouter: () => ({ replace: state.replace, refresh: state.refresh }),
}));

vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));
vi.mock('@/lib/auth/guards', () => ({ requireSession: (...args: unknown[]) => state.requireSession(...args) }));
vi.mock('@/server/queries/profile', () => ({ getProfile: () => state.getProfile() }));
vi.mock('@/server/actions/profile', () => ({
  updateProfile: (...args: unknown[]) => state.updateProfile(...args),
  changePassword: (...args: unknown[]) => state.changePassword(...args),
  deleteAccount: (...args: unknown[]) => state.deleteAccount(...args),
}));
vi.mock('@/server/actions/verification', () => ({
  setPhone: (...args: unknown[]) => state.setPhone(...args),
  sendOtp: (...args: unknown[]) => state.sendOtp(...args),
  verifyOtp: (...args: unknown[]) => state.verifyOtp(...args),
}));
vi.mock('@/server/actions/auth', () => ({ logout: vi.fn() }));
vi.mock('@/providers/session-provider', () => ({
  useSession: () => ({ refetch: state.refetchSession, session: null, status: 'authenticated' }),
}));
vi.mock('@/lib/env/client', () => ({
  clientEnv: {
    NEXT_PUBLIC_SITE_ORIGIN: 'http://localhost:3000',
    NEXT_PUBLIC_APP_ENV: 'test',
  },
}));

import ProfilePage, { generateMetadata } from '@/app/[locale]/(account)/profile/page';
import { ProfileSummary } from '@/components/profile/profile-summary';
import { ProfileForm, ChangePasswordForm } from '@/components/profile/profile-form';
import { PhoneVerificationPanel } from '@/components/profile/phone-verification-panel';
import { DeleteAccountDialog } from '@/components/profile/delete-account-dialog';

const factoryProfile = createUserProfile({
  firstName: 'Mona', lastName: 'Saleh', email: 'mona@example.com',
  phone: '+201012345678', phoneVerifiedAt: null,
});
const profile: UserProfile = {
  ...factoryProfile,
  roles: factoryProfile.roles.map((role) => ({ ...role })),
  permissions: [...factoryProfile.permissions],
};

function renderClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('TASK-039: profile, verification, and account security', () => {
  beforeEach(() => {
    state.requireSession.mockResolvedValue({ user: profile });
    state.getProfile.mockResolvedValue({ data: profile });
    state.refetchSession.mockResolvedValue({ user: { ...profile, phoneVerifiedAt: '2026-09-09T00:00:00Z' } });
    state.updateProfile.mockResolvedValue({ ok: true, data: profile });
    state.changePassword.mockResolvedValue({ ok: true, data: { ok: true } });
    state.deleteAccount.mockResolvedValue({ ok: true, data: { ok: true } });
    state.setPhone.mockResolvedValue({ ok: true, data: { message: 'sent' } });
    state.sendOtp.mockResolvedValue({ ok: true, data: { message: 'sent' } });
    state.verifyOtp.mockResolvedValue({ ok: true, data: { message: 'verified' } });
  });

  afterEach(() => cleanup());

  it('renders the authoritative profile and verification status without internal identifiers', () => {
    const { container } = render(<ProfileSummary profile={profile} locale="en" />);
    expect(screen.getByText('Mona Saleh')).toBeInTheDocument();
    expect(screen.getAllByText('mona@example.com')).toHaveLength(2);
    expect(screen.getByText('+201012345678')).toBeInTheDocument();
    expect(container.textContent).not.toContain('roleId');
    expect(container.textContent).not.toContain('accessToken');
  });

  it('submits normalized profile fields once and reconciles session/profile truth', async () => {
    renderClient(<ProfileForm profile={profile} locale="en" />);
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: '  Mariam  ' } });
    fireEvent.click(screen.getByTestId('profile-save'));
    fireEvent.click(screen.getByTestId('profile-save'));
    await waitFor(() => expect(state.updateProfile).toHaveBeenCalledTimes(1));
    expect(state.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Mariam' }));
    await waitFor(() => expect(state.refetchSession).toHaveBeenCalled());
    expect(state.replace).toHaveBeenCalledWith('/en/profile');
  });

  it('maps profile field errors and preserves the server profile on failure', async () => {
    state.updateProfile.mockResolvedValueOnce({
      ok: false,
      error: { status: 422, code: 'VALIDATION_ERROR', message: 'Check your name', requestId: 'req_1', details: null, retryAfterSeconds: null, fieldErrors: [{ field: 'firstName', code: 'custom', message: 'Name is unavailable' }] },
    });
    renderClient(<ProfileForm profile={profile} locale="en" />);
    fireEvent.click(screen.getByTestId('profile-save'));
    expect(await screen.findByText('Name is unavailable')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Mona')).toBeInTheDocument();
    expect(state.replace).not.toHaveBeenCalled();
  });

  it('changes the password without retaining plaintext fields', async () => {
    renderClient(<ChangePasswordForm locale="en" />);
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'OldPassword1' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPassword2' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewPassword2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() => expect(state.changePassword).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveValue(''));
    expect(screen.getByLabelText('New password')).toHaveValue('');
  });

  it('completes backend OTP verification and returns only to the validated path', async () => {
    renderClient(<PhoneVerificationPanel locale="en" initialPhone={profile.phone} returnTo="/en/sell" />);
    fireEvent.click(screen.getByTestId('send-phone-code'));
    await screen.findByLabelText('Verification code');
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByTestId('confirm-phone-code'));
    expect(await screen.findByTestId('phone-verification-success')).toBeInTheDocument();
    await waitFor(() => expect(state.verifyOtp).toHaveBeenCalledWith({ purpose: 'PHONE_VERIFY', code: '123456' }));
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith('/en/sell'), { timeout: 1500 });
  });

  it('does not navigate or clear private query state when deletion fails', async () => {
    state.deleteAccount.mockResolvedValueOnce({
      ok: false,
      error: { status: 422, code: 'INVALID_PASSWORD', message: 'Password is incorrect', requestId: 'req_2', details: null, retryAfterSeconds: null, fieldErrors: [] },
    });
    renderClient(<DeleteAccountDialog locale="en" />);
    fireEvent.click(screen.getByTestId('delete-account-trigger'));
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'WrongPassword1' } });
    fireEvent.click(screen.getByTestId('delete-account-submit'));
    expect(await screen.findByText('Password is incorrect')).toBeInTheDocument();
    expect(screen.getByTestId('delete-account-dialog')).toBeInTheDocument();
    expect(state.replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('clears account UI state and replaces history only after confirmed deletion', async () => {
    renderClient(<DeleteAccountDialog locale="en" />);
    fireEvent.click(screen.getByTestId('delete-account-trigger'));
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'ValidPassword1' } });
    fireEvent.click(screen.getByTestId('delete-account-submit'));
    await waitFor(() => expect(state.deleteAccount).toHaveBeenCalledWith({ password: 'ValidPassword1', reason: null }));
    expect(state.replace).toHaveBeenCalledWith('/en');
  });

  it('renders the URL-backed phone panel and emits private noindex metadata', async () => {
    const page = await ProfilePage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({ panel: 'verify-phone', returnTo: '/en/sell' }),
    });
    renderClient(page);
    expect(screen.getByTestId('phone-verification-panel')).toBeInTheDocument();
    expect(state.requireSession).toHaveBeenCalledWith('/en/profile', 'en');
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }), searchParams: Promise.resolve({}) });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toMatch(/\/en\/profile$/);
    expect(JSON.stringify(metadata)).not.toContain(profile.email);
  });
});
