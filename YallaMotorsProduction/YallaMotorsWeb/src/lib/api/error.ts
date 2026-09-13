/**
 * Error normalization, sanitization, and classification utilities.
 *
 * Implements Phase 1 Section 3.1, Phase 2 Section 3.1, and Section 3.8 (ERR-01, OBS-01):
 * - Normalizes any non-2xx HTTP response or upstream error into a strict OperationError.
 * - Enforces the 12 standard HttpStatus codes (400, 401, 403, 404, 409, 413, 422, 429, 500, 502, 503, 504).
 * - Maps RFC status codes (e.g., 415 to 422).
 * - Parses bounded Retry-After headers from integer seconds or HTTP-dates.
 * - Strips stack traces, SQL queries, internal filesystem paths, tokens/passwords, and storage details.
 * - Replaces HTML error pages with safe, structured error responses.
 */

import type {
  FieldError,
  HttpStatus,
  JsonValue,
  OperationError,
} from '@/types/common';
import {
  OperationErrorSchema,
  ApiContractError,
  FieldErrorSchema,
} from '@/lib/api/schemas/common';
import {
  isValidRequestId,
  generateRequestId,
} from '@/lib/api/request-id';

export { ApiContractError };

const VALID_HTTP_STATUSES: ReadonlySet<number> = new Set([
  400, 401, 403, 404, 409, 413, 422, 429, 500, 502, 503, 504,
]);

export const DEFAULT_STATUS_MESSAGES: Record<HttpStatus, string> = {
  400: 'Bad request',
  401: 'Authentication required',
  403: 'Access forbidden',
  404: 'Resource not found',
  409: 'Conflict',
  413: 'Payload too large',
  422: 'Validation failed',
  429: 'Too many requests',
  500: 'Internal server error',
  502: 'Bad gateway',
  503: 'Service unavailable',
  504: 'Gateway timeout',
};

export const DEFAULT_STATUS_CODES: Record<HttpStatus, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

// Patterns representing sensitive information that MUST be redacted
const SENSITIVE_PATTERNS = [
  // SQL syntax, queries, table references, and database engine names
  /(?:SELECT\s+[\s\S]+?\s+FROM|INSERT\s+INTO|UPDATE\s+[\s\S]+?\s+SET|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE|CREATE\s+TABLE|PRAGMA)/i,
  /(?:syntax error at or near|relation\s+"[^"]+"\s+does not exist|column\s+"[^"]+"\s+does not exist|pg_catalog|sqlite_|prisma|fastify)/i,
  // Stack trace lines
  /(?:^\s*at\s+[\w.<>$]+(?:\s+\([^)]+\))?|Error:\s+.*\n\s+at\s+)/m,
  // Absolute file system paths (Unix, Windows, and node_modules)
  /(?:(?:\/|\b[A-Za-z]:\\)[^\s"':;,>]+\/[^\s"':;,>]+|\bnode_modules\/)/,
  // Bearer tokens and JSON Web Tokens
  /Bearer\s+[a-zA-Z0-9._~+/-]+=*/i,
  /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]*/,
  // Cloud storage keys or URLs
  /(?:s3:\/\/|gs:\/\/|storage\.googleapis\.com|blob\.core\.windows\.net)/i,
];

// Keys in objects that MUST be completely stripped
const SENSITIVE_KEY_PATTERN = /^(?:stack|sql|query|path|filepath|storagekey|token|secret|password|accesstoken|refreshtoken|cookie|authorization|apikey)$/i;

/**
 * Checks if a string contains any sensitive pattern or HTML tags.
 */
function containsSensitivePattern(str: string): boolean {
  if (/<(?:!DOCTYPE|html|head|body|div|p|script)[\s>]/i.test(str)) {
    return true;
  }
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(str));
}

/**
 * Recursively sanitizes details object to remove stack traces, SQL, file paths, and credentials.
 */
export function sanitizeDetails(value: unknown): JsonValue | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    if (containsSensitivePattern(value)) {
      return '[REDACTED]';
    }
    return value;
  }

  if (Array.isArray(value)) {
    const sanitizedArray = value
      .map((item) => sanitizeDetails(item))
      .filter((item): item is JsonValue => item !== undefined);
    return sanitizedArray;
  }

  if (typeof value === 'object') {
    const sanitizedRecord: Record<string, JsonValue> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        continue; // Strip key entirely
      }
      const sanitizedVal = sanitizeDetails(val);
      if (sanitizedVal !== null && sanitizedVal !== undefined) {
        sanitizedRecord[key] = sanitizedVal;
      }
    }
    return Object.keys(sanitizedRecord).length > 0 ? sanitizedRecord : null;
  }

  return null;
}

