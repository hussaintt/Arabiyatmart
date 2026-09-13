'use server';

import crypto from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { revalidatePath, revalidateTag } from 'next/cache';
import { executeInvalidationPlan, invalidationPlans } from '@/lib/cache/invalidation';
import { z } from 'zod';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { serverApiRequest } from '@/lib/api/server';
import {
  ChangePasswordInputSchema,
  ForgotPasswordInputSchema,
  OtpSendInputSchema,
  OtpVerifyInputSchema,
  ResetPasswordInputSchema,
  VerifyResetCodeInputSchema,
} from '@/lib/api/schemas/auth';
import { MessageResponseSchema, MutationAckResponseSchema } from '@/lib/api/schemas/common';
import { SetPhoneInputSchema } from '@/lib/api/schemas/profile';
import { validateOrigin, validateSecFetchSite } from '@/lib/auth/csrf';
import { clearSessionCredentials, createCookieCredentialResolver } from '@/lib/auth/session';
import { clearResetFlow, createResetFlow, readResetFlow, writeResetFlow } from '@/lib/auth/reset-flow';
import type { CookieStoreLike, CookieTarget } from '@/lib/auth/cookies';
import type { ActionResult, MessageResponse, MutationAckResponse } from '@/types/common';

const MessageOrAckSchema = z.union([MessageResponseSchema, MutationAckResponseSchema]);

function asRecord(input: unknown): unknown {
  return input instanceof FormData ? Object.fromEntries(input.entries()) : input;
}

function failure<T>(error: unknown, fallback = 'Request could not be completed'): ActionResult<T> {
  const body = error instanceof ApiContractError ? error.body : error instanceof z.ZodError
    ? createOperationError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid request', fieldErrors: error.issues.map((issue) => ({ field: issue.path.join('.') || 'input', code: issue.code, message: issue.message })) })
    : createOperationError({ status: 500, message: fallback });
  return { ok: false, error: body.error };
}

async function requireActionCsrf(): Promise<void> {
  const requestHeaders = await headers();
  const origin = validateOrigin(requestHeaders);
  const site = validateSecFetchSite(requestHeaders);
  if (!origin.valid || !site.valid) throw new ApiContractError(createOperationError({ status: 403, code: 'FORBIDDEN', message: 'Invalid request origin' }));
}

async function messageOperation(options: {
  operation: string;
  endpoint: () => string;
  input?: unknown;
  authenticated?: boolean;
  idempotent?: boolean;
  successMessage: string;
}): Promise<MessageResponse> {
  const store = await cookies();
  const response = await serverApiRequest({
    operation: options.operation,
    method: 'POST',
    endpoint: options.endpoint,
    input: options.input,
    outputSchema: MessageOrAckSchema,
    authMode: options.authenticated ? 'M' : 'P',
    cachePolicy: { cache: 'no-store', isPrivate: true },
    credentialResolver: options.authenticated
      ? createCookieCredentialResolver(store as unknown as CookieStoreLike)
      : undefined,
    idempotencyKey: options.idempotent ? crypto.randomUUID() : undefined,
  });
  return 'message' in response ? response : { message: options.successMessage };
}

export async function forgotPassword(input: unknown): Promise<ActionResult<MessageResponse>> {
  try {
    await requireActionCsrf();
    const parsed = ForgotPasswordInputSchema.parse(asRecord(input));
    await messageOperation({ operation: 'forgotPassword', endpoint: UPSTREAM_ENDPOINTS.forgotPassword, input: parsed, successMessage: 'If the account exists, reset instructions have been sent.' });
    writeResetFlow(await cookies() as unknown as CookieStoreLike, createResetFlow(parsed.email));
    return { ok: true, data: { message: 'If the account exists, reset instructions have been sent.' } };
  } catch (error) { return failure(error); }
}

export async function verifyResetCode(input: unknown): Promise<ActionResult<MessageResponse>> {
  const store = await cookies();
  try {
    await requireActionCsrf();
    const parsed = VerifyResetCodeInputSchema.parse(asRecord(input));
    const flow = readResetFlow(store as unknown as CookieStoreLike);
    if (!flow) throw new ApiContractError(createOperationError({ status: 409, code: 'RESET_FLOW_EXPIRED', message: 'Password reset flow has expired' }));
    if (parsed.flow !== flow.nonce) {
      clearResetFlow(store as unknown as CookieStoreLike);
      throw new ApiContractError(createOperationError({ status: 409, code: 'RESET_FLOW_INVALID', message: 'Password reset flow does not match this browser session' }));
    }
    const data = await messageOperation({ operation: 'verifyResetCode', endpoint: UPSTREAM_ENDPOINTS.verifyResetCode, input: { email: flow.email, code: parsed.code }, successMessage: 'Reset code verified.' });
    writeResetFlow(store as unknown as CookieStoreLike, { ...flow, code: parsed.code, verified: true });
    return { ok: true, data };
  } catch (error) {
    if (!readResetFlow(store as unknown as CookieStoreLike)) clearResetFlow(store as unknown as CookieStoreLike);
    return failure(error);
  }
}

