import 'server-only';
import {
  parseServerEnv,
  validateServerEnv,
  type ServerEnv,
} from './schema';

export * from './schema';

/**
 * Validated server environment object.
 * Marked server-only; importing into client modules triggers build/lint failure.
 */
export const serverEnv: ServerEnv = (() => {
  const isProduction =
    typeof process !== 'undefined' && process.env?.APP_ENV === 'production';

  if (isProduction) {
    return validateServerEnv(process.env, { isProduction: true });
  }

  // In non-production/test environments, validate current environment variables.
  // If parsing fails under test/development conditions, return a genuinely validated
  // baseline development configuration rather than an incomplete or unsafe empty cast.
  const devParsed = parseServerEnv(process.env, { isProduction: false });
  if (devParsed.success) {
    return devParsed.data;
  }

  return validateServerEnv({}, { isProduction: false });
})();

export const env = serverEnv;
