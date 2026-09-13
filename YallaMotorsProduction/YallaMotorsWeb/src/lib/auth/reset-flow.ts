import 'server-only';

import crypto from 'node:crypto';
import { z } from 'zod';
import { serverEnv } from '@/lib/env/server';
import { getAuthCookieOptions, isSecureEnvironment, type CookieStoreLike } from '@/lib/auth/cookies';

export const RESET_FLOW_COOKIE = 'am_reset_flow';
export const RESET_FLOW_TTL_SECONDS = 15 * 60;

export interface ResetFlowState {
  email: string;
  code: string | null;
  verified: boolean;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

const ResetFlowStateSchema: z.ZodType<ResetFlowState> = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().regex(/^\d{6}$/).nullable(),
  verified: z.boolean(),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  nonce: z.string().uuid(),
}).strict().superRefine((state, context) => {
  if (state.expiresAt <= state.issuedAt || state.expiresAt - state.issuedAt > RESET_FLOW_TTL_SECONDS * 1000) {
    context.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Reset flow lifetime is invalid' });
  }
  if (state.verified !== Boolean(state.code)) {
    context.addIssue({ code: 'custom', path: ['verified'], message: 'Reset flow verification state is inconsistent' });
  }
});

function encryptionKey(): Buffer {
  return crypto.createHash('sha256').update(serverEnv.CSRF_SECRET, 'utf8').digest();
}

export function sealResetFlow(state: ResetFlowState): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

export function openResetFlow(value: string | null | undefined, now = Date.now()): ResetFlowState | null {
  if (!value || value.length > 2048) return null;
  try {
    const packed = Buffer.from(value, 'base64url');
    if (packed.length < 29) return null;
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const ciphertext = packed.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const raw = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')) as unknown;
    const parsed = ResetFlowStateSchema.safeParse(raw);
    if (!parsed.success || parsed.data.expiresAt <= now || parsed.data.issuedAt > now + 60_000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function readResetFlow(store: CookieStoreLike): ResetFlowState | null {
  return openResetFlow(store.get(RESET_FLOW_COOKIE)?.value);
}

export function writeResetFlow(store: CookieStoreLike, state: ResetFlowState): void {
  store.set(RESET_FLOW_COOKIE, sealResetFlow(state), {
    ...getAuthCookieOptions('refresh', RESET_FLOW_TTL_SECONDS, isSecureEnvironment()),
    httpOnly: true,
  });
}

export function clearResetFlow(store: CookieStoreLike): void {
  if (store.delete) store.delete(RESET_FLOW_COOKIE);
  else store.set(RESET_FLOW_COOKIE, '', { ...getAuthCookieOptions('refresh', 0), maxAge: 0, expires: new Date(0) });
}

export function createResetFlow(email: string, now = Date.now()): ResetFlowState {
  return {
    email,
    code: null,
    verified: false,
    issuedAt: now,
    expiresAt: now + RESET_FLOW_TTL_SECONDS * 1000,
    nonce: crypto.randomUUID(),
  };
}
