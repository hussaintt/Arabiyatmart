import 'server-only';

export type SafeLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface SafeLogInput {
  readonly level: SafeLogLevel;
  readonly operation: string;
  readonly routeTemplate?: string;
  readonly status?: number;
  readonly durationMs?: number;
  readonly requestId?: string;
  readonly userPublicId?: string | null;
  readonly vendorPublicId?: string | null;
  readonly schemaIssuePaths?: readonly string[];
}

export interface SafeLogRecord {
  readonly timestamp: string;
  readonly level: SafeLogLevel;
  readonly environment: string;
  readonly release: string;
  readonly operation: string;
  readonly routeTemplate?: string;
  readonly status?: number;
  readonly durationMs?: number;
  readonly requestId?: string;
  readonly userHash?: string;
  readonly vendorHash?: string;
  readonly schemaIssuePaths?: readonly string[];
}

const SAFE_LABEL = /[^A-Za-z0-9._:/[\]-]/g;
const SAFE_PATH = /[^A-Za-z0-9._[\]-]/g;

function safeLabel(value: string, fallback: string): string {
  const sanitized = value.trim().replace(SAFE_LABEL, '_').slice(0, 160);
  return sanitized || fallback;
}

function safeIssuePaths(paths: readonly string[]): string[] {
  return paths
    .slice(0, 20)
    .map((path) => path.trim().replace(SAFE_PATH, '_').slice(0, 120))
    .filter(Boolean);
}

import { serverEnv } from '@/lib/env/server';

interface NodeCryptoInterface {
  createHmac(algorithm: string, key: string): {
    update(data: string): {
      digest(encoding: string): string;
    };
  };
}

interface ProcessWithBuiltin {
  getBuiltinModule?(moduleName: string): unknown;
}

function computeHmacSha256(key: string, data: string): string | undefined {
  try {
    let cryptoModule: NodeCryptoInterface | undefined;
    const mod = 'node' + ':crypto';
    const proc = (typeof process !== 'undefined' ? process : undefined) as ProcessWithBuiltin | undefined;
    if (proc && typeof proc.getBuiltinModule === 'function') {
      cryptoModule = proc.getBuiltinModule(mod) as NodeCryptoInterface | undefined;
    }
    if (!cryptoModule) {
      const g = globalThis as Record<string, unknown>;
      const r = (g.require ?? ((typeof global !== 'undefined' ? (global as Record<string, unknown>).__non_webpack_require__ : undefined))) as ((name: string) => unknown) | undefined;
      if (typeof r === 'function') {
        try {
          cryptoModule = r(mod) as NodeCryptoInterface;
        } catch {}
      }
    }
    if (cryptoModule && typeof cryptoModule.createHmac === 'function') {
      return cryptoModule.createHmac('sha256', key).update(data).digest('hex').slice(0, 16);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Returns a stable, non-identifying pseudonymized correlation key for an already-opaque public ID
 * using keyed HMAC-SHA-256 with the server session secret.
 * If no secret is configured, returns undefined so no user correlation ID is logged.
 */
export function hashPublicId(
  publicId: string | null | undefined,
  secretKey?: string,
): string | undefined {
  if (!publicId) return undefined;
  const envMap = (typeof serverEnv !== 'undefined' ? serverEnv : undefined) as unknown as
    | Record<string, string | undefined>
    | undefined;
  const key =
    secretKey ??
    process.env.SESSION_SECRET ??
    envMap?.SESSION_SECRET ??
    envMap?.INTERNAL_API_SECRET ??
    envMap?.CSRF_SECRET ??
    process.env.INTERNAL_API_SECRET ??
    process.env.CSRF_SECRET;
  if (!key || key.length < 16) {
    return undefined;
  }
  return computeHmacSha256(key, publicId);
}

/**
 * Builds a log record from an explicit allowlist. Unknown properties are never copied,
 * so bodies, headers, cookies, contacts, free text, secrets, and stack traces cannot leak.
 */
export function createSafeLogRecord(
  input: SafeLogInput,
  runtime: {
    readonly now?: () => Date;
    readonly environment?: string;
    readonly release?: string;
  } = {},
): SafeLogRecord {
  const userHash = hashPublicId(input.userPublicId);
  const vendorHash = hashPublicId(input.vendorPublicId);
  const record: SafeLogRecord = {
    timestamp: (runtime.now?.() ?? new Date()).toISOString(),
    level: input.level,
    environment: safeLabel(runtime.environment ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development', 'development'),
    release: safeLabel(runtime.release ?? process.env.RELEASE ?? 'unreleased', 'unreleased'),
    operation: safeLabel(input.operation, 'unknown_operation'),
    ...(input.routeTemplate ? { routeTemplate: safeLabel(input.routeTemplate, 'unknown_route') } : {}),
    ...(Number.isInteger(input.status) ? { status: input.status } : {}),
    ...(Number.isFinite(input.durationMs) ? { durationMs: Math.max(0, Math.round(input.durationMs ?? 0)) } : {}),
    ...(input.requestId ? { requestId: safeLabel(input.requestId, 'invalid_request_id') } : {}),
    ...(userHash ? { userHash } : {}),
    ...(vendorHash ? { vendorHash } : {}),
    ...(input.schemaIssuePaths?.length ? { schemaIssuePaths: safeIssuePaths(input.schemaIssuePaths) } : {}),
  };
  return record;
}

export function logSafeEvent(input: SafeLogInput): SafeLogRecord {
  const record = createSafeLogRecord(input);
  const line = JSON.stringify(record);
  if (input.level === 'error') console.error(line);
  else if (input.level === 'warn') console.warn(line);
  else console.info(line);
  return record;
}
