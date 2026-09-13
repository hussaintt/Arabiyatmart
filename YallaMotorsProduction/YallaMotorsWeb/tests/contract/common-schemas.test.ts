import { describe, it, expect } from 'vitest';
import {
  LocaleSchema,
  AccountTypeSchema,
  RegistrationAccountTypeSchema,
  UserStatusSchema,
  KycStatusSchema,
  SignInMethodSchema,
  HttpStatusSchema,
  IsoDateTimeSchema,
  PublicIdSchema,
  SlugSchema,
  CurrencySchema,
  MoneyCentsSchema,
  PositiveMoneyCentsSchema,
  LocalizedTextSchema,
  PartialLocalizedTextSchema,
  AtLeastOneLocalizedTextSchema,
  JsonPrimitiveSchema,
  JsonValueSchema,
  CursorMetaSchema,
  PageMetaSchema,
  MessageResponseSchema,
  CountResponseSchema,
  MutationAckResponseSchema,
  FieldErrorSchema,
  ApiErrorBodySchema,
  OperationErrorSchema,
  ApiContractError,
  actionResultSchema,
} from '@/lib/api/schemas/common';
import type {
  Locale,
  AccountType,
  RegistrationAccountType,
  UserStatus,
  KycStatus,
  SignInMethod,
  HttpStatus,
  LocalizedText,
  PartialLocalizedText,
  CursorMeta,
  PageMeta,
  FieldError,
  JsonValue,
  ApiErrorBody,
  OperationError,
  ActionResult,
  MessageResponse,
  CountResponse,
  MutationAckResponse,
} from '@/types/common';
import { z } from 'zod';

