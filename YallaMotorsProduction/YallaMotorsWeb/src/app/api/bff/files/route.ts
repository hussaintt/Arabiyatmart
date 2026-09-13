import crypto from 'node:crypto';
import { createWriteStream, openAsBlob } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import Busboy, { type FileInfo } from 'busboy';
import { NextResponse } from 'next/server';
import { UploadPurposeSchema, UploadedFileResponseSchema, UPLOAD_PURPOSE_CONFIG, adaptRawUploadedFile } from '@/lib/api/schemas/upload';
import { UPSTREAM_ENDPOINTS } from '@/lib/api/endpoints';
import { ApiContractError, createOperationError } from '@/lib/api/error';
import { serverApiRequest } from '@/lib/api/server';
import { validateMutationCsrf } from '@/lib/auth/csrf';
import { createCookieCredentialResolver } from '@/lib/auth/session';
import { executeIdempotentRoute, requireIdempotencyKey } from '@/lib/security/route-idempotency';
import type { HttpStatus } from '@/types/common';

export const dynamic = 'force-dynamic';

const MULTIPART_OVERHEAD_BYTES = 128 * 1024;
const SIGNATURE_BYTES = 1024;
const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'],
  'image/heic': ['heic'], 'image/heif': ['heif'], 'image/svg+xml': ['svg'],
  'application/pdf': ['pdf'], 'video/mp4': ['mp4'], 'video/quicktime': ['mov'],
  'video/x-matroska': ['mkv'], 'video/webm': ['webm'], 'text/csv': ['csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/zip': ['zip'],
  'application/json': ['json'],
};

interface ParsedUpload {
  tempDir: string;
  path: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string;
}

function uploadError(status: HttpStatus, code: string, message: string): ApiContractError {
  return new ApiContractError(createOperationError({ status, code, message }));
}

function sanitizedFilename(filename: string): string {
  const normalized = filename.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(-160);
  if (!normalized || normalized === '.' || normalized === '..') throw uploadError(422, 'INVALID_FILENAME', 'Filename is invalid');
  return normalized;
}

function magicMatches(mime: string, head: Uint8Array, tail: Uint8Array): boolean {
  const ascii = new TextDecoder().decode(head);
  const lowerAscii = ascii.toLowerCase();
  const headHex = Buffer.from(head).toString('hex');
  const tailHex = Buffer.from(tail).toString('hex');
  if (mime !== 'image/svg+xml' && /<(?:script|html|svg|\?php)[\s>]/i.test(lowerAscii)) return false;
  if (mime === 'image/jpeg') return headHex.startsWith('ffd8ff') && tailHex.endsWith('ffd9');
  if (mime === 'image/png') return headHex.startsWith('89504e470d0a1a0a') && tailHex.includes('49454e44ae426082');
  if (mime === 'image/webp') return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP';
  if (mime === 'application/pdf') return ascii.startsWith('%PDF-') && new TextDecoder().decode(tail).includes('%%EOF');
  if (mime === 'image/svg+xml') return /<svg[\s>]/i.test(ascii.replace(/^\s*<\?xml[^>]*>/i, '').trimStart());
  if (mime === 'video/webm' || mime === 'video/x-matroska') return headHex.startsWith('1a45dfa3');
  if (mime === 'video/quicktime') return ascii.slice(4, 8) === 'ftyp' && ascii.slice(8, 12) === 'qt  ';
  if (mime === 'video/mp4') return ascii.slice(4, 8) === 'ftyp' && ascii.slice(8, 12) !== 'qt  ';
  if (mime === 'image/heic' || mime === 'image/heif') {
    return ascii.slice(4, 8) === 'ftyp' && /^(?:heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(ascii.slice(8, 12));
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mime === 'application/zip') return /^(?:504b0304|504b0506|504b0708)/.test(headHex);
  if (mime === 'application/json') {
    const trimmed = ascii.trimStart();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
  }
  if (mime === 'text/csv') {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(head);
      return !head.includes(0);
    } catch { return false; }
  }
  return false;
}

