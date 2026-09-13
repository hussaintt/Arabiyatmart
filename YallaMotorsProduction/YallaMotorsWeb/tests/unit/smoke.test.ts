import { describe, it, expect } from 'vitest';
import {
  createUserProfile,
  createSafeSession,
  createListingCard,
  createListingDetail,
  createApiError,
  createCursorMeta,
  createPageMeta,
  FIXED_TIMESTAMP,
  FIXED_USER_ID,
  FIXED_LISTING_ID,
  FIXED_REQUEST_ID,
} from '../fixtures/factories';

describe('Unit Smoke Suite', () => {
  it('creates deterministic user profile with fixed timestamps and IDs', () => {
    const user = createUserProfile();
    expect(user.publicId).toBe(FIXED_USER_ID);
    expect(user.createdAt).toBe(FIXED_TIMESTAMP);
    expect(user.status).toBe('ACTIVE');
    expect(user.accountType).toBe('CUSTOMER');
    expect('password' in user).toBe(false);
    expect('token' in user).toBe(false);
  });

  it('creates safe authenticated session conforming to Phase 2 contract', () => {
    const session = createSafeSession();
    expect(session.isAuthenticated).toBe(true);
    expect(session.signInMethod).toBe('EMAIL_PASSWORD');
    expect(session.user.publicId).toBe(FIXED_USER_ID);
    expect('accessToken' in session).toBe(false);
    expect('refreshToken' in session).toBe(false);
  });

  it('creates listing card with integer-cents money invariant', () => {
    const listing = createListingCard();
    expect(listing.publicId).toBe(FIXED_LISTING_ID);
    expect(listing.priceCents).toBe(65000000);
    expect(Number.isInteger(listing.priceCents)).toBe(true);
    expect(listing.priceCents).toBeGreaterThan(0);
    expect(listing.currency).toBe('EGP');
    expect(listing.makeName.ar).toBe('تويوتا');
    expect(listing.makeName.en).toBe('Toyota');
  });

  it('creates full listing detail with complete Phase 2 relations and integer cents', () => {
    const detail = createListingDetail();
    expect(detail.publicId).toBe(FIXED_LISTING_ID);
    expect(Number.isInteger(detail.priceCents)).toBe(true);
    expect(detail.city.name.ar).toBe('القاهرة');
    expect(detail.images.length).toBeGreaterThan(0);
    expect(detail.images[0]?.isCover).toBe(true);
  });

  it('creates API error envelope with standard HTTP status and request ID', () => {
    const errorBody = createApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'بيانات غير صالحة',
    });
    expect(errorBody.error.status).toBe(400);
    expect(errorBody.error.code).toBe('VALIDATION_ERROR');
    expect(errorBody.error.requestId).toBe(FIXED_REQUEST_ID);
    expect(errorBody.error.details).toBeNull();
  });

  it('creates deterministic cursor and page pagination metadata', () => {
    const cursor = createCursorMeta();
    expect(cursor.hasMore).toBe(true);
    expect(cursor.nextCursor).toBe('cursor_01h7x9k3p0000000000000002');

    const page = createPageMeta();
    expect(page.page).toBe(1);
    expect(page.limit).toBe(20);
    expect(page.total).toBe(100);
    expect(page.hasMore).toBe(true);
  });
});
