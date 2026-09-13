import '@testing-library/jest-dom/vitest';
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { server } from './msw-server';

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-for-hmac-sha256-long';

vi.mock('server-only', () => ({}));

let interceptedErrors: string[] = [];

const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;
const originalInfo = console.info;

const TOKEN_LEAKAGE_REGEX =
  /(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}|bearer\s+[a-zA-Z0-9_\-.]+|access_?token|refresh_?token|provider_?token|otp[=:\s]+[0-9]{4,6}|password[=:\s]+[^\s]+)/i;

function formatArgs(...args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack ?? ''}`;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

function verifyNoTokenLeakage(message: string): void {
  if (TOKEN_LEAKAGE_REGEX.test(message)) {
    throw new Error(`Security Violation: Token or credential leakage detected in output: "${message}"`);
  }
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });

  console.error = (...args: unknown[]) => {
    const formatted = formatArgs(...args);
    verifyNoTokenLeakage(formatted);
    interceptedErrors.push(`[console.error] ${formatted}`);
    originalError(...args);
  };

  console.warn = (...args: unknown[]) => {
    const formatted = formatArgs(...args);
    verifyNoTokenLeakage(formatted);
    if (/act\(\)|hydration|did not match|server-rendered/i.test(formatted)) {
      interceptedErrors.push(`[console.warn violation] ${formatted}`);
    }
    originalWarn(...args);
  };

  console.log = (...args: unknown[]) => {
    const formatted = formatArgs(...args);
    verifyNoTokenLeakage(formatted);
    originalLog(...args);
  };

  console.info = (...args: unknown[]) => {
    const formatted = formatArgs(...args);
    verifyNoTokenLeakage(formatted);
    originalInfo(...args);
  };

  if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

beforeEach(() => {
  interceptedErrors = [];
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  vi.resetAllMocks();
  vi.restoreAllMocks();

  if (interceptedErrors.length > 0) {
    const errors = interceptedErrors.join('\n');
    interceptedErrors = [];
    throw new Error(
      `Test failed due to uncaught console errors, act() warnings, or hydration mismatches:\n${errors}`
    );
  }
});

afterAll(() => {
  server.close();
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
  console.info = originalInfo;
});