async function validateSafeSvg(path: string): Promise<void> {
  const source = await readFile(path, 'utf8');
  if (/<(?:script|foreignObject|iframe|object|embed)\b|\bon[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*(?:javascript:|data:text\/html)/i.test(source)) {
    throw uploadError(422, 'UNSUPPORTED_MEDIA_TYPE', 'Active SVG content is not permitted');
  }
}

async function parseMultipartToDisk(request: Request, maxSizeBytes: number): Promise<ParsedUpload> {
  if (request.signal.aborted) throw uploadError(400, 'UPLOAD_ABORTED', 'Upload was aborted');
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !/\bboundary=/i.test(contentType)) {
    throw uploadError(400, 'BAD_REQUEST', 'A multipart/form-data body with a boundary is required');
  }
  if (!request.body) throw uploadError(400, 'BAD_REQUEST', 'A file body is required');

  const tempDir = await mkdtemp(join(tmpdir(), 'arabiyatmart-upload-'));
  const path = join(tempDir, 'upload.bin');
  try {
    return await new Promise<ParsedUpload>((resolve, reject) => {
      let filename = '';
      let mime = '';
      let size = 0;
      let head = Buffer.alloc(0);
      let tail = Buffer.alloc(0);
      let digest = '';
      let filePromise: Promise<void> | null = null;
      let parseError: unknown = null;
      let fileSeen = false;
      const busboy = Busboy({
        headers: { 'content-type': contentType },
        limits: { files: 1, fields: 0, parts: 2, fileSize: maxSizeBytes + 1, headerPairs: 32 },
      });
      const abort = (error: unknown) => {
        if (!parseError) parseError = error;
        busboy.destroy(error instanceof Error ? error : new Error('Upload aborted'));
      };

      busboy.on('file', (fieldName: string, stream: Readable, info: FileInfo) => {
        if (fieldName !== 'file' || fileSeen) {
          stream.resume();
          abort(uploadError(400, 'BAD_REQUEST', 'Exactly one file field named "file" is required'));
          return;
        }
        fileSeen = true;
        try {
          filename = sanitizedFilename(info.filename);
          mime = info.mimeType.toLowerCase().trim();
        } catch (error) {
          stream.resume();
          abort(error);
          return;
        }
        const hash = crypto.createHash('sha256');
        let limited = false;
        stream.once('limit', () => { limited = true; });
        const meter = new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            size += chunk.length;
            if (size > maxSizeBytes) return callback(uploadError(413, 'PAYLOAD_TOO_LARGE', 'Upload exceeds the permitted size'));
            hash.update(chunk);
            if (head.length < SIGNATURE_BYTES) head = Buffer.concat([head, chunk]).subarray(0, SIGNATURE_BYTES);
            tail = Buffer.concat([tail, chunk]).subarray(-SIGNATURE_BYTES);
            callback(null, chunk);
          },
        });
        filePromise = pipeline(stream, meter, createWriteStream(path, { flags: 'wx' }))
          .then(() => {
            if (limited) throw uploadError(413, 'PAYLOAD_TOO_LARGE', 'Upload exceeds the permitted size');
            digest = hash.digest('hex');
          })
          .catch((error) => {
            parseError = error;
            busboy.destroy(error instanceof Error ? error : new Error('Upload failed'));
          });
      });
      busboy.once('filesLimit', () => abort(uploadError(400, 'BAD_REQUEST', 'Duplicate file fields are not permitted')));
      busboy.once('fieldsLimit', () => abort(uploadError(400, 'BAD_REQUEST', 'Unexpected multipart fields are not permitted')));
      busboy.once('partsLimit', () => abort(uploadError(400, 'BAD_REQUEST', 'Unexpected multipart parts are not permitted')));
      busboy.once('error', reject);
      busboy.once('close', () => {
        void (async () => {
          if (filePromise) await filePromise;
          if (parseError) throw parseError;
          if (!fileSeen || !filePromise || size <= 0 || !digest) throw uploadError(400, 'BAD_REQUEST', 'Exactly one non-empty file is required');
          if (!magicMatches(mime, head, tail)) throw uploadError(422, 'UNSUPPORTED_MEDIA_TYPE', 'File signature does not match the declared file type');
          resolve({ tempDir, path, filename, mime, size, sha256: digest });
        })().catch(reject);
      });

      const source = Readable.fromWeb(request.body as unknown as Parameters<typeof Readable.fromWeb>[0]);
      source.once('error', reject);
      request.signal.addEventListener('abort', () => {
        source.destroy(request.signal.reason instanceof Error ? request.signal.reason : new DOMException('Upload aborted', 'AbortError'));
        abort(request.signal.reason);
      }, { once: true });
      source.pipe(busboy);
    });
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

