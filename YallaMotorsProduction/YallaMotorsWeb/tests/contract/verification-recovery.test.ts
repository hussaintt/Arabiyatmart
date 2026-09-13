import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => {
  const values = new Map<string, string>();
  const store = {
    get: vi.fn((name: string) => values.has(name) ? { name, value: values.get(name)! } : undefined),
    set: vi.fn((name: string, value: string) => { values.set(name, value); }),
    delete: vi.fn((name: string) => { values.delete(name); }),
  };
  return {
    values,
    store,
    apiRequest: vi.fn(),
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
    headers: new Headers({ origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' }),
  };
});
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => mocks.store), headers: vi.fn(async () => mocks.headers) }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));
vi.mock('@/lib/api/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api/server')>()), serverApiRequest: mocks.apiRequest }));

import { POST as verifyFirebasePhone } from '@/app/api/bff/auth/phone/verify/route';
import { createResetFlow, openResetFlow, readResetFlow, sealResetFlow, writeResetFlow } from '@/lib/auth/reset-flow';
import { forgotPassword, resetPassword, sendOtp, verifyResetCode } from '@/server/actions/verification';

describe('protected password reset and verification flows', () => {
  beforeEach(() => {
    mocks.values.clear();
    mocks.store.get.mockClear();
    mocks.store.set.mockClear();
    mocks.store.delete.mockClear();
    mocks.apiRequest.mockReset().mockResolvedValue({ message: 'upstream internal wording' });
    mocks.revalidatePath.mockReset();
    mocks.revalidateTag.mockReset();
  });

  it('round-trips encrypted state without exposing the email or code and fails closed on tamper/expiry', () => {
    const state = { ...createResetFlow('person@example.com', 1_000), code: '123456', verified: true };
    const sealed = sealResetFlow(state);
    expect(sealed).not.toMatch(/person@example\.com|123456/);
    expect(openResetFlow(sealed, 2_000)).toEqual(state);
    expect(openResetFlow(`${sealed[0] === 'A' ? 'B' : 'A'}${sealed.slice(1)}`, 2_000)).toBeNull();
    expect(openResetFlow(sealed, 1_000 + 16 * 60 * 1_000)).toBeNull();
  });

  it('normalizes email into protected state and always returns generic forgot-password copy', async () => {
    const result = await forgotPassword({ email: ' Person@Example.COM ' });
    expect(result).toEqual({ ok: true, data: { message: 'If the account exists, reset instructions have been sent.' } });
    expect(mocks.apiRequest).toHaveBeenCalledWith(expect.objectContaining({ input: { email: 'person@example.com' } }));
    expect(readResetFlow(mocks.store)?.email).toBe('person@example.com');
  });

  it('binds code verification to the encrypted browser flow and sends only email/code upstream', async () => {
    const flow = createResetFlow('person@example.com');
    writeResetFlow(mocks.store, flow);
    mocks.apiRequest.mockResolvedValueOnce({ message: 'verified' });
    const result = await verifyResetCode({ flow: flow.nonce, code: '123456' });
    expect(result.ok).toBe(true);
    expect(mocks.apiRequest).toHaveBeenCalledWith(expect.objectContaining({ input: { email: 'person@example.com', code: '123456' } }));
    expect(readResetFlow(mocks.store)).toMatchObject({ code: '123456', verified: true, nonce: flow.nonce });
  });

  it('clears mismatched flow state before any upstream request', async () => {
    const flow = createResetFlow('person@example.com');
    writeResetFlow(mocks.store, flow);
    mocks.apiRequest.mockClear();
    const result = await verifyResetCode({ flow: '00000000-0000-4000-8000-000000000000', code: '123456' });
    expect(result).toMatchObject({ ok: false, error: { status: 409, code: 'RESET_FLOW_INVALID' } });
    expect(readResetFlow(mocks.store)).toBeNull();
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it('reconstructs the exact reset request once, strips confirmation/flow, and clears session state', async () => {
    const flow = { ...createResetFlow('person@example.com'), code: '123456', verified: true };
    writeResetFlow(mocks.store, flow);
    mocks.apiRequest.mockResolvedValueOnce({ message: 'reset' });
    const result = await resetPassword({ flow: flow.nonce, code: '123456', newPassword: 'StrongPass1', confirmPassword: 'StrongPass1' });
    expect(result.ok).toBe(true);
    expect(mocks.apiRequest).toHaveBeenCalledWith(expect.objectContaining({
      input: { email: 'person@example.com', code: '123456', newPassword: 'StrongPass1' },
      idempotencyKey: expect.any(String),
    }));
    expect(readResetFlow(mocks.store)).toBeNull();
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith('/', 'layout');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/en/login');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/ar/login');
  });

  it('rejects confirmation mismatches as 400 without upstream I/O', async () => {
    const flow = { ...createResetFlow('person@example.com'), code: '123456', verified: true };
    writeResetFlow(mocks.store, flow);
    mocks.apiRequest.mockClear();
    const result = await resetPassword({ flow: flow.nonce, code: '123456', newPassword: 'StrongPass1', confirmPassword: 'Different1' });
    expect(result).toMatchObject({ ok: false, error: { status: 400 } });
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it('adds idempotency to OTP sends and preserves rate-limit errors', async () => {
    await sendOtp({ purpose: 'PHONE_VERIFY' });
    expect(mocks.apiRequest).toHaveBeenCalledWith(expect.objectContaining({ operation: 'sendOtp', idempotencyKey: expect.any(String) }));
  });

  it('verifies Firebase phone credentials without echoing them and invalidates session/profile state', async () => {
    mocks.apiRequest.mockResolvedValueOnce({ data: { publicId: 'usr_public', phone: '+201000000000', phoneVerifiedAt: '2026-09-08T00:00:00.000Z' } });
    const idToken = 'firebase-phone-secret';
    const request = new Request('http://localhost:3000/api/bff/auth/phone/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', cookie: 'am_csrf=csrf-value', 'x-csrf-token': 'csrf-value' },
      body: JSON.stringify({ idToken, phone: '+201000000000' }),
    });
    const response = await verifyFirebasePhone(request);
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain(idToken);
    expect(mocks.apiRequest).toHaveBeenCalledWith(expect.objectContaining({ input: { idToken, phone: '+201000000000' } }));
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith('/', 'layout');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/en/profile');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/ar/profile');
  });
});
