import type { AppLocale } from '@/i18n/config';
import { isAppLocale } from '@/i18n/config';

const VERSION = 'v1';
const DEVELOPMENT_SECRET = 'development-csrf-secret-32-chars-minimum-ok';

function signingSecret(override?: string): string {
  return override ?? process.env.CSRF_SECRET ?? DEVELOPMENT_SECRET;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function signedMessage(locale: AppLocale): Uint8Array {
  return new TextEncoder().encode(`${VERSION}:${locale}`);
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function signLocalePreference(locale: AppLocale, secret?: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', await importKey(signingSecret(secret)), ownedBuffer(signedMessage(locale)));
  return `${VERSION}.${locale}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyLocalePreference(value: string | null | undefined, secret?: string): Promise<AppLocale | null> {
  if (!value || value.length > 64) return null;
  const [version, rawLocale, rawSignature, extra] = value.split('.');
  if (version !== VERSION || extra !== undefined || !isAppLocale(rawLocale)) return null;
  const signature = base64UrlToBytes(rawSignature ?? '');
  if (!signature) return null;
  const valid = await crypto.subtle.verify(
    'HMAC',
    await importKey(signingSecret(secret)),
    ownedBuffer(signature),
    ownedBuffer(signedMessage(rawLocale))
  );
  return valid ? rawLocale : null;
}
