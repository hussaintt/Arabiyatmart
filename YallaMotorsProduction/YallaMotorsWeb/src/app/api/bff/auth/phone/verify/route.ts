import { NextResponse } from 'next/server';
import { VerifyFirebasePhoneInputSchema, VerifiedPhoneUserResponseSchema } from '@/lib/api/schemas/profile';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { serverApiRequest } from '@/lib/api/server';
import { validateMutationCsrf } from '@/lib/auth/csrf';
import { createCookieCredentialResolver } from '@/lib/auth/session';
import { revalidatePath, revalidateTag } from 'next/cache';
import { executeInvalidationPlan, invalidationPlans } from '@/lib/cache/invalidation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const headers = new Headers({ 'Cache-Control': 'private, no-store' });
  const csrf = validateMutationCsrf({ method: 'POST', headers: request.headers, cookies: request.headers });
  if (!csrf.valid) return NextResponse.json(createOperationError({ status: 403, code: 'FORBIDDEN', message: 'Invalid request origin or CSRF token' }), { status: 403, headers });
  try {
    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > 16 * 1024) throw new ApiContractError(createOperationError({ status: 413, message: 'Verification request is too large' }));
    const input = VerifyFirebasePhoneInputSchema.parse(await request.json());
    const result = await serverApiRequest({ operation: 'verifyFirebasePhone', method: 'POST', endpoint: UPSTREAM_ENDPOINTS.verifyFirebasePhone, input, outputSchema: VerifiedPhoneUserResponseSchema, authMode: 'M', cachePolicy: { cache: 'no-store', isPrivate: true }, credentialResolver: createCookieCredentialResolver(request.headers) });
    await executeInvalidationPlan(invalidationPlans.verifyOtp(), { revalidatePath, revalidateTag });
    return NextResponse.json(result, { status: 200, headers });
  } catch (error) {
    const body = error instanceof ApiContractError ? error.body : createOperationError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid phone verification request' });
    return NextResponse.json(body, { status: body.error.status, headers });
  }
}