/**
 * Maps raw HTTP status codes to the 12 permitted HttpStatus codes.
 */
export function mapToHttpStatus(rawStatus: unknown): HttpStatus {
  if (typeof rawStatus === 'number' && Number.isInteger(rawStatus)) {
    if (VALID_HTTP_STATUSES.has(rawStatus)) {
      return rawStatus as HttpStatus;
    }
    // Specific standard mappings
    if (rawStatus === 415) return 422; // 415-as-422
    if (rawStatus === 408) return 504; // Request Timeout mapped to Gateway Timeout
    if (rawStatus >= 400 && rawStatus < 500) return 400; // General 4xx fallback
    if (rawStatus >= 500 && rawStatus < 600) return 502; // General 5xx fallback (upstream failure)
  }
  return 500;
}

/**
 * Parses and bounds the Retry-After header.
 * Supports integer seconds or HTTP-date format, capped at 86400 (24h).
 */
export function parseRetryAfter(headerValue: string | null | undefined): number | null {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const trimmed = headerValue.trim();
  if (!trimmed) return null;

  // Reject negative numbers or values starting with -
  if (trimmed.startsWith('-')) {
    return null;
  }

  // Try non-negative integer seconds
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(seconds) && seconds >= 0) {
      return Math.min(seconds, 86400);
    }
  }

  // Try HTTP-date format (must contain alphabetic month/day e.g. "GMT")
  if (/[a-zA-Z]{3}/.test(trimmed)) {
    const timestamp = Date.parse(trimmed);
    if (!Number.isNaN(timestamp)) {
      const diffSeconds = Math.ceil((timestamp - Date.now()) / 1000);
      return Math.max(0, Math.min(diffSeconds, 86400));
    }
  }

  return null;
}

export interface CreateOperationErrorParams {
  status: HttpStatus;
  code?: string | undefined;
  message?: string | undefined;
  requestId?: string | undefined;
  fieldErrors?: FieldError[] | undefined;
  details?: JsonValue | null | undefined;
  retryAfterSeconds?: number | null | undefined;
}

/**
 * Creates a validated OperationError object.
 */
export function createOperationError(params: CreateOperationErrorParams): OperationError {
  const status = mapToHttpStatus(params.status);
  const code =
    params.code && /^[A-Z0-9_-]{2,64}$/i.test(params.code.trim())
      ? params.code.trim().toUpperCase()
      : DEFAULT_STATUS_CODES[status];

  let message = params.message?.trim();
  if (!message || containsSensitivePattern(message)) {
    message = DEFAULT_STATUS_MESSAGES[status];
  }

  const requestId =
    params.requestId && isValidRequestId(params.requestId)
      ? params.requestId
      : generateRequestId();

  const fieldErrors: FieldError[] = [];
  if (Array.isArray(params.fieldErrors)) {
    for (const fe of params.fieldErrors) {
      try {
        const safeMessage = containsSensitivePattern(fe.message)
          ? 'Invalid value'
          : fe.message;
        const parsed = FieldErrorSchema.parse({
          field: fe.field,
          code: fe.code,
          message: safeMessage,
        });
        fieldErrors.push(parsed);
      } catch {
        // Skip malformed field errors
      }
    }
  }

  const sanitizedDetails = sanitizeDetails(params.details);

  const errorBody: OperationError = {
    error: {
      status,
      code,
      message,
      requestId,
      fieldErrors,
      details: sanitizedDetails,
      retryAfterSeconds: params.retryAfterSeconds ?? null,
    },
  };

  return OperationErrorSchema.parse(errorBody);
}

/**
 * Normalizes any non-2xx HTTP Response, Error, or raw upstream object into
 * an OperationError satisfying ERR-01 and OBS-01.
 */
