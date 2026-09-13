/**
 * Request ID generation, validation, and correlation utilities.
 *
 * Implements Phase 2 Section 3.1/3.8 (OBS-01):
 * - Validates incoming `X-Request-Id` headers using a bounded safe-character pattern.
 * - Generates standard UUIDv4 identifiers when missing or invalid.
 * - Prevents header injection, CRLF, and log forging.
 */

export const REQUEST_ID_HEADER = 'X-Request-Id' as const;

/**
 * Bounded safe-character pattern for request IDs:
 * Must be 1 to 128 characters containing only alphanumeric chars, hyphens, underscores, or dots.
 */
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_.-]{1,128}$/;

/**
 * Generates a standard UUIDv4 request ID.
 */
export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4 generator if crypto.randomUUID is not available
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Checks whether an unknown value is a valid, safe request ID.
 */
export function isValidRequestId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > 128) return false;
  return REQUEST_ID_PATTERN.test(trimmed);
}

/**
 * Extracts and validates an `X-Request-Id` from request headers.
 * If a valid safe request ID is found, it is returned.
 * Otherwise, a new UUIDv4 is generated and returned.
 */
export function getOrCreateRequestId(
  headers?: Headers | Record<string, string | string[] | undefined> | null
): string {
  if (!headers) {
    return generateRequestId();
  }

  let candidate: string | null | undefined;

  if (typeof (headers as Headers).get === 'function') {
    candidate = (headers as Headers).get('x-request-id') ?? (headers as Headers).get('X-Request-Id');
  } else if (typeof headers === 'object') {
    // Record lookup (case-insensitive for safety)
    const record = headers as Record<string, string | string[] | undefined>;
    for (const [key, value] of Object.entries(record)) {
      if (key.toLowerCase() === 'x-request-id') {
        if (typeof value === 'string') {
          candidate = value;
          break;
        } else if (Array.isArray(value) && value.length === 1 && typeof value[0] === 'string') {
          candidate = value[0];
          break;
        }
      }
    }
  }

  if (candidate && isValidRequestId(candidate)) {
    return candidate.trim();
  }

  return generateRequestId();
}
