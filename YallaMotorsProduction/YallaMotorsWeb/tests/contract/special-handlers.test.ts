import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api/server')>()), serverApiRequest: mocks.apiRequest }));

import { POST as uploadFile } from '@/app/api/bff/files/route';
import { GET as getFileStatus } from '@/app/api/bff/files/[publicId]/status/route';
import { POST as setLocale } from '@/app/api/bff/locale/route';
import { DELETE as unregisterDevice, GET as listDevices, POST as registerDevice } from '@/app/api/bff/notifications/devices/route';
import { verifyLocalePreference } from '@/lib/auth/locale-cookie';
import { MemoryIdempotencyStore, setIdempotencyStore } from '@/lib/security/idempotency';

const csrfHeaders = {
  origin: 'http://localhost:3000',
  cookie: 'am_csrf=csrf-value',
  'x-csrf-token': 'csrf-value',
};

function localeRequest(locale: unknown) {
  return new Request('http://localhost:3000/api/bff/locale', {
    method: 'POST',
    headers: { ...csrfHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ locale }),
  });
}

async function multipartRequest(files: Array<{ name: string; type: string; bytes: Uint8Array }>, options: { key?: string; purpose?: string; declaredLength?: number } = {}) {
  const form = new FormData();
  for (const file of files) {
    const bytes = file.bytes.buffer.slice(file.bytes.byteOffset, file.bytes.byteOffset + file.bytes.byteLength) as ArrayBuffer;
    form.append('file', new File([bytes], file.name, { type: file.type }));
  }
  const source = new Request('http://localhost:3000/api/bff/files', { method: 'POST', body: form });
  const body = await source.arrayBuffer();
  return new Request(`http://localhost:3000/api/bff/files?purpose=${options.purpose ?? 'USER_AVATAR'}`, {
    method: 'POST',
    headers: {
      ...csrfHeaders,
      'content-type': source.headers.get('content-type')!,
      'content-length': String(options.declaredLength ?? body.byteLength),
      ...(options.key ? { 'idempotency-key': options.key } : {}),
    },
    body,
  });
}

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03, 0xff, 0xd9]);
const uploaded = {
  data: {
    publicId: 'fil_public',
    url: null,
    mimeType: 'image/jpeg',
    sizeBytes: jpeg.byteLength,
    width: null,
    height: null,
    variants: null,
    thumbnailUrl: null,
    status: 'READY',
  },
};

