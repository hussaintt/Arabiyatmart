import { describe, it, expect, vi } from 'vitest';

// Mock server-only so the Node test runner can import server.ts without throwing
vi.mock('server-only', () => ({}));

import {
  parseServerEnv,
  validateServerEnv,
  EnvValidationError,
} from '@/lib/env/server';
import {
  parseClientEnv,
  validateClientEnv,
  clientEnv,
  createSafeClientEnv,
  ClientEnvError,
} from '@/lib/env/client';

describe('Environment Configuration Suite', () => {
  const validProdEnv: Record<string, string> = {
    NODE_ENV: 'production',
    APP_ENV: 'production',
    SITE_ORIGIN: 'https://arabiyatmart.com',
    NEXT_PUBLIC_SITE_ORIGIN: 'https://arabiyatmart.com',
    BACKEND_API_ORIGIN: 'https://api.arabiyatmart.com',
    JWT_ACCESS_SECRET: '32-characters-minimum-production-access-token-key-ok',
    JWT_REFRESH_SECRET: '32-characters-minimum-production-refresh-token-key-diff',
    CSRF_SECRET: '32-characters-minimum-production-csrf-token-hmac-key-ok',
    IDEMPOTENCY_STORAGE_DRIVER: 'redis',
    REDIS_URL: 'redis://127.0.0.1:6379',
  };

  describe('Server Environment Validation', () => {
    it('accepts valid development environment with default fallbacks', () => {
      const result = parseServerEnv({
        NODE_ENV: 'development',
        APP_ENV: 'development',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.SITE_ORIGIN).toBe('http://localhost:3000');
        expect(result.data.BACKEND_API_ORIGIN).toBe('http://localhost:3000');
        expect(result.data.PORT).toBe(3000);
        expect(result.data.IDEMPOTENCY_STORAGE_DRIVER).toBe('memory');
        expect(result.data.MAINTENANCE_MODE).toBe(false);
      }
    });

    it('accepts complete and strictly valid production environment', () => {
      const result = parseServerEnv(validProdEnv);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.SITE_ORIGIN).toBe('https://arabiyatmart.com');
        expect(result.data.NEXT_PUBLIC_SITE_ORIGIN).toBe('https://arabiyatmart.com');
        expect(result.data.BACKEND_API_ORIGIN).toBe('https://api.arabiyatmart.com');
        expect(result.data.JWT_ACCESS_SECRET).toBe(
          '32-characters-minimum-production-access-token-key-ok'
        );
      }
    });

    // Acceptance Criteria (Strict BDD):
    // GIVEN: A production build missing a required secret or using a non-HTTPS public origin
    // WHEN: Environment validation initializes
    // THEN: Build fails with a field-specific error and never logs the secret value
    describe('Acceptance Criteria (Strict BDD)', () => {
      it('fails with a field-specific error when a required secret is missing in production', () => {
        const invalidEnv = { ...validProdEnv };
        delete invalidEnv.JWT_ACCESS_SECRET;

        expect(() => validateServerEnv(invalidEnv)).toThrow(EnvValidationError);

        try {
          validateServerEnv(invalidEnv);
        } catch (error) {
          expect(error).toBeInstanceOf(EnvValidationError);
          const envErr = error as EnvValidationError;
          expect(envErr.fieldErrors.JWT_ACCESS_SECRET).toBeDefined();
          expect(envErr.message).toContain('JWT_ACCESS_SECRET');
        }
      });

      it('fails with a field-specific error when using a non-HTTPS public origin in production', () => {
        const invalidEnv = {
          ...validProdEnv,
          SITE_ORIGIN: 'http://arabiyatmart.com',
        };

        expect(() => validateServerEnv(invalidEnv)).toThrow(EnvValidationError);

        try {
          validateServerEnv(invalidEnv);
        } catch (error) {
          expect(error).toBeInstanceOf(EnvValidationError);
          const envErr = error as EnvValidationError;
          expect(envErr.fieldErrors.SITE_ORIGIN).toBeDefined();
          expect(envErr.message).toContain('SITE_ORIGIN must use HTTPS in production');
        }
      });

      it('fails with a field-specific error when NEXT_PUBLIC_SITE_ORIGIN uses non-HTTPS in production', () => {
        const invalidEnv = {
          ...validProdEnv,
          NEXT_PUBLIC_SITE_ORIGIN: 'http://arabiyatmart.com',
        };

        expect(() => validateServerEnv(invalidEnv)).toThrow(EnvValidationError);

        try {
          validateServerEnv(invalidEnv);
        } catch (error) {
          expect(error).toBeInstanceOf(EnvValidationError);
          const envErr = error as EnvValidationError;
          expect(envErr.fieldErrors.NEXT_PUBLIC_SITE_ORIGIN).toBeDefined();
          expect(envErr.message).toContain('NEXT_PUBLIC_SITE_ORIGIN must use HTTPS in production');
        }
      });

      it('never logs or leaks sensitive secret values in validation error messages', () => {
        const CANARY_SECRET = 'CANARY_UNSAFE_SECRET_VALUE_DO_NOT_LEAK_INTO_OUTPUT_12345';
        const invalidEnv = {
          ...validProdEnv,
          JWT_ACCESS_SECRET: CANARY_SECRET, // Too short or containing placeholder
        };

        try {
          validateServerEnv(invalidEnv);
          expect.unreachable('Should have thrown an EnvValidationError');
        } catch (error) {
          expect(error).toBeInstanceOf(EnvValidationError);
          const message = (error as Error).message;
          expect(message).not.toContain(CANARY_SECRET);
        }
      });
    });

    describe('Security Edge Cases and Refinements', () => {
      it('enforces production rules when NODE_ENV is production and APP_ENV is absent', () => {
        // Regression test: absent APP_ENV must not default to development and bypass production rules
        const result = parseServerEnv({
          NODE_ENV: 'production',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const issues = result.error.issues.map((i: { path: PropertyKey[] }) => i.path.join('.'));
          expect(issues).toContain('SITE_ORIGIN');
          expect(issues).toContain('JWT_ACCESS_SECRET');
          expect(issues).toContain('CSRF_SECRET');
        }
      });

      it('rejects placeholder secrets in production', () => {
        const placeholderEnv = {
          ...validProdEnv,
          JWT_ACCESS_SECRET: 'my-super-secret-placeholder-key-32-chars-long',
        };

        const result = parseServerEnv(placeholderEnv);
        expect(result.success).toBe(false);
        if (!result.success) {
          const jwtIssue = result.error.issues.find(
            (i: { path: PropertyKey[]; message: string }) => i.path.includes('JWT_ACCESS_SECRET')
          );
          expect(jwtIssue).toBeDefined();
          expect(jwtIssue?.message).toContain('must not use placeholder values in production');
        }
      });

      it('rejects IDEMPOTENCY_STORAGE_DRIVER=memory in production', () => {
        const memoryProdEnv = {
          ...validProdEnv,
          IDEMPOTENCY_STORAGE_DRIVER: 'memory',
        };

        const result = parseServerEnv(memoryProdEnv);
        expect(result.success).toBe(false);
        if (!result.success) {
          const issue = result.error.issues.find(
            (i: { path: PropertyKey[]; message: string }) => i.path.includes('IDEMPOTENCY_STORAGE_DRIVER')
          );
          expect(issue).toBeDefined();
          expect(issue?.message).toContain('IDEMPOTENCY_STORAGE_DRIVER must be set to "redis" in production');
        }
      });

      it('requires REDIS_URL when IDEMPOTENCY_STORAGE_DRIVER is redis in production', () => {
        const redisEnv = {
          ...validProdEnv,
          IDEMPOTENCY_STORAGE_DRIVER: 'redis',
        };
        delete (redisEnv as Record<string, unknown>).REDIS_URL;

        const result = parseServerEnv(redisEnv);
        expect(result.success).toBe(false);
        if (!result.success) {
          const redisIssue = result.error.issues.find(
            (i: { path: PropertyKey[]; message: string }) => i.path.includes('REDIS_URL')
          );
          expect(redisIssue).toBeDefined();
          expect(redisIssue?.message).toContain('REDIS_URL is required when IDEMPOTENCY_STORAGE_DRIVER=redis');
        }
      });

      it('rejects identical JWT access and refresh secrets in production', () => {
        const sameKey = 'identical-key-value-for-both-tokens-32-chars-long';
        const duplicateSecretEnv = {
          ...validProdEnv,
          JWT_ACCESS_SECRET: sameKey,
          JWT_REFRESH_SECRET: sameKey,
        };

        const result = parseServerEnv(duplicateSecretEnv);
        expect(result.success).toBe(false);
        if (!result.success) {
          const issue = result.error.issues.find(
            (i: { path: PropertyKey[]; message: string }) => i.path.includes('JWT_REFRESH_SECRET')
          );
          expect(issue).toBeDefined();
          expect(issue?.message).toContain('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
        }
      });

      it('validates malformed URLs and ports correctly', () => {
        const malformedEnv = {
          ...validProdEnv,
          SITE_ORIGIN: 'not-a-valid-url',
          PORT: 'not-a-port',
        };

        const result = parseServerEnv(malformedEnv);
        expect(result.success).toBe(false);
        if (!result.success) {
          const siteIssue = result.error.issues.find(
            (i: { path: PropertyKey[]; message: string }) => i.path.includes('SITE_ORIGIN')
          );
          const portIssue = result.error.issues.find(
            (i: { path: PropertyKey[]; message: string }) => i.path.includes('PORT')
          );
          expect(siteIssue).toBeDefined();
          expect(portIssue).toBeDefined();
        }
      });
    });
  });

  describe('Client Environment Validation', () => {
    it('allows documented NEXT_PUBLIC_* variables and uses safe fallbacks', () => {
      const clientConfig = validateClientEnv({
        NEXT_PUBLIC_SITE_ORIGIN: 'https://arabiyatmart.com',
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'arabiyatmart-prod',
        NEXT_PUBLIC_APP_ENV: 'production',
      });

      expect(clientConfig.NEXT_PUBLIC_SITE_ORIGIN).toBe('https://arabiyatmart.com');
      expect(clientConfig.NEXT_PUBLIC_FIREBASE_PROJECT_ID).toBe('arabiyatmart-prod');
      expect(clientConfig.NEXT_PUBLIC_APP_ENV).toBe('production');
    });

    it('filters out non-NEXT_PUBLIC variables during client parsing', () => {
      const result = parseClientEnv({
        NEXT_PUBLIC_SITE_ORIGIN: 'https://arabiyatmart.com',
        JWT_ACCESS_SECRET: 'do-not-expose-this-to-client',
        DATABASE_URL: 'postgresql://private:secret@db:5432/arabiyatmart',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect('JWT_ACCESS_SECRET' in result.data).toBe(false);
        expect('DATABASE_URL' in result.data).toBe(false);
      }
    });

    it('forbids client code from accessing backend secrets or non-public properties on clientEnv', () => {
      const forbiddenSecrets = [
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
        'CSRF_SECRET',
        'INTERNAL_API_SECRET',
        'DATABASE_URL',
        'REDIS_URL',
        'S3_SECRET_ACCESS_KEY',
        'ADMIN_PASSWORD',
      ] as const;

      const clientRecord: Record<string, unknown> = clientEnv;
      for (const secretKey of forbiddenSecrets) {
        expect(() => {
          return clientRecord[secretKey];
        }).toThrow(ClientEnvError);
      }
    });

    it('enforces HTTPS for NEXT_PUBLIC_SITE_ORIGIN when in production', () => {
      expect(() => {
        validateClientEnv({
          NEXT_PUBLIC_SITE_ORIGIN: 'http://insecure-site.com',
          NEXT_PUBLIC_APP_ENV: 'production',
        });
      }).toThrow(ClientEnvError);
    });

    it('throws redacted ClientEnvError for invalid production client config instead of defaulting to dev', () => {
      // Regression: NEXT_PUBLIC_APP_ENV=production + NEXT_PUBLIC_SITE_ORIGIN=http://insecure.example
      // must throw ClientEnvError with field-specific redacted message, NOT silently return localhost defaults.
      expect(() => {
        createSafeClientEnv({
          NEXT_PUBLIC_APP_ENV: 'production',
          NEXT_PUBLIC_SITE_ORIGIN: 'http://insecure.example',
        });
      }).toThrow(ClientEnvError);

      try {
        createSafeClientEnv({
          NEXT_PUBLIC_APP_ENV: 'production',
          NEXT_PUBLIC_SITE_ORIGIN: 'http://insecure.example',
        });
      } catch (err) {
        expect(err).toBeInstanceOf(ClientEnvError);
        const msg = (err as Error).message;
        expect(msg).toContain('NEXT_PUBLIC_SITE_ORIGIN');
        expect(msg).toContain('must use HTTPS in production');
        // Redaction guarantee: sensitive tokens or values are never displayed
        expect(msg).not.toContain('http://insecure.example');
      }
    });

    it('applies safe defaults only in genuine development when non-production config is malformed', () => {
      const devEnv = createSafeClientEnv({
        NEXT_PUBLIC_APP_ENV: 'development',
        NEXT_PUBLIC_SITE_ORIGIN: 'not-a-valid-url',
      });

      expect(devEnv.NEXT_PUBLIC_APP_ENV).toBe('development');
      expect(devEnv.NEXT_PUBLIC_SITE_ORIGIN).toBe('http://localhost:3000');
    });
  });

  describe('Server-only Boundary Enforcement', () => {
    it('verifies that server-only package is installed and throws for client contexts', async () => {
      // In a client component bundle, importing server-only throws:
      // "This module cannot be imported from a Client Component module."
      const fs = await import('node:fs');
      const path = await import('node:path');
      const serverOnlyIndexPath = path.resolve(
        process.cwd(),
        'node_modules/server-only/index.js'
      );
      expect(fs.existsSync(serverOnlyIndexPath)).toBe(true);
      const content = fs.readFileSync(serverOnlyIndexPath, 'utf-8');
      expect(content).toContain('This module cannot be imported from a Client Component module');
    });

    it('verifies that server.ts declares static server-only boundary marker', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const serverFilePath = path.resolve(process.cwd(), 'src/lib/env/server.ts');
      expect(fs.existsSync(serverFilePath)).toBe(true);
      const content = fs.readFileSync(serverFilePath, 'utf-8');
      expect(content).toMatch(/^import 'server-only';/m);
    });

    it('fails the build when a Client Component imports server.ts', async () => {
      const fs = await import('node:fs');
      const os = await import('node:os');
      const path = await import('node:path');
      const { spawnSync } = await import('node:child_process');

      // Create an isolated temporary fixture outside the repository
      const projectRoot = process.cwd();
      const serverFilePath = path.resolve(projectRoot, 'src/lib/env/server.ts');
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'client-boundary-test-'));

      try {
        // Link node_modules so Next.js runtime is accessible in isolated fixture
        fs.symlinkSync(
          path.join(projectRoot, 'node_modules'),
          path.join(tmpDir, 'node_modules'),
          'junction'
        );

        fs.writeFileSync(
          path.join(tmpDir, 'package.json'),
          JSON.stringify({ name: 'boundary-test', private: true })
        );

        fs.writeFileSync(
          path.join(tmpDir, 'next.config.js'),
          'module.exports = { reactStrictMode: true };'
        );

        const appDir = path.join(tmpDir, 'app');
        fs.mkdirSync(appDir, { recursive: true });

        fs.writeFileSync(
          path.join(appDir, 'layout.tsx'),
          'export default function RootLayout({ children }: { children: React.ReactNode }) { return <html><body>{children}</body></html>; }'
        );

        fs.writeFileSync(
          path.join(appDir, 'page.tsx'),
          `"use client";
import { serverEnv } from ${JSON.stringify(serverFilePath)};

export default function ClientBoundaryTestPage() {
  return <div>{serverEnv.PORT}</div>;
}
`
        );

        const nextBin = path.join(projectRoot, 'node_modules', '.bin', 'next');
        const res = spawnSync(nextBin, ['build', '--no-lint'], {
          cwd: tmpDir,
          encoding: 'utf-8',
        });

        expect(res.status).not.toBe(0);
        const combined = `${res.stdout}\n${res.stderr}`;
        expect(combined).toMatch(/server-only/);
        expect(combined).toMatch(
          /You're importing a component that needs "server-only"|This module cannot be imported from a Client Component module/
        );
      } finally {
        if (fs.existsSync(tmpDir)) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      }
    }, 30000);
  });

  describe('Build Acceptance Gate', () => {
    it('fails the production build when APP_ENV=production is missing required secrets or non-HTTPS', async () => {
      const { spawnSync } = await import('node:child_process');
      const res = spawnSync('npm', ['run', 'build'], {
        env: {
          ...process.env,
          APP_ENV: 'production',
          JWT_ACCESS_SECRET: '',
          JWT_REFRESH_SECRET: '',
          CSRF_SECRET: '',
          SITE_ORIGIN: '',
          NEXT_PUBLIC_SITE_ORIGIN: '',
          BACKEND_API_ORIGIN: '',
        },
        encoding: 'utf-8',
        cwd: process.cwd(),
      });

      expect(res.status).not.toBe(0);
      const combinedOutput = `${res.stdout}\n${res.stderr}`;
      expect(combinedOutput).toContain('Invalid environment configuration');
      expect(combinedOutput).toContain('SITE_ORIGIN');
      expect(combinedOutput).toContain('JWT_ACCESS_SECRET');
      expect(combinedOutput).toContain('CSRF_SECRET');
    }, 15000);

    it('fails the production build when IDEMPOTENCY_STORAGE_DRIVER=memory is configured in production', async () => {
      const { spawnSync } = await import('node:child_process');
      const res = spawnSync('npm', ['run', 'build'], {
        env: {
          ...process.env,
          APP_ENV: 'production',
          SITE_ORIGIN: 'https://arabiyatmart.com',
          NEXT_PUBLIC_SITE_ORIGIN: 'https://arabiyatmart.com',
          BACKEND_API_ORIGIN: 'https://api.arabiyatmart.com',
          JWT_ACCESS_SECRET: '32-characters-minimum-production-access-token-key-ok',
          CSRF_SECRET: '32-characters-minimum-production-csrf-token-hmac-key-ok',
          IDEMPOTENCY_STORAGE_DRIVER: 'memory',
        },
        encoding: 'utf-8',
        cwd: process.cwd(),
      });

      expect(res.status).not.toBe(0);
      const combinedOutput = `${res.stdout}\n${res.stderr}`;
      expect(combinedOutput).toContain('Invalid environment configuration');
      expect(combinedOutput).toContain('IDEMPOTENCY_STORAGE_DRIVER');
    }, 15000);

    it('loads pure schema.ts without needing server-only require.cache stubbing', async () => {
      const { serverEnvSchema, validateServerEnv } = await import('@/lib/env/schema');
      expect(serverEnvSchema).toBeDefined();
      expect(typeof validateServerEnv).toBe('function');
    });
  });
});
