import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import {
  verifyAccessTokenEdge,
  DEVELOPMENT_JWT_ACCESS_SECRET,
} from '@/lib/auth/edge-jwt';

const secret = new TextEncoder().encode(DEVELOPMENT_JWT_ACCESS_SECRET);

async function createValidToken(overrides: Record<string, unknown> = {}, expiresIn = '15m') {
  const iss = (overrides.iss as string) ?? 'arabiyatmart-api';
  const aud = (overrides.aud as string) ?? 'arabiyatmart-web';
  const rest = { ...overrides };
  delete rest.iss;
  delete rest.aud;

  return new SignJWT({
    sub: '42',
    roles: ['CUSTOMER'],
    emailVerified: true,
    phoneVerified: true,
    ...rest,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setIssuer(iss)
    .setAudience(aud)
    .sign(secret);
}

describe('TASK 2.1: Edge-Safe Access JWT Verifier', () => {
  it('verifies a valid token and extracts claims successfully', async () => {
    const token = await createValidToken({ roles: ['CUSTOMER', 'VENDOR'] });
    const result = await verifyAccessTokenEdge(token);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.sub).toBe('42');
      expect(result.payload.roles).toEqual(['CUSTOMER', 'VENDOR']);
      expect(result.payload.emailVerified).toBe(true);
      expect(result.payload.phoneVerified).toBe(true);
      expect(result.payload.iss).toBe('arabiyatmart-api');
    }
  });

  it('rejects crafted unsigned tokens (alg: none)', async () => {
    // Manually construct an unsigned token: header.payload.
    const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' })).replace(/=/g, '');
    const payload = btoa(
      JSON.stringify({
        sub: 1,
        roles: ['ADMIN'],
        emailVerified: true,
        phoneVerified: true,
        iss: 'arabiyatmart-api',
        aud: 'arabiyatmart-web',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).replace(/=/g, '');
    const unsignedToken = `${header}.${payload}.`;

    const result = await verifyAccessTokenEdge(unsignedToken);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('INVALID_ALGORITHM');
      expect(result.expired).toBe(false);
    }
  });

  it('rejects tokens signed with an unsupported algorithm (e.g. RS256 or HS512)', async () => {
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '');
    const payload = btoa(JSON.stringify({ sub: 1, exp: Math.floor(Date.now() / 1000) + 3600 })).replace(/=/g, '');
    const fakeToken = `${header}.${payload}.fakesignature`;

    const result = await verifyAccessTokenEdge(fakeToken);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('INVALID_ALGORITHM');
    }
  });

  it('rejects tokens with forged/invalid signature', async () => {
    const validToken = await createValidToken();
    const parts = validToken.split('.');
    const forgedToken = `${parts[0]}.${parts[1]}.tampered_signature_bytes`;

    const result = await verifyAccessTokenEdge(forgedToken);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('INVALID_SIGNATURE');
      expect(result.expired).toBe(false);
    }
  });

  it('rejects tokens signed with a different secret', async () => {
    const otherSecret = new TextEncoder().encode('attacker-controlled-secret-key-32-chars!!');
    const attackerToken = await new SignJWT({
      sub: '999',
      roles: ['ADMIN'],
      emailVerified: true,
      phoneVerified: true,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .setIssuer('arabiyatmart-api')
      .setAudience('arabiyatmart-web')
      .sign(otherSecret);

    const result = await verifyAccessTokenEdge(attackerToken);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('INVALID_SIGNATURE');
    }
  });

  it('rejects expired tokens and indicates expired: true', async () => {
    const expiredToken = await new SignJWT({
      sub: '1',
      roles: ['CUSTOMER'],
      emailVerified: true,
      phoneVerified: true,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 300)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60) // Expired 60s ago
      .setIssuer('arabiyatmart-api')
      .setAudience('arabiyatmart-web')
      .sign(secret);

    const result = await verifyAccessTokenEdge(expiredToken);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('EXPIRED');
      expect(result.expired).toBe(true);
    }
  });

  it('accepts tokens within the 5-second clock tolerance window', async () => {
    // Expired 3 seconds ago, within the 5s tolerance
    const recentlyExpired = await new SignJWT({
      sub: '1',
      roles: ['CUSTOMER'],
      emailVerified: true,
      phoneVerified: true,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3)
      .setIssuer('arabiyatmart-api')
      .setAudience('arabiyatmart-web')
      .sign(secret);

    const result = await verifyAccessTokenEdge(recentlyExpired, { clockToleranceSeconds: 5 });
    expect(result.valid).toBe(true);
  });

  it('rejects tokens with wrong issuer', async () => {
    const token = await createValidToken({ iss: 'untrusted-evil-auth-service' });
    const result = await verifyAccessTokenEdge(token);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('INVALID_ISSUER');
    }
  });

  it('rejects tokens with wrong audience', async () => {
    const token = await createValidToken({ aud: 'unintended-external-service' });
    const result = await verifyAccessTokenEdge(token);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('INVALID_AUDIENCE');
    }
  });

  it('rejects tokens missing essential claims like roles or emailVerified', async () => {
    const missingRoles = await new SignJWT({
      sub: '1',
      emailVerified: true,
      phoneVerified: true,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .setIssuer('arabiyatmart-api')
      .setAudience('arabiyatmart-web')
      .sign(secret);

    const result = await verifyAccessTokenEdge(missingRoles);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe('MISSING_CLAIMS');
    }
  });

  it('rejects malformed or empty token strings', async () => {
    expect((await verifyAccessTokenEdge(null)).valid).toBe(false);
    expect((await verifyAccessTokenEdge('')).valid).toBe(false);
    expect((await verifyAccessTokenEdge('not-a-jwt')).valid).toBe(false);
    expect((await verifyAccessTokenEdge('part1.part2')).valid).toBe(false);
    expect((await verifyAccessTokenEdge('part1.part2.part3.part4')).valid).toBe(false);
  });
});
