import { z } from 'zod';

export class ClientEnvError extends Error {
  constructor(message: string) {
    super(`[client-env] ${message}`);
    this.name = 'ClientEnvError';
  }
}

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional()
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().url().optional()
);

export const clientEnvSchema = z
  .object({
    NEXT_PUBLIC_SITE_ORIGIN: z.string().url().default('http://localhost:3000'),
    NEXT_PUBLIC_API_BASE_URL: optionalUrl,
    NEXT_PUBLIC_MEDIA_CDN_ORIGIN: optionalUrl,
    NEXT_PUBLIC_APP_ENV: z
      .enum(['development', 'test', 'staging', 'production'])
      .default('development'),

    // Public OAuth Configuration
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: optionalNonEmptyString,
    NEXT_PUBLIC_APPLE_CLIENT_ID: optionalNonEmptyString,

    // Public Firebase Web Client Configuration
    NEXT_PUBLIC_FIREBASE_API_KEY: optionalNonEmptyString,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: optionalNonEmptyString,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: optionalNonEmptyString,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: optionalNonEmptyString,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: optionalNonEmptyString,
    NEXT_PUBLIC_FIREBASE_APP_ID: optionalNonEmptyString,
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: optionalNonEmptyString,
  })
  .superRefine((data, ctx) => {
    const isProduction =
      data.NEXT_PUBLIC_APP_ENV === 'production' ||
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');

    if (isProduction) {
      if (!data.NEXT_PUBLIC_SITE_ORIGIN.startsWith('https://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['NEXT_PUBLIC_SITE_ORIGIN'],
          message: 'NEXT_PUBLIC_SITE_ORIGIN must use HTTPS in production',
        });
      }
      if (
        data.NEXT_PUBLIC_SITE_ORIGIN.includes('localhost') ||
        data.NEXT_PUBLIC_SITE_ORIGIN.includes('*')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['NEXT_PUBLIC_SITE_ORIGIN'],
          message: 'NEXT_PUBLIC_SITE_ORIGIN cannot use localhost or wildcard in production',
        });
      }
      if (
        data.NEXT_PUBLIC_API_BASE_URL &&
        !data.NEXT_PUBLIC_API_BASE_URL.startsWith('https://')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['NEXT_PUBLIC_API_BASE_URL'],
          message: 'NEXT_PUBLIC_API_BASE_URL must use HTTPS in production',
        });
      }
      if (
        data.NEXT_PUBLIC_MEDIA_CDN_ORIGIN &&
        !data.NEXT_PUBLIC_MEDIA_CDN_ORIGIN.startsWith('https://')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['NEXT_PUBLIC_MEDIA_CDN_ORIGIN'],
          message: 'NEXT_PUBLIC_MEDIA_CDN_ORIGIN must use HTTPS in production',
        });
      }
    }
  });

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export type ClientEnvSafeParseResult = ReturnType<typeof clientEnvSchema.safeParse>;

/**
 * Returns explicit static literal references for documented public variables.
 * Next.js replaces these literal process.env.NEXT_PUBLIC_* references at compile time.
 */
function getLiteralPublicConfig(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SITE_ORIGIN:
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SITE_ORIGIN : undefined,
    NEXT_PUBLIC_API_BASE_URL:
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_BASE_URL : undefined,
    NEXT_PUBLIC_MEDIA_CDN_ORIGIN:
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_MEDIA_CDN_ORIGIN : undefined,
    NEXT_PUBLIC_APP_ENV:
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_APP_ENV : undefined,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID:
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID : undefined,
    NEXT_PUBLIC_APPLE_CLIENT_ID:
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_APPLE_CLIENT_ID : undefined,
    NEXT_PUBLIC_FIREBASE_API_KEY:
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_API_KEY : undefined,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN : undefined,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID:
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID : undefined,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET : undefined,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID : undefined,
    NEXT_PUBLIC_FIREBASE_APP_ID:
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_APP_ID : undefined,
    NEXT_PUBLIC_FIREBASE_VAPID_KEY:
      typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY : undefined,
  };
}

/**
 * Extracts and parses only the documented NEXT_PUBLIC_* variables.
 * If input is provided, filters to NEXT_PUBLIC_* keys; otherwise uses static literal references.
 */
export function parseClientEnv(
  input?: Record<string, string | undefined>
): ClientEnvSafeParseResult {
  const source = input ?? getLiteralPublicConfig();
  const publicVars: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith('NEXT_PUBLIC_')) {
      publicVars[key] = value;
    }
  }

  return clientEnvSchema.safeParse(publicVars);
}

/**
 * Validates client environment variables or throws ClientEnvError.
 */
export function validateClientEnv(
  input?: Record<string, string | undefined>
): ClientEnv {
  const result = parseClientEnv(input);
  if (!result.success) {
    const messages = result.error.issues.map(
      (i: { path: PropertyKey[]; message: string }) => `  - ${i.path.join('.')}: ${i.message}`
    );
    throw new ClientEnvError(`Invalid client environment configuration:\n${messages.join('\n')}`);
  }
  return result.data;
}

function wrapInForbiddenAccessProxy(targetData: ClientEnv): ClientEnv {
  return new Proxy(targetData, {
    get(target, prop, receiver) {
      if (typeof prop === 'string') {
        if (!prop.startsWith('NEXT_PUBLIC_')) {
          throw new ClientEnvError(
            `Security Violation: Client attempted to access forbidden property "${prop}". Only documented NEXT_PUBLIC_* variables are permitted.`
          );
        }
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Safe client environment accessor.
 * Exposes ONLY documented NEXT_PUBLIC_* variables.
 * Forbids client code from accessing any non-public or secret properties.
 *
 * Safe defaults apply ONLY to genuine development. If invalid public configuration
 * is provided in a production environment (NEXT_PUBLIC_APP_ENV=production, APP_ENV=production,
 * or NODE_ENV=production), it throws a redacted field-specific ClientEnvError instead of falling back.
 */
export function createSafeClientEnv(
  input?: Record<string, string | undefined>
): ClientEnv {
  const literalConfig = input ?? getLiteralPublicConfig();
  const rawParsed = parseClientEnv(literalConfig);

  if (rawParsed.success) {
    return wrapInForbiddenAccessProxy(rawParsed.data);
  }

  // Determine if this environment is configured for or running in production
  const isProduction =
    literalConfig.NEXT_PUBLIC_APP_ENV === 'production' ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');

  if (isProduction) {
    const messages = rawParsed.error.issues.map(
      (i: { path: PropertyKey[]; message: string }) => `  - ${i.path.join('.')}: ${i.message}`
    );
    throw new ClientEnvError(
      `Invalid production client environment configuration:\n${messages.join('\n')}`
    );
  }

  // Safe defaults apply only to genuine development when non-production config is malformed
  const safeData: ClientEnv = {
    NEXT_PUBLIC_SITE_ORIGIN: 'http://localhost:3000',
    NEXT_PUBLIC_APP_ENV: 'development',
  };

  return wrapInForbiddenAccessProxy(safeData);
}

export const clientEnv: ClientEnv = createSafeClientEnv();
