import { z } from 'zod';

/**
 * Custom error class for environment validation failures.
 * Guarantees field-specific reporting while strictly forbidding the logging or
 * inclusion of secret/sensitive values.
 */
export class EnvValidationError extends Error {
  public readonly fieldErrors: Record<string, string[]>;

  constructor(issues: Array<{ path: PropertyKey[]; message: string }>) {
    const fieldMap: Record<string, string[]> = {};
    const formattedLines: string[] = [];

    for (const issue of issues) {
      const field = issue.path.join('.') || 'environment';
      if (!fieldMap[field]) {
        fieldMap[field] = [];
      }
      fieldMap[field].push(issue.message);
      formattedLines.push(`  - ${field}: ${issue.message}`);
    }

    const message = `[env] Invalid environment configuration:\n${formattedLines.join('\n')}`;
    super(message);
    this.name = 'EnvValidationError';
    this.fieldErrors = fieldMap;
  }
}

const PLACEHOLDER_REGEX = /change|placeholder|todo|secret|example/i;

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
  }
  return value;
}, z.boolean());

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional()
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().url().optional()
);

export const serverEnvSchema = z
  .object({
    // Deployment & Runtime Flags
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: z.enum(['development', 'test', 'staging', 'production']).optional(),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default('0.0.0.0'),
    MAINTENANCE_MODE: booleanFromEnv.default(false),
    CSP_REPORT_ONLY: booleanFromEnv.default(false),

    // Backend & Site Origins
    SITE_ORIGIN: z.string().url().default('http://localhost:3000'),
    NEXT_PUBLIC_SITE_ORIGIN: z.string().url().default('http://localhost:3000'),
    BACKEND_API_ORIGIN: z.string().url().default('http://localhost:3000'),
    MEDIA_CDN_ORIGIN: optionalUrl,

    // JWT & Session Settings
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must contain at least 32 characters')
      .default('development-jwt-access-secret-32-chars-long-placeholder'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must contain at least 32 characters')
      .optional(),
    JWT_ISSUER: z.string().min(1).default('arabiyatmart-backend'),
    JWT_AUDIENCE: z.string().min(1).default('arabiyatmart-mobile'),
    CSRF_SECRET: z
      .string()
      .min(32, 'CSRF_SECRET must contain at least 32 characters')
      .default('development-csrf-secret-32-chars-minimum-ok'),
    INTERNAL_API_SECRET: z
      .string()
      .min(16, 'INTERNAL_API_SECRET must contain at least 16 characters')
      .optional(),

    // Idempotency Storage
    IDEMPOTENCY_STORAGE_DRIVER: z.enum(['memory', 'redis']).default('memory'),
    REDIS_URL: optionalUrl,
    IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86400),

    // OAuth Settings
    GOOGLE_CLIENT_ID: optionalNonEmptyString,
    APPLE_CLIENT_ID: optionalNonEmptyString,
    APPLE_TEAM_ID: optionalNonEmptyString,
    APPLE_KEY_ID: optionalNonEmptyString,

    // Firebase (Server Credentials)
    FIREBASE_PROJECT_ID: optionalNonEmptyString,
    FIREBASE_CLIENT_EMAIL: optionalNonEmptyString,
    FIREBASE_PRIVATE_KEY: optionalNonEmptyString,
    FIREBASE_SERVICE_ACCOUNT_JSON: optionalNonEmptyString,

    // Observability
    SENTRY_DSN: optionalUrl,
    SENTRY_ENVIRONMENT: optionalNonEmptyString,
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: optionalUrl,
    OTEL_SERVICE_NAME: z.string().min(1).default('yalla-motors-web'),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
    RELEASE: optionalNonEmptyString,
  })
  .superRefine((data, ctx) => {
    // Determine whether this evaluation is under production rules
    const isProduction =
      data.APP_ENV === 'production' ||
      (data.NODE_ENV === 'production' && data.APP_ENV !== 'development' && data.APP_ENV !== 'test');

    if (!isProduction) {
      return;
    }

    // 1. SITE_ORIGIN must use HTTPS in production and cannot be localhost or wildcard
    if (!data.SITE_ORIGIN.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SITE_ORIGIN'],
        message: 'SITE_ORIGIN must use HTTPS in production',
      });
    } else if (data.SITE_ORIGIN.includes('localhost') || data.SITE_ORIGIN.includes('*')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SITE_ORIGIN'],
        message: 'SITE_ORIGIN cannot use localhost or wildcard in production',
      });
    }

    // 2. NEXT_PUBLIC_SITE_ORIGIN must use HTTPS in production
    if (!data.NEXT_PUBLIC_SITE_ORIGIN.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['NEXT_PUBLIC_SITE_ORIGIN'],
        message: 'NEXT_PUBLIC_SITE_ORIGIN must use HTTPS in production',
      });
    }

    // 3. BACKEND_API_ORIGIN must use HTTPS in production
    if (!data.BACKEND_API_ORIGIN.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BACKEND_API_ORIGIN'],
        message: 'BACKEND_API_ORIGIN must use HTTPS in production',
      });
    }

    // 4. MEDIA_CDN_ORIGIN must use HTTPS in production if configured
    if (data.MEDIA_CDN_ORIGIN && !data.MEDIA_CDN_ORIGIN.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MEDIA_CDN_ORIGIN'],
        message: 'MEDIA_CDN_ORIGIN must use HTTPS in production',
      });
    }

    // 5. JWT_ACCESS_SECRET is required and must not be a placeholder in production
    if (
      !data.JWT_ACCESS_SECRET ||
      data.JWT_ACCESS_SECRET === 'development-jwt-access-secret-32-chars-long-placeholder' ||
      PLACEHOLDER_REGEX.test(data.JWT_ACCESS_SECRET)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT_ACCESS_SECRET is required and must not use placeholder values in production',
      });
    }

    // 6. CSRF_SECRET is required and must not be a placeholder in production
    if (
      !data.CSRF_SECRET ||
      data.CSRF_SECRET === 'development-csrf-secret-32-chars-minimum-ok' ||
      PLACEHOLDER_REGEX.test(data.CSRF_SECRET)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CSRF_SECRET'],
        message: 'CSRF_SECRET is required and must not use placeholder values in production',
      });
    }

    // 7. JWT secrets must differ if refresh secret is set
    if (data.JWT_REFRESH_SECRET && data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
      });
    }

    // 8. Idempotency storage driver requirements in production
    if (data.IDEMPOTENCY_STORAGE_DRIVER !== 'redis') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['IDEMPOTENCY_STORAGE_DRIVER'],
        message: 'IDEMPOTENCY_STORAGE_DRIVER must be set to "redis" in production',
      });
    } else if (!data.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required when IDEMPOTENCY_STORAGE_DRIVER=redis',
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type ServerEnvSafeParseResult = ReturnType<typeof serverEnvSchema.safeParse>;

/**
 * Parses and validates environment variables against the server schema.
 * Returns standard Zod SafeParseReturnType.
 */
export function parseServerEnv(
  input: Record<string, string | undefined> = process.env,
  options?: { isProduction?: boolean | undefined }
): ServerEnvSafeParseResult {
  const envToValidate = { ...input };

  if (options?.isProduction !== undefined) {
    if (options.isProduction) {
      envToValidate.NODE_ENV = 'production';
      envToValidate.APP_ENV = 'production';
    } else {
      envToValidate.NODE_ENV = 'development';
      envToValidate.APP_ENV = 'development';
    }
  }

  return serverEnvSchema.safeParse(envToValidate);
}

/**
 * Validates environment variables or throws an EnvValidationError.
 * Guarantees no secret values are leaked in the error message.
 */
export function validateServerEnv(
  input: Record<string, string | undefined> = process.env,
  options?: { isProduction?: boolean | undefined }
): ServerEnv {
  const result = parseServerEnv(input, options);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }
  return result.data;
}