export async function normalizeOperationError(
  response: Response | unknown,
  fallbackRequestId?: string
): Promise<OperationError> {
  let rawStatus: unknown;
  let retryAfterHeader: string | null = null;
  let responseRequestId: string | null = null;
  let rawBody: unknown;

  if (typeof Response !== 'undefined' && response instanceof Response) {
    rawStatus = response.status;
    retryAfterHeader = response.headers.get('retry-after');
    responseRequestId =
      response.headers.get('x-request-id') ??
      response.headers.get('X-Request-Id');

    const contentType = response.headers.get('content-type') ?? '';
    try {
      if (contentType.includes('application/json')) {
        rawBody = await response.json();
      } else {
        const text = await response.text();
        try {
          rawBody = JSON.parse(text);
        } catch {
          rawBody = { message: text };
        }
      }
    } catch {
      rawBody = null;
    }
  } else if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    rawStatus = obj.status ?? obj.statusCode;
    rawBody = obj;
  }

  const status = mapToHttpStatus(rawStatus);
  const retryAfterSeconds = parseRetryAfter(retryAfterHeader);

  // Determine correlation request ID:
  // 1. Valid ID from response headers
  // 2. Valid ID from response body
  // 3. Valid fallback request ID from caller
  // 4. Fresh UUID
  let requestIdCandidate: string | null = null;
  if (responseRequestId && isValidRequestId(responseRequestId)) {
    requestIdCandidate = responseRequestId;
  } else if (
    rawBody &&
    typeof rawBody === 'object' &&
    'requestId' in rawBody &&
    isValidRequestId((rawBody as Record<string, unknown>).requestId)
  ) {
    requestIdCandidate = (rawBody as Record<string, unknown>).requestId as string;
  } else if (
    rawBody &&
    typeof rawBody === 'object' &&
    'error' in rawBody &&
    (rawBody as Record<string, unknown>).error &&
    typeof (rawBody as Record<string, unknown>).error === 'object' &&
    'requestId' in ((rawBody as Record<string, unknown>).error as Record<string, unknown>) &&
    isValidRequestId(((rawBody as Record<string, unknown>).error as Record<string, unknown>).requestId)
  ) {
    requestIdCandidate = ((rawBody as Record<string, unknown>).error as Record<string, unknown>).requestId as string;
  } else if (fallbackRequestId && isValidRequestId(fallbackRequestId)) {
    requestIdCandidate = fallbackRequestId;
  }

  const requestId = requestIdCandidate ?? generateRequestId();

  // Extract error code, message, fieldErrors, details from rawBody
  let code: string | undefined;
  let message: string | undefined;
  const fieldErrors: FieldError[] = [];
  let details: unknown = null;

  if (rawBody && typeof rawBody === 'object') {
    const bodyRecord = rawBody as Record<string, unknown>;
    const errorContainer =
      bodyRecord.error && typeof bodyRecord.error === 'object'
        ? (bodyRecord.error as Record<string, unknown>)
        : bodyRecord;

    if (typeof errorContainer.code === 'string') {
      code = errorContainer.code;
    }

    if (typeof errorContainer.message === 'string') {
      message = errorContainer.message;
    }

    // Fastify/Ajv validation error mapping
    if (Array.isArray(errorContainer.validation)) {
      for (const v of errorContainer.validation as Array<Record<string, unknown>>) {
        const field =
          typeof v.instancePath === 'string'
            ? v.instancePath.replace(/^\//, '').replace(/\//g, '.')
            : String(v.params && typeof v.params === 'object' && 'missingProperty' in v.params ? v.params.missingProperty : 'unknown');
        const errCode = typeof v.keyword === 'string' ? v.keyword : 'invalid';
        const errMessage = typeof v.message === 'string' ? v.message : 'Invalid value';
        fieldErrors.push({
          field,
          code: errCode,
          message: containsSensitivePattern(errMessage) ? 'Invalid value' : errMessage,
        });
      }
    } else if (Array.isArray(errorContainer.fieldErrors)) {
      for (const fe of errorContainer.fieldErrors as Array<Record<string, unknown>>) {
        if (typeof fe.field === 'string' && typeof fe.code === 'string' && typeof fe.message === 'string') {
          fieldErrors.push({
            field: fe.field,
            code: fe.code,
            message: containsSensitivePattern(fe.message) ? 'Invalid value' : fe.message,
          });
        }
      }
    }

    if (errorContainer.details !== undefined) {
      details = errorContainer.details;
    }
  }

  return createOperationError({
    status,
    code,
    message,
    requestId,
    fieldErrors,
    details: details as JsonValue | null,
    retryAfterSeconds,
  });
}