describe('Phase 2 Common Contracts and Schemas (TASK-006)', () => {
  describe('LocaleSchema', () => {
    it('accepts valid locales (ar, en)', () => {
      const ar: Locale = LocaleSchema.parse('ar');
      const en: Locale = LocaleSchema.parse('en');
      expect(ar).toBe('ar');
      expect(en).toBe('en');
    });

    it('rejects unsupported locales and invalid inputs', () => {
      expect(() => LocaleSchema.parse('fr')).toThrow();
      expect(() => LocaleSchema.parse('es')).toThrow();
      expect(() => LocaleSchema.parse('AR')).toThrow();
      expect(() => LocaleSchema.parse('')).toThrow();
      expect(() => LocaleSchema.parse(null)).toThrow();
      expect(() => LocaleSchema.parse(123)).toThrow();
    });
  });

  describe('AccountTypeSchema & RegistrationAccountTypeSchema', () => {
    it('accepts valid account types', () => {
      const customer: AccountType = AccountTypeSchema.parse('CUSTOMER');
      const vendor: AccountType = AccountTypeSchema.parse('VENDOR');
      const admin: AccountType = AccountTypeSchema.parse('ADMIN');
      expect(customer).toBe('CUSTOMER');
      expect(vendor).toBe('VENDOR');
      expect(admin).toBe('ADMIN');
    });

    it('rejects invalid account types', () => {
      expect(() => AccountTypeSchema.parse('USER')).toThrow();
      expect(() => AccountTypeSchema.parse('SUPERADMIN')).toThrow();
      expect(() => AccountTypeSchema.parse('')).toThrow();
    });

    it('RegistrationAccountTypeSchema accepts CUSTOMER and VENDOR but strictly rejects ADMIN', () => {
      const regCustomer: RegistrationAccountType = RegistrationAccountTypeSchema.parse('CUSTOMER');
      const regVendor: RegistrationAccountType = RegistrationAccountTypeSchema.parse('VENDOR');
      expect(regCustomer).toBe('CUSTOMER');
      expect(regVendor).toBe('VENDOR');

      // Security boundary: registration cannot claim ADMIN
      expect(() => RegistrationAccountTypeSchema.parse('ADMIN')).toThrow();
    });
  });

  describe('UserStatusSchema', () => {
    it('accepts all valid user statuses', () => {
      const statuses: UserStatus[] = ['PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED'];
      for (const status of statuses) {
        expect(UserStatusSchema.parse(status)).toBe(status);
      }
    });

    it('rejects invalid user statuses', () => {
      expect(() => UserStatusSchema.parse('INACTIVE')).toThrow();
      expect(() => UserStatusSchema.parse('BANNED')).toThrow();
      expect(() => UserStatusSchema.parse('')).toThrow();
    });
  });

  describe('KycStatusSchema', () => {
    it('accepts all valid KYC statuses', () => {
      const statuses: KycStatus[] = ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'];
      for (const status of statuses) {
        expect(KycStatusSchema.parse(status)).toBe(status);
      }
    });

    it('rejects invalid KYC statuses', () => {
      expect(() => KycStatusSchema.parse('VERIFIED')).toThrow();
      expect(() => KycStatusSchema.parse('SUBMITTED')).toThrow();
    });
  });

  describe('SignInMethodSchema', () => {
    it('accepts all valid sign-in methods', () => {
      const methods: SignInMethod[] = ['EMAIL_PASSWORD', 'GOOGLE', 'APPLE', 'OTP', 'RESTORED'];
      for (const method of methods) {
        expect(SignInMethodSchema.parse(method)).toBe(method);
      }
    });

    it('rejects unknown sign-in methods', () => {
      expect(() => SignInMethodSchema.parse('FACEBOOK')).toThrow();
      expect(() => SignInMethodSchema.parse('PASSWORD')).toThrow();
    });
  });

  describe('HttpStatusSchema', () => {
    const validStatuses: HttpStatus[] = [
      400, 401, 403, 404, 409, 413, 422, 429, 500, 502, 503, 504,
    ];

    it('accepts all 12 Phase 2 documented HTTP error statuses', () => {
      for (const status of validStatuses) {
        expect(HttpStatusSchema.parse(status)).toBe(status);
      }
    });

    it('rejects non-error or unlisted HTTP statuses', () => {
      expect(() => HttpStatusSchema.parse(200)).toThrow();
      expect(() => HttpStatusSchema.parse(201)).toThrow();
      expect(() => HttpStatusSchema.parse(204)).toThrow();
      expect(() => HttpStatusSchema.parse(301)).toThrow();
      expect(() => HttpStatusSchema.parse(302)).toThrow();
      expect(() => HttpStatusSchema.parse(405)).toThrow();
      expect(() => HttpStatusSchema.parse(418)).toThrow();
      expect(() => HttpStatusSchema.parse(501)).toThrow();
      expect(() => HttpStatusSchema.parse('400')).toThrow();
    });
  });

  describe('IsoDateTimeSchema', () => {
    it('accepts valid ISO datetime strings with timezone offset', () => {
      expect(IsoDateTimeSchema.parse('2026-01-01T12:00:00.000Z')).toBe('2026-01-01T12:00:00.000Z');
      expect(IsoDateTimeSchema.parse('2026-09-07T02:08:25+03:00')).toBe('2026-09-07T02:08:25+03:00');
      expect(IsoDateTimeSchema.parse('2026-05-15T08:30:00-04:00')).toBe('2026-05-15T08:30:00-04:00');
    });

    it('rejects datetimes without timezone offset, date-only strings, and malformed strings', () => {
      expect(() => IsoDateTimeSchema.parse('2026-01-01T12:00:00')).toThrow();
      expect(() => IsoDateTimeSchema.parse('2026-01-01')).toThrow();
      expect(() => IsoDateTimeSchema.parse('invalid-date')).toThrow();
      expect(() => IsoDateTimeSchema.parse(1700000000)).toThrow();
      expect(() => IsoDateTimeSchema.parse(null)).toThrow();
    });
  });

  describe('PublicIdSchema', () => {
    it('accepts non-empty strings up to 128 chars and trims surrounding whitespace', () => {
      expect(PublicIdSchema.parse('usr_01h7x9k3p0000000000000001')).toBe('usr_01h7x9k3p0000000000000001');
      expect(PublicIdSchema.parse('  dlr_001  ')).toBe('dlr_001');
      expect(PublicIdSchema.parse('a'.repeat(128))).toBe('a'.repeat(128));
    });

    it('rejects empty strings, whitespace-only, strings exceeding 128 characters, and non-strings', () => {
      expect(() => PublicIdSchema.parse('')).toThrow();
      expect(() => PublicIdSchema.parse('   ')).toThrow();
      expect(() => PublicIdSchema.parse('a'.repeat(129))).toThrow();
      expect(() => PublicIdSchema.parse(12345)).toThrow();
      expect(() => PublicIdSchema.parse(null)).toThrow();
    });
  });

  describe('SlugSchema', () => {
    it('accepts valid lowercase hyphen-separated slugs up to 160 characters', () => {
      expect(SlugSchema.parse('toyota')).toBe('toyota');
      expect(SlugSchema.parse('toyota-corolla-2024')).toBe('toyota-corolla-2024');
      expect(SlugSchema.parse('bmw-3-series-sedan')).toBe('bmw-3-series-sedan');
      expect(SlugSchema.parse('c123-d456')).toBe('c123-d456');
    });

    it('trims surrounding whitespace on slugs', () => {
      expect(SlugSchema.parse('  toyota-corolla  ')).toBe('toyota-corolla');
    });

    it('rejects uppercase letters, spaces, leading/trailing hyphens, consecutive hyphens, and invalid symbols', () => {
      expect(() => SlugSchema.parse('Toyota')).toThrow();
      expect(() => SlugSchema.parse('toyota corolla')).toThrow();
      expect(() => SlugSchema.parse('-toyota')).toThrow();
      expect(() => SlugSchema.parse('toyota-')).toThrow();
      expect(() => SlugSchema.parse('toyota--corolla')).toThrow();
      expect(() => SlugSchema.parse('toyota_corolla')).toThrow();
      expect(() => SlugSchema.parse('toyota@car')).toThrow();
      expect(() => SlugSchema.parse('')).toThrow();
      expect(() => SlugSchema.parse('a'.repeat(161))).toThrow();
    });
  });

  describe('CurrencySchema', () => {
    it('accepts exactly 3 uppercase letters and trims whitespace', () => {
      expect(CurrencySchema.parse('EGP')).toBe('EGP');
      expect(CurrencySchema.parse('USD')).toBe('USD');
      expect(CurrencySchema.parse('  AED  ')).toBe('AED');
      expect(CurrencySchema.parse('SAR')).toBe('SAR');
    });

    it('rejects non-3-character, lowercase, numeric, or special symbol currencies', () => {
      expect(() => CurrencySchema.parse('egp')).toThrow();
      expect(() => CurrencySchema.parse('EG')).toThrow();
      expect(() => CurrencySchema.parse('EGPP')).toThrow();
      expect(() => CurrencySchema.parse('123')).toThrow();
      expect(() => CurrencySchema.parse('US$')).toThrow();
      expect(() => CurrencySchema.parse('')).toThrow();
    });
  });

  describe('MoneyCentsSchema & PositiveMoneyCentsSchema', () => {
    it('MoneyCentsSchema accepts non-negative safe integers', () => {
      expect(MoneyCentsSchema.parse(0)).toBe(0);
      expect(MoneyCentsSchema.parse(100)).toBe(100);
      expect(MoneyCentsSchema.parse(65000000)).toBe(65000000);
    });

    it('MoneyCentsSchema strictly rejects floating point numbers, negative values, and unsafe integers', () => {
      expect(() => MoneyCentsSchema.parse(10.5)).toThrow();
      expect(() => MoneyCentsSchema.parse(0.99)).toThrow();
      expect(() => MoneyCentsSchema.parse(-1)).toThrow();
      expect(() => MoneyCentsSchema.parse(-100)).toThrow();
      expect(() => MoneyCentsSchema.parse(Number.MAX_SAFE_INTEGER + 10)).toThrow();
      expect(() => MoneyCentsSchema.parse(NaN)).toThrow();
      expect(() => MoneyCentsSchema.parse(Infinity)).toThrow();
      expect(() => MoneyCentsSchema.parse('1000')).toThrow();
    });

    it('PositiveMoneyCentsSchema accepts positive safe integers and rejects 0 and negative numbers', () => {
      expect(PositiveMoneyCentsSchema.parse(1)).toBe(1);
      expect(PositiveMoneyCentsSchema.parse(75000000)).toBe(75000000);

      expect(() => PositiveMoneyCentsSchema.parse(0)).toThrow();
      expect(() => PositiveMoneyCentsSchema.parse(-1)).toThrow();
      expect(() => PositiveMoneyCentsSchema.parse(99.9)).toThrow();
    });
  });

  describe('LocalizedTextSchema', () => {
    it('accepts object with both ar and en strings', () => {
      const valid: LocalizedText = LocalizedTextSchema.parse({
        ar: 'تويوتا كورولا',
        en: 'Toyota Corolla',
      });
      expect(valid.ar).toBe('تويوتا كورولا');
      expect(valid.en).toBe('Toyota Corolla');
    });

    it('rejects missing ar or en, or non-string values', () => {
      expect(() => LocalizedTextSchema.parse({ ar: 'تويوتا' })).toThrow();
      expect(() => LocalizedTextSchema.parse({ en: 'Toyota' })).toThrow();
      expect(() => LocalizedTextSchema.parse({})).toThrow();
      expect(() => LocalizedTextSchema.parse({ ar: 123, en: 'Toyota' })).toThrow();
    });
  });

  describe('PartialLocalizedTextSchema & AtLeastOneLocalizedTextSchema', () => {
    it('PartialLocalizedTextSchema accepts empty, ar-only, en-only, or both', () => {
      const empty: PartialLocalizedText = PartialLocalizedTextSchema.parse({});
      const arOnly: PartialLocalizedText = PartialLocalizedTextSchema.parse({ ar: 'تويوتا' });
      const enOnly: PartialLocalizedText = PartialLocalizedTextSchema.parse({ en: 'Toyota' });
      const both: PartialLocalizedText = PartialLocalizedTextSchema.parse({ ar: 'تويوتا', en: 'Toyota' });

      expect(empty).toEqual({});
      expect(arOnly).toEqual({ ar: 'تويوتا' });
      expect(enOnly).toEqual({ en: 'Toyota' });
      expect(both).toEqual({ ar: 'تويوتا', en: 'Toyota' });
    });

    it('PartialLocalizedTextSchema strictly rejects unknown keys', () => {
      expect(() => PartialLocalizedTextSchema.parse({ ar: 'تويوتا', fr: 'Toyota' })).toThrow();
      expect(() => PartialLocalizedTextSchema.parse({ unknown: 'test' })).toThrow();
    });

    it('AtLeastOneLocalizedTextSchema requires at least ar or en to be defined', () => {
      expect(AtLeastOneLocalizedTextSchema.parse({ ar: 'تويوتا' })).toEqual({ ar: 'تويوتا' });
      expect(AtLeastOneLocalizedTextSchema.parse({ en: 'Toyota' })).toEqual({ en: 'Toyota' });
      expect(AtLeastOneLocalizedTextSchema.parse({ ar: 'تويوتا', en: 'Toyota' })).toEqual({
        ar: 'تويوتا',
        en: 'Toyota',
      });

      expect(() => AtLeastOneLocalizedTextSchema.parse({})).toThrow(
        'At least one localized value is required'
      );
    });
  });

  describe('JsonPrimitiveSchema & JsonValueSchema', () => {
    it('JsonPrimitiveSchema validates string, number, boolean, and null', () => {
      expect(JsonPrimitiveSchema.parse('text')).toBe('text');
      expect(JsonPrimitiveSchema.parse(42)).toBe(42);
      expect(JsonPrimitiveSchema.parse(true)).toBe(true);
      expect(JsonPrimitiveSchema.parse(false)).toBe(false);
      expect(JsonPrimitiveSchema.parse(null)).toBe(null);

      expect(() => JsonPrimitiveSchema.parse(undefined)).toThrow();
      expect(() => JsonPrimitiveSchema.parse({})).toThrow();
      expect(() => JsonPrimitiveSchema.parse([])).toThrow();
    });

    it('JsonValueSchema validates recursive nested JSON structures', () => {
      const complex = {
        stringKey: 'value',
        numberKey: 123.45,
        boolKey: true,
        nullKey: null,
        arrayKey: ['a', 1, false, null, { nested: 'obj' }],
        nestedObj: {
          inner: {
            deepArray: [1, 2, 3],
          },
        },
      };

      expect(JsonValueSchema.parse(complex)).toEqual(complex);
      expect(JsonValueSchema.parse('primitive string')).toBe('primitive string');
      expect(JsonValueSchema.parse(null)).toBe(null);
    });

    it('JsonValueSchema rejects functions and undefined values', () => {
      expect(() => JsonValueSchema.parse(() => {})).toThrow();
      expect(() => JsonValueSchema.parse(undefined)).toThrow();
    });
  });

  describe('CursorMetaSchema', () => {
    it('accepts valid cursor pagination shapes', () => {
      const withCursor: CursorMeta = CursorMetaSchema.parse({
        hasMore: true,
        nextCursor: 'cur_01h7x9k3p0000000000000002',
      });
      expect(withCursor.hasMore).toBe(true);
      expect(withCursor.nextCursor).toBe('cur_01h7x9k3p0000000000000002');

      const endOfList: CursorMeta = CursorMetaSchema.parse({
        hasMore: false,
        nextCursor: null,
      });
      expect(endOfList.hasMore).toBe(false);
      expect(endOfList.nextCursor).toBeNull();
    });

    it('rejects empty nextCursor string and missing fields', () => {
      expect(() => CursorMetaSchema.parse({ hasMore: true, nextCursor: '' })).toThrow();
      expect(() => CursorMetaSchema.parse({ hasMore: true })).toThrow();
      expect(() => CursorMetaSchema.parse({ nextCursor: null })).toThrow();
    });
  });

  describe('PageMetaSchema', () => {
    it('accepts valid numbered page metadata with nullable total', () => {
      const valid: PageMeta = PageMetaSchema.parse({
        total: 150,
        page: 2,
        limit: 20,
        hasMore: true,
      });
      expect(valid.total).toBe(150);
      expect(valid.page).toBe(2);
      expect(valid.limit).toBe(20);
      expect(valid.hasMore).toBe(true);

      const nullTotal: PageMeta = PageMetaSchema.parse({
        total: null,
        page: 1,
        limit: 50,
        hasMore: false,
      });
      expect(nullTotal.total).toBeNull();
    });

    it('enforces limit max bounds (100) and positive page/limit', () => {
      expect(() => PageMetaSchema.parse({ total: 10, page: 0, limit: 20, hasMore: false })).toThrow();
      expect(() => PageMetaSchema.parse({ total: 10, page: 1, limit: 0, hasMore: false })).toThrow();
      expect(() => PageMetaSchema.parse({ total: 10, page: 1, limit: 101, hasMore: false })).toThrow();
      expect(() => PageMetaSchema.parse({ total: -5, page: 1, limit: 20, hasMore: false })).toThrow();
      expect(() => PageMetaSchema.parse({ total: 10.5, page: 1, limit: 20, hasMore: false })).toThrow();
    });
  });

  describe('FieldErrorSchema', () => {
    it('accepts valid field error shape', () => {
      const error: FieldError = FieldErrorSchema.parse({
        field: 'priceCents',
        code: 'too_small',
        message: 'Must be positive',
      });
      expect(error.field).toBe('priceCents');
      expect(error.code).toBe('too_small');
      expect(error.message).toBe('Must be positive');
    });

    it('rejects missing or non-string fields', () => {
      expect(() => FieldErrorSchema.parse({ field: 'priceCents', code: 'too_small' })).toThrow();
      expect(() => FieldErrorSchema.parse({ field: 123, code: 'code', message: 'msg' })).toThrow();
    });
  });

  describe('ApiErrorBodySchema & OperationErrorSchema', () => {
    const validErrorFixtures: Array<{
      status: HttpStatus;
      code: string;
      message: string;
      fieldErrors?: FieldError[];
      details?: JsonValue | null;
      retryAfterSeconds?: number | null;
    }> = [
      {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        fieldErrors: [{ field: 'priceCents', code: 'too_small', message: 'Must be positive' }],
      },
      {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
      {
        status: 401,
        code: 'SESSION_EXPIRED',
        message: 'Session has expired',
      },
      {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Access denied',
      },
      {
        status: 403,
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Email verification is required',
      },
      {
        status: 403,
        code: 'PHONE_VERIFICATION_REQUIRED',
        message: 'Phone verification is required',
      },
      {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
      {
        status: 409,
        code: 'CONFLICT',
        message: 'Resource conflict',
      },
      {
        status: 409,
        code: 'ROLE_CONFLICT',
        message: 'Role conflict detected',
      },
      {
        status: 409,
        code: 'VENDOR_BILLING_RESTRICTED',
        message: 'Vendor billing restriction active',
      },
      {
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Uploaded payload exceeds allowed limit',
      },
      {
        status: 422,
        code: 'UNPROCESSABLE_ENTITY',
        message: 'Input semantic validation failed',
      },
      {
        status: 429,
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        retryAfterSeconds: 60,
      },
      {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected internal error occurred',
        details: null,
      },
      {
        status: 502,
        code: 'BAD_GATEWAY',
        message: 'Upstream service error',
      },
      {
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service is temporarily unavailable',
        retryAfterSeconds: 30,
      },
      {
        status: 504,
        code: 'GATEWAY_TIMEOUT',
        message: 'Upstream service timeout',
      },
    ];

    it.each(validErrorFixtures)(
      'validates documented error shape for status $status with code $code',
      (fixture) => {
        const errorPayload: ApiErrorBody = {
          error: {
            status: fixture.status,
            code: fixture.code,
            message: fixture.message,
            requestId: 'req_01h7x9k3p0000000000000001',
            fieldErrors: fixture.fieldErrors ?? [],
            details: fixture.details ?? null,
            retryAfterSeconds: fixture.retryAfterSeconds ?? null,
          },
        };

        const parsed = ApiErrorBodySchema.parse(errorPayload);
        expect(parsed.error.status).toBe(fixture.status);
        expect(parsed.error.code).toBe(fixture.code);
        expect(parsed.error.message).toBe(fixture.message);
        expect(parsed.error.requestId).toBe('req_01h7x9k3p0000000000000001');

        // Verify OperationErrorSchema validates identically
        const parsedViaOp = OperationErrorSchema.parse(errorPayload);
        expect(parsedViaOp).toEqual(parsed);
      }
    );

    it('rejects malformed error bodies', () => {
      // Missing error wrapper
      expect(() => ApiErrorBodySchema.parse({ status: 400, message: 'Invalid' })).toThrow();

      // Empty requestId
      expect(() =>
        ApiErrorBodySchema.parse({
          error: {
            status: 400,
            code: 'VALIDATION_ERROR',
            message: 'Failed',
            requestId: '',
            fieldErrors: [],
            details: null,
            retryAfterSeconds: null,
          },
        })
      ).toThrow();

      // Status 200 is not an error status
      expect(() =>
        ApiErrorBodySchema.parse({
          error: {
            status: 200,
            code: 'OK',
            message: 'Success',
            requestId: 'req_1',
            fieldErrors: [],
            details: null,
            retryAfterSeconds: null,
          },
        })
      ).toThrow();

      // Floating point or negative retryAfterSeconds
      expect(() =>
        ApiErrorBodySchema.parse({
          error: {
            status: 429,
            code: 'RATE_LIMITED',
            message: 'Rate limit',
            requestId: 'req_1',
            fieldErrors: [],
            details: null,
            retryAfterSeconds: -5,
          },
        })
      ).toThrow();

      expect(() =>
        ApiErrorBodySchema.parse({
          error: {
            status: 429,
            code: 'RATE_LIMITED',
            message: 'Rate limit',
            requestId: 'req_1',
            fieldErrors: [],
            details: null,
            retryAfterSeconds: 2.5,
          },
        })
      ).toThrow();
    });
  });

  describe('ApiContractError', () => {
    it('constructs an Error with the message and preserves the full OperationError body', () => {
      const errorBody: OperationError = {
        error: {
          status: 404,
          code: 'NOT_FOUND',
          message: 'Listing not found',
          requestId: 'req_01h7x9k3p0000000000000001',
          fieldErrors: [],
          details: null,
          retryAfterSeconds: null,
        },
      };

      const err = new ApiContractError(errorBody);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ApiContractError');
      expect(err.message).toBe('Listing not found');
      expect(err.body).toEqual(errorBody);
    });
  });

  describe('actionResultSchema', () => {
    const testResultSchema = actionResultSchema(
      z.object({
        listingId: z.string(),
      })
    );

    it('validates successful action result { ok: true, data }', () => {
      const okResult: ActionResult<{ listingId: string }> = testResultSchema.parse({
        ok: true,
        data: { listingId: 'lst_123' },
      });
      expect(okResult.ok).toBe(true);
      if (okResult.ok) {
        expect(okResult.data.listingId).toBe('lst_123');
      }
    });

    it('validates failed action result { ok: false, error }', () => {
      const errorResult: ActionResult<{ listingId: string }> = testResultSchema.parse({
        ok: false,
        error: {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Invalid data',
          requestId: 'req_1',
          fieldErrors: [{ field: 'listingId', code: 'required', message: 'Required' }],
          details: null,
          retryAfterSeconds: null,
        },
      });

      expect(errorResult.ok).toBe(false);
      if (!errorResult.ok) {
        expect(errorResult.error.status).toBe(400);
        expect(errorResult.error.code).toBe('VALIDATION_ERROR');
        expect(errorResult.error.fieldErrors).toHaveLength(1);
      }
    });

    it('rejects invalid discriminators or mismatched payloads', () => {
      expect(() => testResultSchema.parse({ ok: true })).toThrow();
      expect(() => testResultSchema.parse({ ok: false })).toThrow();
      expect(() => testResultSchema.parse({ ok: 'unknown', data: {} })).toThrow();
    });
  });

  describe('Response Envelopes (MessageResponse, CountResponse, MutationAckResponse)', () => {
    it('MessageResponseSchema accepts message string', () => {
      const res: MessageResponse = MessageResponseSchema.parse({ message: 'Operation successful' });
      expect(res.message).toBe('Operation successful');
      expect(() => MessageResponseSchema.parse({})).toThrow();
      expect(() => MessageResponseSchema.parse({ message: 123 })).toThrow();
    });

    it('CountResponseSchema accepts non-negative integer count', () => {
      const zero: CountResponse = CountResponseSchema.parse({ count: 0 });
      const positive: CountResponse = CountResponseSchema.parse({ count: 42 });
      expect(zero.count).toBe(0);
      expect(positive.count).toBe(42);

      expect(() => CountResponseSchema.parse({ count: -1 })).toThrow();
      expect(() => CountResponseSchema.parse({ count: 1.5 })).toThrow();
      expect(() => CountResponseSchema.parse({})).toThrow();
    });

    it('MutationAckResponseSchema accepts ok: true and rejects ok: false', () => {
      const ack: MutationAckResponse = MutationAckResponseSchema.parse({ ok: true });
      expect(ack.ok).toBe(true);

      expect(() => MutationAckResponseSchema.parse({ ok: false })).toThrow();
      expect(() => MutationAckResponseSchema.parse({})).toThrow();
    });
  });
});