export async function resetPassword(input: unknown): Promise<ActionResult<MessageResponse>> {
  const store = await cookies();
  try {
    await requireActionCsrf();
    const parsed = ResetPasswordInputSchema.parse(asRecord(input));
    const flow = readResetFlow(store as unknown as CookieStoreLike);
    if (!flow) throw new ApiContractError(createOperationError({ status: 409, code: 'RESET_FLOW_EXPIRED', message: 'Password reset flow has expired' }));
    if (parsed.flow !== flow.nonce || !flow.verified || !flow.code || flow.code !== parsed.code) {
      clearResetFlow(store as unknown as CookieStoreLike);
      throw new ApiContractError(createOperationError({ status: 409, code: 'RESET_FLOW_INVALID', message: 'Password reset flow is invalid or expired' }));
    }
    const data = await messageOperation({ operation: 'resetPassword', endpoint: UPSTREAM_ENDPOINTS.resetPassword, input: { email: flow.email, code: flow.code, newPassword: parsed.newPassword }, idempotent: true, successMessage: 'Password reset successfully.' });
    clearResetFlow(store as unknown as CookieStoreLike);
    clearSessionCredentials(store as unknown as CookieTarget);
    await executeInvalidationPlan(invalidationPlans.logout(), { revalidatePath, revalidateTag });
    return { ok: true, data };
  } catch (error) { return failure(error); }
}

export async function resendEmailVerification(): Promise<ActionResult<MessageResponse>> {
  try { await requireActionCsrf(); return { ok: true, data: await messageOperation({ operation: 'resendEmailVerification', endpoint: UPSTREAM_ENDPOINTS.resendVerification, authenticated: true, idempotent: true, successMessage: 'Verification message sent.' }) }; }
  catch (error) { return failure(error); }
}

export async function sendOtp(input: unknown): Promise<ActionResult<MessageResponse>> {
  try { await requireActionCsrf(); const parsed = OtpSendInputSchema.parse(asRecord(input)); return { ok: true, data: await messageOperation({ operation: 'sendOtp', endpoint: UPSTREAM_ENDPOINTS.sendOtp, input: parsed, authenticated: true, idempotent: true, successMessage: 'Verification code sent.' }) }; }
  catch (error) { return failure(error); }
}

export async function verifyOtp(input: unknown): Promise<ActionResult<MessageResponse>> {
  try { await requireActionCsrf(); const parsed = OtpVerifyInputSchema.parse(asRecord(input)); const data = await messageOperation({ operation: 'verifyOtp', endpoint: UPSTREAM_ENDPOINTS.verifyOtp, input: parsed, authenticated: true, successMessage: 'Verification completed.' }); await executeInvalidationPlan(invalidationPlans.verifyOtp(), { revalidatePath, revalidateTag }); return { ok: true, data }; }
  catch (error) { return failure(error); }
}

export async function changePassword(input: unknown): Promise<ActionResult<MutationAckResponse>> {
  try {
    await requireActionCsrf();
    const parsed = ChangePasswordInputSchema.parse(asRecord(input));
    const store = await cookies();
    const data = await serverApiRequest({ operation: 'changePassword', method: 'POST', endpoint: UPSTREAM_ENDPOINTS.changePassword, input: { currentPassword: parsed.currentPassword, newPassword: parsed.newPassword }, outputSchema: MutationAckResponseSchema, authMode: 'M', cachePolicy: { cache: 'no-store', isPrivate: true }, credentialResolver: createCookieCredentialResolver(store as unknown as CookieStoreLike), idempotencyKey: crypto.randomUUID() });
    await executeInvalidationPlan(invalidationPlans.changePassword(), { revalidatePath, revalidateTag });
    return { ok: true, data };
  } catch (error) { return failure(error); }
}

export async function setPhone(input: unknown): Promise<ActionResult<MessageResponse>> {
  try { await requireActionCsrf(); const parsed = SetPhoneInputSchema.parse(asRecord(input)); const data = await messageOperation({ operation: 'setPhone', endpoint: UPSTREAM_ENDPOINTS.setPhone, input: parsed, authenticated: true, idempotent: true, successMessage: 'Phone verification started.' }); await executeInvalidationPlan(invalidationPlans.setPhone(), { revalidatePath, revalidateTag }); return { ok: true, data }; }
  catch (error) { return failure(error); }
}
