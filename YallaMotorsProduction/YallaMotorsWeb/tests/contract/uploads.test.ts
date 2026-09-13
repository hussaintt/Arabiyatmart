import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/server')>()),
  serverApiRequest: mocks.apiRequest,
}));

import { POST as uploadFile } from '@/app/api/bff/files/route';
import {
  UPLOAD_PURPOSE_CONFIG,
  UploadPurposeSchema,
  validateUploadFileMeta,
} from '@/lib/api/schemas/upload';
import { MemoryIdempotencyStore, setIdempotencyStore } from '@/lib/security/idempotency';
import type { UploadPurpose } from '@/types/upload';

const csrfHeaders = {
  origin: 'http://localhost:3000',
  cookie: 'am_csrf=csrf-value',
  'x-csrf-token': 'csrf-value',
};

async function multipartRequest(
  files: Array<{ name: string; type: string; bytes: Uint8Array }>,
  options: { key?: string; purpose?: string; declaredLength?: number } = {}
) {
  const form = new FormData();
  for (const file of files) {
    const bytes = file.bytes.buffer.slice(
      file.bytes.byteOffset,
      file.bytes.byteOffset + file.bytes.byteLength
    ) as ArrayBuffer;
    form.append('file', new File([bytes], file.name, { type: file.type }));
  }
  const source = new Request('http://localhost:3000/api/bff/files', {
    method: 'POST',
    body: form,
  });
  const body = await source.arrayBuffer();
  return new Request(
    `http://localhost:3000/api/bff/files?purpose=${options.purpose ?? 'USER_AVATAR'}`,
    {
      method: 'POST',
      headers: {
        ...csrfHeaders,
        'content-type': source.headers.get('content-type')!,
        'content-length': String(options.declaredLength ?? body.byteLength),
        ...(options.key ? { 'idempotency-key': options.key } : {}),
      },
      body,
    }
  );
}

const validJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03, 0xff, 0xd9]);
const validPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
const validPdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<<>>\nstartxref\n9\n%%EOF');
const validSvg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>');
const maliciousSvg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe('Cross-Service Upload Policy Contract', () => {
  beforeEach(() => {
    setIdempotencyStore(new MemoryIdempotencyStore());
    mocks.apiRequest.mockReset().mockResolvedValue({
      data: {
        publicId: 'fil_test123',
        url: 'https://cdn.example.com/file.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        width: 100,
        height: 100,
        variants: null,
        thumbnailUrl: null,
        status: 'READY',
      },
    });
  });

  describe('Web and Backend Policy Parity', () => {
    it('verifies that all 13 upload purposes are defined with identical limits in Web and Backend', () => {
      // Read backend files.service.ts source to parse PURPOSE_CONFIG
      const backendServicePath = path.resolve(
        __dirname,
        '../../../YallaMotorsBackend/src/modules/files/files.service.ts'
      );
      const backendSource = fs.readFileSync(backendServicePath, 'utf8');

      const allPurposes: UploadPurpose[] = [
        'USER_AVATAR',
        'LISTING_IMAGE',
        'LISTING_VIDEO',
        'VEHICLE_MAKE_LOGO',
        'TRIM_BROCHURE',
        'VENDOR_LOGO',
        'VENDOR_BANNER',
        'VENDOR_KYC',
        'VENDOR_BILLING_PROOF',
        'BANNER_IMAGE',
        'CHAT_ATTACHMENT',
        'EXPORT',
        'AI_STUDIO_SOURCE',
      ];

      expect(Object.keys(UPLOAD_PURPOSE_CONFIG)).toHaveLength(13);

      for (const purpose of allPurposes) {
        expect(UploadPurposeSchema.parse(purpose)).toBe(purpose);
        const webConfig = UPLOAD_PURPOSE_CONFIG[purpose];
        expect(webConfig).toBeDefined();
        if (!webConfig) continue;

        // Check purpose exists in backend source
        expect(backendSource).toContain(`${purpose}:`);

        // Check maxBytes matches in backend source
        const maxBytesRegex = new RegExp(
          `${purpose}:\\s*\\{[^}]*maxBytes:\\s*([^,]+),`
        );
        const match = backendSource.match(maxBytesRegex);
        expect(match, `Backend must define maxBytes for ${purpose}`).not.toBeNull();
        const backendBytesExpr = (match?.[1] ?? '0').trim();
        // Evaluate the numeric expression (e.g. 2 * 1024 * 1024)
        const expectedBackendBytes = Function(`'use strict'; return (${backendBytesExpr})`)();
        expect(
          webConfig!.maxSizeBytes,
          `maxBytes mismatch for ${purpose}: Web=${webConfig!.maxSizeBytes}, Backend=${expectedBackendBytes}`
        ).toBe(expectedBackendBytes);
      }
    });

    it('enforces that VENDOR_LOGO disallows SVG in both Web and Backend', () => {
      expect(UPLOAD_PURPOSE_CONFIG.VENDOR_LOGO.allowedMimeTypes).not.toContain('image/svg+xml');

      const backendServicePath = path.resolve(
        __dirname,
        '../../../YallaMotorsBackend/src/modules/files/files.service.ts'
      );
      const backendSource = fs.readFileSync(backendServicePath, 'utf8');
      const vendorLogoMatch = backendSource.match(/VENDOR_LOGO:\s*\{[^}]*\}/);
      expect(vendorLogoMatch).not.toBeNull();
      expect(vendorLogoMatch![0]).not.toContain('image/svg+xml');
    });

    it('enforces that VEHICLE_MAKE_LOGO allows SVG for catalogue make logos', () => {
      expect(UPLOAD_PURPOSE_CONFIG.VEHICLE_MAKE_LOGO.allowedMimeTypes).toContain('image/svg+xml');
    });
  });

  describe('Boundary File Size Validation', () => {
    it('accepts file exactly at maximum permitted size in validateUploadFileMeta', () => {
      for (const [purpose, config] of Object.entries(UPLOAD_PURPOSE_CONFIG)) {
        const allowedMime = config.allowedMimeTypes[0];
        if (!allowedMime) continue;
        const atLimit = validateUploadFileMeta(
          purpose as UploadPurpose,
          allowedMime,
          config.maxSizeBytes
        );
        expect(atLimit.valid, `Expected ${purpose} at limit ${config.maxSizeBytes} to be valid`).toBe(true);
      }
    });

    it('rejects file 1 byte over maximum permitted size with descriptive error', () => {
      for (const [purpose, config] of Object.entries(UPLOAD_PURPOSE_CONFIG)) {
        const allowedMime = config.allowedMimeTypes[0];
        if (!allowedMime) continue;
        const overLimit = validateUploadFileMeta(
          purpose as UploadPurpose,
          allowedMime,
          config.maxSizeBytes + 1
        );
        expect(overLimit.valid).toBe(false);
        expect(overLimit.error).toContain('exceeds maximum allowed size');
      }
    });

    it('rejects upload over size limit at BFF boundary with 413 PAYLOAD_TOO_LARGE', async () => {
      const config = UPLOAD_PURPOSE_CONFIG.USER_AVATAR;
      const request = await multipartRequest(
        [{ name: 'avatar.jpg', type: 'image/jpeg', bytes: validJpeg }],
        {
          key: 'bound-key-01',
          purpose: 'USER_AVATAR',
          declaredLength: config.maxSizeBytes + 200 * 1024,
        }
      );
      const res = await uploadFile(request);
      expect(res.status).toBe(413);
      const body = await res.json();
      expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('MIME Type and Extension Validation', () => {
    it('rejects unauthorized MIME type with 422 UNSUPPORTED_MEDIA_TYPE', async () => {
      const meta = validateUploadFileMeta('USER_AVATAR', 'application/pdf', 1024);
      expect(meta.valid).toBe(false);
      expect(meta.error).toContain('is not allowed for USER_AVATAR');

      const request = await multipartRequest(
        [{ name: 'doc.pdf', type: 'application/pdf', bytes: validPdf }],
        { key: 'bound-key-02', purpose: 'USER_AVATAR' }
      );
      const res = await uploadFile(request);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects file extension mismatch with 422 UNSUPPORTED_MEDIA_TYPE', async () => {
      const request = await multipartRequest(
        [{ name: 'avatar.png', type: 'image/jpeg', bytes: validJpeg }],
        { key: 'bound-key-03', purpose: 'USER_AVATAR' }
      );
      const res = await uploadFile(request);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects SVG upload for VENDOR_LOGO with 422 UNSUPPORTED_MEDIA_TYPE', async () => {
      const meta = validateUploadFileMeta('VENDOR_LOGO', 'image/svg+xml', 1024);
      expect(meta.valid).toBe(false);

      const request = await multipartRequest(
        [{ name: 'logo.svg', type: 'image/svg+xml', bytes: validSvg }],
        { key: 'bound-key-04', purpose: 'VENDOR_LOGO' }
      );
      const res = await uploadFile(request);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects active SVG with script injection for VEHICLE_MAKE_LOGO with 422 UNSUPPORTED_MEDIA_TYPE', async () => {
      const request = await multipartRequest(
        [{ name: 'make.svg', type: 'image/svg+xml', bytes: maliciousSvg }],
        { key: 'bound-key-05', purpose: 'VEHICLE_MAKE_LOGO' }
      );
      const res = await uploadFile(request);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('accepts valid PDF for TRIM_BROCHURE', async () => {
      const request = await multipartRequest(
        [{ name: 'brochure.pdf', type: 'application/pdf', bytes: validPdf }],
        { key: 'bound-key-06', purpose: 'TRIM_BROCHURE' }
      );
      const res = await uploadFile(request);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.publicId).toBe('fil_test123');
    });

    it('accepts valid PNG for VENDOR_LOGO', async () => {
      const request = await multipartRequest(
        [{ name: 'logo.png', type: 'image/png', bytes: validPng }],
        { key: 'bound-key-07', purpose: 'VENDOR_LOGO' }
      );
      const res = await uploadFile(request);
      expect(res.status).toBe(201);
    });
  });
});