function errorResponse(error: unknown): Response {
  const body = error instanceof ApiContractError ? error.body : createOperationError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid upload request' });
  return NextResponse.json(body, { status: body.error.status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request): Promise<Response> {
  const csrf = validateMutationCsrf({ method: 'POST', headers: request.headers, cookies: request.headers });
  if (!csrf.valid) return errorResponse(uploadError(403, 'FORBIDDEN', 'Invalid request origin or CSRF token'));
  let parsedUpload: ParsedUpload | null = null;
  try {
    requireIdempotencyKey(request);
    const purpose = UploadPurposeSchema.parse(new URL(request.url).searchParams.get('purpose'));
    const config = UPLOAD_PURPOSE_CONFIG[purpose];
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (!Number.isFinite(declared) || declared <= 0) throw uploadError(400, 'BAD_REQUEST', 'A bounded Content-Length header is required');
    if (declared > config.maxSizeBytes + MULTIPART_OVERHEAD_BYTES) throw uploadError(413, 'PAYLOAD_TOO_LARGE', 'Upload exceeds the permitted size');

    parsedUpload = await parseMultipartToDisk(request, config.maxSizeBytes);
    if (!config.allowedMimeTypes.includes(parsedUpload.mime)) throw uploadError(422, 'UNSUPPORTED_MEDIA_TYPE', 'File type is not permitted');
    const extension = parsedUpload.filename.includes('.') ? parsedUpload.filename.split('.').pop()!.toLowerCase() : '';
    if (!(MIME_EXTENSIONS[parsedUpload.mime] ?? []).includes(extension)) throw uploadError(422, 'UNSUPPORTED_MEDIA_TYPE', 'Filename extension does not match the file type');
    if (parsedUpload.mime === 'image/svg+xml') await validateSafeSvg(parsedUpload.path);

    return await executeIdempotentRoute({
      request,
      operation: 'uploadFile',
      canonicalBody: { purpose, filename: parsedUpload.filename, mime: parsedUpload.mime, size: parsedUpload.size, sha256: parsedUpload.sha256 },
      execute: async (idempotencyKey) => {
        const upstreamForm = new FormData();
        upstreamForm.set('file', await openAsBlob(parsedUpload!.path, { type: parsedUpload!.mime }), parsedUpload!.filename);
        const data = await serverApiRequest({
          operation: 'uploadFile', method: 'POST', endpoint: UPSTREAM_ENDPOINTS.uploadFile,
          query: { purpose }, input: upstreamForm, outputSchema: UploadedFileResponseSchema,
          authMode: 'U', cachePolicy: { cache: 'no-store', isPrivate: true },
          credentialResolver: createCookieCredentialResolver(request.headers),
          idempotencyKey, signal: request.signal, adapter: adaptRawUploadedFile,
        });
        return NextResponse.json(data, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
      },
    });
  } catch (error) {
    return errorResponse(error);
  } finally {
    if (parsedUpload) await rm(parsedUpload.tempDir, { recursive: true, force: true });
  }
}