describe('special BFF handlers', () => {
  beforeEach(() => {
    setIdempotencyStore(new MemoryIdempotencyStore());
    mocks.apiRequest.mockReset().mockResolvedValue(uploaded);
  });

  it('sets and verifies only an HMAC-signed locale preference', async () => {
    const response = await setLocale(localeRequest('en'));
    expect(response.status).toBe(200);
    const cookieValue = response.headers.get('set-cookie')!.split(';')[0]!.split('=').slice(1).join('=');
    expect(cookieValue).not.toBe('en');
    expect(await verifyLocalePreference(cookieValue)).toBe('en');
    expect(await response.json()).toEqual({ data: { locale: 'en' } });
  });

  it('rejects unsupported locale values and cross-origin mutations', async () => {
    expect((await setLocale(localeRequest('fr'))).status).toBe(400);
    const crossOrigin = new Request('http://localhost:3000/api/bff/locale', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example', cookie: 'am_csrf=x', 'x-csrf-token': 'x' }, body: '{"locale":"en"}' });
    expect((await setLocale(crossOrigin)).status).toBe(403);
  });

  it('requires an explicit idempotency key before parsing an upload', async () => {
    const response = await uploadFile(await multipartRequest([{ name: 'avatar.jpg', type: 'image/jpeg', bytes: jpeg }]));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('MISSING_IDEMPOTENCY_KEY');
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it('streams a bounded, signature-validated upload from disk and replays without duplicate upstream work', async () => {
    const first = await uploadFile(await multipartRequest([{ name: 'avatar.jpg', type: 'image/jpeg', bytes: jpeg }], { key: 'upload-key-0001' }));
    const second = await uploadFile(await multipartRequest([{ name: 'avatar.jpg', type: 'image/jpeg', bytes: jpeg }], { key: 'upload-key-0001' }));
    expect(await first.clone().json()).toEqual(uploaded);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers.get('x-idempotent-replay')).toBe('true');
    expect(mocks.apiRequest).toHaveBeenCalledOnce();
    expect(mocks.apiRequest).toHaveBeenCalledWith(expect.objectContaining({ authMode: 'U', idempotencyKey: 'upload-key-0001', signal: expect.any(AbortSignal) }));
    expect(JSON.stringify(await second.json())).not.toContain('storageKey');
  });

  it('returns 409 when an upload key is reused with a different body', async () => {
    await uploadFile(await multipartRequest([{ name: 'avatar.jpg', type: 'image/jpeg', bytes: jpeg }], { key: 'upload-key-0002' }));
    const changed = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x05, 0x06, 0xff, 0xd9]);
    const response = await uploadFile(await multipartRequest([{ name: 'avatar.jpg', type: 'image/jpeg', bytes: changed }], { key: 'upload-key-0002' }));
    expect(response.status).toBe(409);
    expect(mocks.apiRequest).toHaveBeenCalledOnce();
  });

  it('rejects duplicate, oversized, extension-mismatched, and polyglot multipart input', async () => {
    const duplicate = await uploadFile(await multipartRequest([
      { name: 'one.jpg', type: 'image/jpeg', bytes: jpeg },
      { name: 'two.jpg', type: 'image/jpeg', bytes: jpeg },
    ], { key: 'upload-key-0003' }));
    expect(duplicate.status).toBe(400);

    const oversized = await uploadFile(await multipartRequest([{ name: 'avatar.jpg', type: 'image/jpeg', bytes: jpeg }], { key: 'upload-key-0004', declaredLength: 3 * 1024 * 1024 }));
    expect(oversized.status).toBe(413);

    const wrongExtension = await uploadFile(await multipartRequest([{ name: 'avatar.png', type: 'image/jpeg', bytes: jpeg }], { key: 'upload-key-0005' }));
    expect(wrongExtension.status).toBe(422);

    const polyglot = new Uint8Array([...jpeg.slice(0, 4), ...new TextEncoder().encode('<script>alert(1)</script>'), 0xff, 0xd9]);
    const polyglotResponse = await uploadFile(await multipartRequest([{ name: 'avatar.jpg', type: 'image/jpeg', bytes: polyglot }], { key: 'upload-key-0006' }));
    expect(polyglotResponse.status).toBe(422);
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it('stops an already-aborted upload before temporary parsing or upstream work', async () => {
    const source = await multipartRequest([{ name: 'avatar.jpg', type: 'image/jpeg', bytes: jpeg }], { key: 'upload-key-0007' });
    const controller = new AbortController();
    const request = new Request(source, { signal: controller.signal });
    controller.abort();
    const response = await uploadFile(request);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('UPLOAD_ABORTED');
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });

  it('returns private no-store file status through the exact validated endpoint', async () => {
    mocks.apiRequest.mockResolvedValueOnce({ data: { publicId: 'fil_public', status: 'PROCESSING', failureReason: null } });
    const response = await getFileStatus(
      new Request('http://localhost:3000/api/bff/files/fil_public/status'),
      { params: Promise.resolve({ publicId: 'fil_public' }) }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.apiRequest).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'getFileStatus',
      authMode: 'O',
      cachePolicy: { cache: 'no-store', isPrivate: true },
    }));
    expect(mocks.apiRequest.mock.calls[0]![0].endpoint()).toBe('/v1/files/fil_public/status');
  });

  it('requires idempotency for device registration and strips the device token from output', async () => {
    const token = 'private-device-registration-token';
    const input = { token, platform: 'WEB', appVersion: '1.0.0', locale: 'en' };
    const withoutKey = new Request('http://localhost:3000/api/bff/notifications/devices', { method: 'POST', headers: { ...csrfHeaders, 'content-type': 'application/json' }, body: JSON.stringify(input) });
    expect((await registerDevice(withoutKey)).status).toBe(400);

    mocks.apiRequest.mockResolvedValueOnce({ data: { publicId: 'dev_public', platform: 'WEB', appVersion: '1.0.0', locale: 'en', lastSeenAt: '2026-09-08T00:00:00.000Z', createdAt: '2026-09-08T00:00:00.000Z' } });
    const withKey = new Request('http://localhost:3000/api/bff/notifications/devices', { method: 'POST', headers: { ...csrfHeaders, 'content-type': 'application/json', 'idempotency-key': 'device-key-0001' }, body: JSON.stringify(input) });
    const response = await registerDevice(withKey);
    expect(response.status).toBe(201);
    expect(await response.text()).not.toContain(token);
    expect(mocks.apiRequest).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'device-key-0001', input }));

    const replay = new Request('http://localhost:3000/api/bff/notifications/devices', { method: 'POST', headers: { ...csrfHeaders, 'content-type': 'application/json', 'idempotency-key': 'device-key-0001' }, body: JSON.stringify(input) });
    expect((await registerDevice(replay)).headers.get('x-idempotent-replay')).toBe('true');
    expect(mocks.apiRequest).toHaveBeenCalledOnce();
  });

  it('strips device tokens from list output and URL-encodes unregister tokens', async () => {
    const token = 'private:device+token=value';
    const device = { publicId: 'dev_public', token, platform: 'WEB', appVersion: null, locale: 'ar', lastSeenAt: '2026-09-08T00:00:00.000Z', createdAt: '2026-09-08T00:00:00.000Z' };
    mocks.apiRequest.mockImplementationOnce(async (options: { adapter?: (raw: unknown) => unknown }) => options.adapter!({ data: [device] }));
    const listResponse = await listDevices(new Request('http://localhost:3000/api/bff/notifications/devices'));
    expect(listResponse.status).toBe(200);
    expect(await listResponse.text()).not.toContain(token);

    mocks.apiRequest.mockResolvedValueOnce({ ok: true });
    const request = new Request('http://localhost:3000/api/bff/notifications/devices', {
      method: 'DELETE',
      headers: { ...csrfHeaders, 'content-type': 'application/json', 'idempotency-key': 'device-key-0002' },
      body: JSON.stringify({ token }),
    });
    const response = await unregisterDevice(request);
    expect(response.status).toBe(200);
    const options = mocks.apiRequest.mock.calls.at(-1)![0];
    expect(options.endpoint()).toBe('/v1/notifications/devices/private%3Adevice%2Btoken%3Dvalue');
    expect(await response.text()).not.toContain(token);
  });

  it('rejects denied or incomplete notification registration payloads before upstream work', async () => {
    const request = new Request('http://localhost:3000/api/bff/notifications/devices', {
      method: 'POST',
      headers: { ...csrfHeaders, 'content-type': 'application/json', 'idempotency-key': 'device-key-0003' },
      body: JSON.stringify({ permission: 'denied', platform: 'WEB', locale: 'en', appVersion: null }),
    });
    expect((await registerDevice(request)).status).toBe(400);
    expect(mocks.apiRequest).not.toHaveBeenCalled();
  });
});
