import { NextResponse } from 'next/server';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { serverApiRequest } from '@/lib/api/server';
import { FilePublicIdParamsSchema, FileStatusResponseSchema, adaptRawFileStatus } from '@/lib/api/schemas/upload';
import { createCookieCredentialResolver } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ publicId: string }> }): Promise<Response> {
  try {
    const { publicId } = FilePublicIdParamsSchema.parse(await context.params);
    const data = await serverApiRequest({ operation: 'getFileStatus', method: 'GET', endpoint: () => UPSTREAM_ENDPOINTS.fileStatus(publicId), outputSchema: FileStatusResponseSchema, authMode: 'O', cachePolicy: { cache: 'no-store', isPrivate: true }, credentialResolver: createCookieCredentialResolver(request.headers), adapter: adaptRawFileStatus });
    return NextResponse.json(data, { status: 200, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const body = error instanceof ApiContractError ? error.body : createOperationError({ status: 400, message: 'Invalid file status request' });
    return NextResponse.json(body, { status: body.error.status, headers: { 'Cache-Control': 'private, no-store' } });
  }
}

