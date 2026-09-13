import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  EmailSchema,
  PasswordSchema,
  OtpCodeSchema,
  ReturnToSchema,
  ResetFlowSchema,
  OtpPurposeSchema,
  UpstreamTokenResponseSchema,
  ServerCredentialsSchema,
  SafeSessionSchema,
  SessionViewSchema,
  SessionResponseSchema,
  LoginInputSchema,
  RegisterInputSchema,
  GoogleLoginInputSchema,
  AppleLoginInputSchema,
  OtpSendInputSchema,
  OtpVerifyInputSchema,
  ForgotPasswordInputSchema,
  VerifyResetCodeInputSchema,
  ResetPasswordInputSchema,
  ChangePasswordInputSchema,
  DeleteAccountInputSchema,
  AuthClaimsSchema,
  SessionClaimsSchema,
  createSafeSession,
  createSafeSessionView,
  projectSafeSession,
} from '@/lib/api/schemas/auth';
import {
  E164Schema,
  RoleSummarySchema,
  UserProfileSchema,
  UserProfileResponseSchema,
  SetPhoneInputSchema,
  VerifyFirebasePhoneInputSchema,
  VerifiedPhoneUserSchema,
  VerifiedPhoneUserResponseSchema,
  UpdateProfileInputSchema,
  VendorRoleSchema,
  VendorMembershipStatusSchema,
  VendorMembershipSchema,
  normalizeUserProfile,
} from '@/lib/api/schemas/profile';
import type {
  AppleLoginInput,
  AuthClaims,
  ChangePasswordInput,
  DeleteAccountInput,
  ForgotPasswordInput,
  GoogleLoginInput,
  LoginInput,
  OtpPurpose,
  OtpSendInput,
  OtpVerifyInput,
  RegisterInput,
  ResetPasswordInput,
  SafeSession,
  ServerCredentials,
  SessionClaims,
  SessionResponse,
  SessionView,
  UpstreamTokenResponse,
  VerifyResetCodeInput,
} from '@/types/auth';
import type {
  RoleSummary,
  SetPhoneInput,
  UpdateProfileInput,
  UserProfile,
  UserProfileResponse,
  VendorMembership,
  VerifiedPhoneUser,
  VerifiedPhoneUserResponse,
  VerifyFirebasePhoneInput,
} from '@/types/profile';

describe('Phase 2 Authentication, Session, and Profile Contracts (TASK-007)', () => {
  const validUserProfileFixture: UserProfile = {
    publicId: 'usr_01h7x9k3p0000000000000001',
    email: 'ahmed@example.com',
    phone: '+201012345678',
    firstName: 'Ahmed',
    lastName: 'Mahmoud',
    status: 'ACTIVE',
    locale: 'ar',
    emailVerifiedAt: '2026-01-01T12:00:00.000Z',
    phoneVerifiedAt: '2026-01-01T12:30:00.000Z',
    kycStatus: 'APPROVED',
    kycApprovedAt: '2026-01-02T09:00:00.000Z',
    kycRejectionReason: null,
    lastLoginAt: '2026-01-03T08:00:00.000Z',
    createdAt: '2026-01-01T10:00:00.000Z',
    avatarUrl: 'https://images.arabiyatmart.com/avatars/usr_01.jpg',
    accountType: 'CUSTOMER',
    roles: [
      {
        name: 'CUSTOMER',
        description: 'Standard customer account',
        isSystem: true,
      },
    ],
    permissions: ['listing:read', 'lead:create'],
  };

  const validTokenResponseFixture: UpstreamTokenResponse = {
    accessToken: 'mock.upstream.access.jwt.token',
    refreshToken: 'mock_refresh_token_string_12345',
    expiresIn: 900,
  };

  describe('1. Static Type Invariant Tests (DoD Requirement)', () => {
    it('enforces that SessionView has NO token material, password, or provider credentials', () => {
      expectTypeOf<SessionView>().not.toHaveProperty('accessToken');
      expectTypeOf<SessionView>().not.toHaveProperty('refreshToken');
      expectTypeOf<SessionView>().not.toHaveProperty('password');
      expectTypeOf<SessionView>().not.toHaveProperty('idToken');
      expectTypeOf<SessionView>().not.toHaveProperty('identityToken');

      expectTypeOf<SessionView['user']>().not.toHaveProperty('password');
      expectTypeOf<SessionView['user']>().not.toHaveProperty('accessToken');
      expectTypeOf<SessionView['user']>().not.toHaveProperty('refreshToken');
      expectTypeOf<SessionView['user']>().not.toHaveProperty('id');
    });

    it('enforces type compatibility between SafeSession and SessionView', () => {
      expectTypeOf<SessionView>().toEqualTypeOf<SafeSession>();
      expectTypeOf<ServerCredentials>().toEqualTypeOf<UpstreamTokenResponse>();
    });
  });

  describe('2. Request / Form Normalization Schemas', () => {
    describe('EmailSchema', () => {
      it('trims whitespace and normalizes email to lowercase', () => {
        expect(EmailSchema.parse('  User.NAME@Example.COM  ')).toBe('user.name@example.com');
      });

      it('rejects invalid email formats', () => {
        expect(() => EmailSchema.parse('')).toThrow();
        expect(() => EmailSchema.parse('not-an-email')).toThrow();
        expect(() => EmailSchema.parse('@domain.com')).toThrow();
        expect(() => EmailSchema.parse('user@')).toThrow();
        expect(() => EmailSchema.parse(12345)).toThrow();
      });

      it('rejects emails exceeding 254 characters', () => {
        const longEmail = 'a'.repeat(250) + '@example.com';
        expect(() => EmailSchema.parse(longEmail)).toThrow();
      });
    });

    describe('PasswordSchema', () => {
      it('accepts strong passwords meeting all complexity criteria', () => {
        expect(PasswordSchema.parse('StrongP@ss1')).toBe('StrongP@ss1');
        expect(PasswordSchema.parse('Abcdefg8')).toBe('Abcdefg8');
      });

      it('rejects passwords failing complexity rules', () => {
        expect(() => PasswordSchema.parse('short1A')).toThrow(); // <8 chars
        expect(() => PasswordSchema.parse('nouppercase1')).toThrow(); // missing uppercase
        expect(() => PasswordSchema.parse('NOLOWERCASE1')).toThrow(); // missing lowercase
        expect(() => PasswordSchema.parse('NoNumbersHere')).toThrow(); // missing number
        expect(() => PasswordSchema.parse('aA1' + 'b'.repeat(130))).toThrow(); // >128 chars
      });
    });

    describe('OtpCodeSchema', () => {
      it('accepts valid 6-digit numeric OTP codes', () => {
        expect(OtpCodeSchema.parse('123456')).toBe('123456');
        expect(OtpCodeSchema.parse('000000')).toBe('000000');
        expect(OtpCodeSchema.parse('987654')).toBe('987654');
      });

      it('rejects invalid OTP codes', () => {
        expect(() => OtpCodeSchema.parse('12345')).toThrow(); // 5 digits
        expect(() => OtpCodeSchema.parse('1234567')).toThrow(); // 7 digits
        expect(() => OtpCodeSchema.parse('12345a')).toThrow(); // non-numeric
        expect(() => OtpCodeSchema.parse('')).toThrow();
      });
    });

    describe('ReturnToSchema', () => {
      it('accepts safe relative application paths or null', () => {
        expect(ReturnToSchema.parse('/ar/dealers')).toBe('/ar/dealers');
        expect(ReturnToSchema.parse('/en/search?q=bmw')).toBe('/en/search?q=bmw');
        expect(ReturnToSchema.parse(null)).toBeNull();
      });

      it('rejects open redirect and unsafe target attempts', () => {
        expect(() => ReturnToSchema.parse('https://evil.com')).toThrow();
        expect(() => ReturnToSchema.parse('http://attacker.com')).toThrow();
        expect(() => ReturnToSchema.parse('//evil.com')).toThrow();
        expect(() => ReturnToSchema.parse('//evil.com/path')).toThrow();
        expect(() => ReturnToSchema.parse('/path\nwith\rcontrols')).toThrow();
        expect(() => ReturnToSchema.parse('/' + 'a'.repeat(2050))).toThrow();
      });

      it('rejects backslash-based targets and values that normalize to external redirects', () => {
        // Browser-normalized open redirect patterns
        expect(() => ReturnToSchema.parse('/\\evil.example')).toThrow();
        expect(() => ReturnToSchema.parse('/\\\\evil.example')).toThrow();
        expect(() => ReturnToSchema.parse('/\\/evil.example')).toThrow();
        expect(() => ReturnToSchema.parse('\\evil.example')).toThrow();
        expect(() => ReturnToSchema.parse('\\\\evil.example')).toThrow();
        expect(() => ReturnToSchema.parse('/path\\with\\backslash')).toThrow();
        expect(() => ReturnToSchema.parse('/ar\\dealers')).toThrow();

        // Encoded backslash variants
        expect(() => ReturnToSchema.parse('/%5cevil.example')).toThrow();
        expect(() => ReturnToSchema.parse('/%5Cevil.example')).toThrow();
        expect(() => ReturnToSchema.parse('/%5C/evil.example')).toThrow();
        expect(() => ReturnToSchema.parse('/%5c%5cevil.example')).toThrow();
        expect(() => ReturnToSchema.parse('/ar/%5cdealers')).toThrow();
      });
    });

    describe('E164Schema', () => {
      it('accepts valid international E.164 phone numbers with + country code', () => {
        expect(E164Schema.parse('+201012345678')).toBe('+201012345678');
        expect(E164Schema.parse('+14155552671')).toBe('+14155552671');
        expect(E164Schema.parse('+971501234567')).toBe('+971501234567');
      });

      it('trims whitespace around valid E.164 numbers', () => {
        expect(E164Schema.parse('  +201012345678  ')).toBe('+201012345678');
      });

      it('rejects local phone numbers without + or invalid formats', () => {
        expect(() => E164Schema.parse('01012345678')).toThrow();
        expect(() => E164Schema.parse('+012345678')).toThrow(); // cannot start with +0
        expect(() => E164Schema.parse('+123')).toThrow(); // too short
        expect(() => E164Schema.parse('+' + '1'.repeat(16))).toThrow(); // too long
        expect(() => E164Schema.parse('+2010abc5678')).toThrow();
      });
    });

    describe('ResetFlowSchema', () => {
      it('accepts valid reset flow identifier tokens (16 to 512 chars)', () => {
        const flowId = 'flow_reset_session_token_1234567890';
        expect(ResetFlowSchema.parse(flowId)).toBe(flowId);
      });

      it('rejects short or empty reset flow tokens', () => {
        expect(() => ResetFlowSchema.parse('short-flow')).toThrow();
        expect(() => ResetFlowSchema.parse('')).toThrow();
      });
    });
  });

  describe('3. Role and User Profile Schemas', () => {
    describe('RoleSummarySchema', () => {
      it('accepts valid role summary fixtures', () => {
        const role: RoleSummary = RoleSummarySchema.parse({
          name: 'VENDOR',
          description: 'Automotive dealership manager',
          isSystem: false,
        });
        expect(role.name).toBe('VENDOR');
        expect(role.description).toBe('Automotive dealership manager');
        expect(role.isSystem).toBe(false);

        const sysRole = RoleSummarySchema.parse({
          name: 'CUSTOMER',
          description: null,
          isSystem: true,
        });
        expect(sysRole.description).toBeNull();
      });

      it('rejects empty name or invalid description types', () => {
        expect(() =>
          RoleSummarySchema.parse({
            name: '',
            description: null,
            isSystem: true,
          })
        ).toThrow();

        expect(() =>
          RoleSummarySchema.parse({
            name: 'ROLE',
            description: 123,
            isSystem: true,
          })
        ).toThrow();
      });
    });

    describe('UserProfileSchema & UserProfileResponseSchema', () => {
      it('accepts complete valid user profile fixture', () => {
        const parsed: UserProfile = UserProfileSchema.parse(validUserProfileFixture);
        expect(parsed.publicId).toBe(validUserProfileFixture.publicId);
        expect(parsed.email).toBe(validUserProfileFixture.email);
        expect(parsed.status).toBe('ACTIVE');
        expect(parsed.accountType).toBe('CUSTOMER');
        expect(parsed.roles).toHaveLength(1);
      });

      it('preserves nullable fields as null when unset', () => {
        const minimalProfile: UserProfile = {
          publicId: 'usr_01h7x9k3p0000000000000002',
          email: 'minimal@example.com',
          phone: null,
          firstName: null,
          lastName: null,
          status: 'PENDING',
          locale: 'en',
          emailVerifiedAt: null,
          phoneVerifiedAt: null,
          kycStatus: 'NOT_SUBMITTED',
          kycApprovedAt: null,
          kycRejectionReason: null,
          lastLoginAt: null,
          createdAt: '2026-01-01T12:00:00.000Z',
          avatarUrl: null,
          accountType: 'CUSTOMER',
          roles: [],
          permissions: [],
        };

        const parsed = UserProfileSchema.parse(minimalProfile);
        expect(parsed.phone).toBeNull();
        expect(parsed.firstName).toBeNull();
        expect(parsed.lastName).toBeNull();
        expect(parsed.emailVerifiedAt).toBeNull();
        expect(parsed.avatarUrl).toBeNull();
      });

      it('strictly enforces nullable fields: omitting required nullable fields fails', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { phone: _, ...missingPhone } = validUserProfileFixture;
        expect(() => UserProfileSchema.parse(missingPhone)).toThrow();
      });

      it('rejects numeric user IDs in publicId', () => {
        expect(() =>
          UserProfileSchema.parse({
            ...validUserProfileFixture,
            publicId: 12345,
          })
        ).toThrow();
      });

      it('rejects malformed emails in profile', () => {
        expect(() =>
          UserProfileSchema.parse({
            ...validUserProfileFixture,
            email: 'not-an-email',
          })
        ).toThrow();
      });

      it('rejects invalid user status', () => {
        expect(() =>
          UserProfileSchema.parse({
            ...validUserProfileFixture,
            status: 'BANNED',
          })
        ).toThrow();
      });

      it('validates UserProfileResponse envelope', () => {
        const response: UserProfileResponse = UserProfileResponseSchema.parse({
          data: validUserProfileFixture,
        });
        expect(response.data.publicId).toBe(validUserProfileFixture.publicId);
      });
    });

    describe('normalizeUserProfile', () => {
      it('strips upstream numeric id and roleId while retaining valid fields', () => {
        const rawUpstream = {
          id: 42,
          publicId: 'usr_01h7x9k3p0000000000000001',
          email: 'upstream@example.com',
          phone: '+201012345678',
          firstName: 'Upstream',
          lastName: 'User',
          status: 'ACTIVE',
          locale: 'ar',
          emailVerifiedAt: '2026-01-01T12:00:00.000Z',
          phoneVerifiedAt: null,
          kycStatus: 'NOT_SUBMITTED',
          kycApprovedAt: null,
          kycRejectionReason: null,
          lastLoginAt: null,
          createdAt: '2026-01-01T10:00:00.000Z',
          avatarUrl: null,
          accountType: 'CUSTOMER',
          roles: [
            {
              roleId: 99,
              name: 'CUSTOMER',
              description: 'Standard customer',
              isSystem: true,
            },
          ],
          permissions: ['listing:read'],
        };

        const normalized = normalizeUserProfile(rawUpstream);
        expect(normalized.publicId).toBe('usr_01h7x9k3p0000000000000001');
        expect(normalized.roles[0]?.name).toBe('CUSTOMER');
        expect('id' in normalized).toBe(false);
        expect('roleId' in (normalized.roles[0] ?? {})).toBe(false);
      });
    });
  });

  describe('4. Phone Verification and Profile Mutation Contracts', () => {
    describe('SetPhoneInputSchema', () => {
      it('accepts valid phone input and rejects unknown keys', () => {
        const input: SetPhoneInput = SetPhoneInputSchema.parse({
          phone: '+201012345678',
        });
        expect(input.phone).toBe('+201012345678');

        expect(() =>
          SetPhoneInputSchema.parse({
            phone: '+201012345678',
            extraKey: 'malicious',
          })
        ).toThrow();
      });
    });

    describe('VerifyFirebasePhoneInputSchema', () => {
      it('accepts idToken and optional/nullable phone', () => {
        const input: VerifyFirebasePhoneInput = VerifyFirebasePhoneInputSchema.parse({
          idToken: 'mock_firebase_id_token_12345',
          phone: '+201012345678',
        });
        expect(input.idToken).toBe('mock_firebase_id_token_12345');
        expect(input.phone).toBe('+201012345678');

        const inputNullPhone = VerifyFirebasePhoneInputSchema.parse({
          idToken: 'mock_firebase_id_token_12345',
          phone: null,
        });
        expect(inputNullPhone.phone).toBeNull();
      });
    });

    describe('VerifiedPhoneUserSchema & VerifiedPhoneUserResponseSchema', () => {
      it('validates verified phone user envelope', () => {
        const data: VerifiedPhoneUser = {
          publicId: 'usr_01h7x9k3p0000000000000001',
          phone: '+201012345678',
          phoneVerifiedAt: '2026-01-01T12:00:00.000Z',
        };
        const parsedUser: VerifiedPhoneUser = VerifiedPhoneUserSchema.parse(data);
        expect(parsedUser.publicId).toBe('usr_01h7x9k3p0000000000000001');

        const response: VerifiedPhoneUserResponse = VerifiedPhoneUserResponseSchema.parse({ data });
        expect(response.data.phoneVerifiedAt).toBe('2026-01-01T12:00:00.000Z');
      });
    });

    describe('UpdateProfileInputSchema', () => {
      it('accepts partial valid profile updates', () => {
        const update1: UpdateProfileInput = UpdateProfileInputSchema.parse({
          firstName: 'Omar',
        });
        expect(update1.firstName).toBe('Omar');

        const update2: UpdateProfileInput = UpdateProfileInputSchema.parse({
          phone: '+201112223334',
          locale: 'en',
          avatarFileId: 'fil_01h7x9k3p0000000000000001',
        });
        expect(update2.locale).toBe('en');

        const updateResetAvatar: UpdateProfileInput = UpdateProfileInputSchema.parse({
          avatarFileId: null,
        });
        expect(updateResetAvatar.avatarFileId).toBeNull();
      });

      it('rejects empty update object (at least one field required)', () => {
        expect(() => UpdateProfileInputSchema.parse({})).toThrow();
      });

      it('rejects null for non-nullable optional fields (e.g. phone: null)', () => {
        expect(() => UpdateProfileInputSchema.parse({ phone: null })).toThrow();
        expect(() => UpdateProfileInputSchema.parse({ firstName: null })).toThrow();
      });

      it('rejects unknown fields (.strict())', () => {
        expect(() =>
          UpdateProfileInputSchema.parse({
            firstName: 'Omar',
            isAdmin: true,
          })
        ).toThrow();
      });
    });

    describe('VendorMembershipSchema', () => {
      it('accepts valid vendor membership records', () => {
        const membership: VendorMembership = VendorMembershipSchema.parse({
          vendorPublicId: 'vdr_01h7x9k3p0000000000000001',
          role: 'OWNER',
          joinedAt: '2026-01-01T10:00:00.000Z',
          status: 'ACTIVE',
        });
        expect(membership.role).toBe('OWNER');
        expect(membership.status).toBe('ACTIVE');
      });

      it('validates vendor roles and membership statuses using their enum schemas', () => {
        const roles = ['OWNER', 'MANAGER', 'STAFF', 'VIEWER'] as const;
        for (const r of roles) {
          expect(VendorRoleSchema.parse(r)).toBe(r);
        }
        const statuses = ['ACTIVE', 'INVITED', 'SUSPENDED'] as const;
        for (const s of statuses) {
          expect(VendorMembershipStatusSchema.parse(s)).toBe(s);
        }
      });

      it('rejects invalid vendor roles or statuses', () => {
        expect(() =>
          VendorMembershipSchema.parse({
            vendorPublicId: 'vdr_01h7x9k3p0000000000000001',
            role: 'SUPERADMIN',
            joinedAt: '2026-01-01T10:00:00.000Z',
            status: 'ACTIVE',
          })
        ).toThrow();

        expect(() =>
          VendorMembershipSchema.parse({
            vendorPublicId: 'vdr_01h7x9k3p0000000000000001',
            role: 'OWNER',
            joinedAt: '2026-01-01T10:00:00.000Z',
            status: 'UNKNOWN',
          })
        ).toThrow();
      });
    });
  });

  describe('5. Credentials, Session View, and Projection (BDD Acceptance Criteria)', () => {
    describe('UpstreamTokenResponseSchema & ServerCredentialsSchema', () => {
      it('accepts valid upstream token responses', () => {
        const tokens: UpstreamTokenResponse = UpstreamTokenResponseSchema.parse(validTokenResponseFixture);
        expect(tokens.accessToken).toBe(validTokenResponseFixture.accessToken);
        expect(tokens.refreshToken).toBe(validTokenResponseFixture.refreshToken);
        expect(tokens.expiresIn).toBe(900);

        const serverCreds: ServerCredentials = ServerCredentialsSchema.parse(validTokenResponseFixture);
        expect(serverCreds.accessToken).toBe(validTokenResponseFixture.accessToken);
      });

      it('rejects empty tokens or non-positive expiration', () => {
        expect(() =>
          UpstreamTokenResponseSchema.parse({
            accessToken: '',
            refreshToken: 'refresh',
            expiresIn: 900,
          })
        ).toThrow();

        expect(() =>
          UpstreamTokenResponseSchema.parse({
            accessToken: 'access',
            refreshToken: '',
            expiresIn: 900,
          })
        ).toThrow();

        expect(() =>
          UpstreamTokenResponseSchema.parse({
            accessToken: 'access',
            refreshToken: 'refresh',
            expiresIn: 0,
          })
        ).toThrow();

        expect(() =>
          UpstreamTokenResponseSchema.parse({
            accessToken: 'access',
            refreshToken: 'refresh',
            expiresIn: -100,
          })
        ).toThrow();
      });
    });

    describe('SafeSessionSchema, SessionViewSchema, and SessionResponseSchema', () => {
      it('accepts valid safe session with isAuthenticated: true', () => {
        const session: SafeSession = SafeSessionSchema.parse({
          user: validUserProfileFixture,
          signInMethod: 'EMAIL_PASSWORD',
          isAuthenticated: true,
        });
        expect(session.isAuthenticated).toBe(true);
        expect(session.user.email).toBe(validUserProfileFixture.email);
      });

      it('rejects session if isAuthenticated is false', () => {
        expect(() =>
          SafeSessionSchema.parse({
            user: validUserProfileFixture,
            signInMethod: 'EMAIL_PASSWORD',
            isAuthenticated: false,
          })
        ).toThrow();
      });

      it('accepts null data in SessionResponse for unauthenticated visitors', () => {
        const unauth: SessionResponse = SessionResponseSchema.parse({ data: null });
        expect(unauth.data).toBeNull();
      });
    });

    describe('createSafeSession and projectSafeSession projection', () => {
      it('GIVEN upstream login response WHEN safe projection runs THEN credentials remain server-only and client session has no tokens', () => {
        const upstreamTokens = {
          accessToken: 'upstream.access.token.secret',
          refreshToken: 'upstream.refresh.token.secret',
          expiresIn: 900,
        };

        const { credentials, session } = projectSafeSession(
          upstreamTokens,
          validUserProfileFixture,
          'EMAIL_PASSWORD'
        );

        // Credentials contain the server-only tokens
        expect(credentials.accessToken).toBe('upstream.access.token.secret');
        expect(credentials.refreshToken).toBe('upstream.refresh.token.secret');

        // Safe Session contains user and status, but ZERO token material
        expect(session.isAuthenticated).toBe(true);
        expect(session.signInMethod).toBe('EMAIL_PASSWORD');
        expect(session.user.publicId).toBe(validUserProfileFixture.publicId);

        // Verify runtime absence of credentials on the projected session
        expect('accessToken' in session).toBe(false);
        expect('refreshToken' in session).toBe(false);
        expect('password' in (session.user as unknown as Record<string, unknown>)).toBe(false);

        // Validate session matches SessionViewSchema
        const validatedView: SessionView = SessionViewSchema.parse(session);
        expect(validatedView.isAuthenticated).toBe(true);
      });

      it('rejects projection when upstream user profile is malformed', () => {
        const upstreamTokens = validTokenResponseFixture;
        const malformedUser = {
          ...validUserProfileFixture,
          email: 'not-an-email',
        };

        expect(() => projectSafeSession(upstreamTokens, malformedUser)).toThrow();
      });

      it('rejects projection when upstream tokens are malformed', () => {
        const invalidTokens = {
          accessToken: '',
          refreshToken: 'valid',
          expiresIn: -1,
        };

        expect(() => projectSafeSession(invalidTokens, validUserProfileFixture)).toThrow();
      });
    });
  });

  describe('6. Authentication Input Schemas', () => {
    describe('LoginInputSchema', () => {
      it('accepts valid credentials and normalizes email', () => {
        const input: LoginInput = LoginInputSchema.parse({
          email: '  User@Example.Com  ',
          password: 'Password123',
          returnTo: '/ar/me/listings',
        });
        expect(input.email).toBe('user@example.com');
        expect(input.password).toBe('Password123');
        expect(input.returnTo).toBe('/ar/me/listings');
      });

      it('rejects unknown keys (.strict())', () => {
        expect(() =>
          LoginInputSchema.parse({
            email: 'user@example.com',
            password: 'Password123',
            returnTo: null,
            role: 'ADMIN',
          })
        ).toThrow();
      });

      it('rejects open redirect returnTo targets', () => {
        expect(() =>
          LoginInputSchema.parse({
            email: 'user@example.com',
            password: 'Password123',
            returnTo: 'https://evil.com',
          })
        ).toThrow();

        expect(() =>
          LoginInputSchema.parse({
            email: 'user@example.com',
            password: 'Password123',
            returnTo: '/\\evil.example',
          })
        ).toThrow();
      });
    });

    describe('RegisterInputSchema', () => {
      it('accepts valid customer registration', () => {
        const input: RegisterInput = RegisterInputSchema.parse({
          firstName: '  Youssef  ',
          lastName: '  Ibrahim  ',
          email: '  Youssef@Example.COM  ',
          password: 'Password123',
          confirmPassword: 'Password123',
          accountType: 'CUSTOMER',
          returnTo: null,
        });
        expect(input.firstName).toBe('Youssef');
        expect(input.lastName).toBe('Ibrahim');
        expect(input.email).toBe('youssef@example.com');
        expect(input.accountType).toBe('CUSTOMER');
      });

      it('accepts valid vendor registration', () => {
        const input: RegisterInput = RegisterInputSchema.parse({
          firstName: 'Hany',
          lastName: 'Auto',
          email: 'hany@dealers.com',
          password: 'Password123',
          confirmPassword: 'Password123',
          accountType: 'VENDOR',
          returnTo: '/ar/me/dashboard',
        });
        expect(input.accountType).toBe('VENDOR');
      });

      it('strictly rejects ADMIN accountType on registration', () => {
        expect(() =>
          RegisterInputSchema.parse({
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@system.com',
            password: 'Password123',
            confirmPassword: 'Password123',
            accountType: 'ADMIN',
            returnTo: null,
          })
        ).toThrow();
      });

      it('rejects registration when passwords do not match', () => {
        expect(() =>
          RegisterInputSchema.parse({
            firstName: 'Ahmed',
            lastName: 'Ali',
            email: 'ahmed@example.com',
            password: 'Password123',
            confirmPassword: 'DifferentPassword1',
            accountType: 'CUSTOMER',
            returnTo: null,
          })
        ).toThrow();
      });

      it('rejects registration with weak passwords', () => {
        expect(() =>
          RegisterInputSchema.parse({
            firstName: 'Ahmed',
            lastName: 'Ali',
            email: 'ahmed@example.com',
            password: 'weak',
            confirmPassword: 'weak',
            accountType: 'CUSTOMER',
            returnTo: null,
          })
        ).toThrow();
      });

      it('rejects unknown keys (.strict())', () => {
        expect(() =>
          RegisterInputSchema.parse({
            firstName: 'Ahmed',
            lastName: 'Ali',
            email: 'ahmed@example.com',
            password: 'Password123',
            confirmPassword: 'Password123',
            accountType: 'CUSTOMER',
            returnTo: null,
            roleId: 1,
          })
        ).toThrow();
      });
    });

    describe('GoogleLoginInputSchema & AppleLoginInputSchema', () => {
      it('accepts valid Google login inputs and rejects ADMIN', () => {
        const googleInput: GoogleLoginInput = GoogleLoginInputSchema.parse({
          idToken: 'mock_google_id_token_123',
          accountType: 'CUSTOMER',
          returnTo: '/ar',
        });
        expect(googleInput.idToken).toBe('mock_google_id_token_123');

        expect(() =>
          GoogleLoginInputSchema.parse({
            idToken: 'mock_token',
            accountType: 'ADMIN',
            returnTo: null,
          })
        ).toThrow();
      });

      it('accepts valid Apple login inputs and rejects ADMIN', () => {
        const appleInput: AppleLoginInput = AppleLoginInputSchema.parse({
          identityToken: 'mock_apple_identity_token_456',
          firstName: 'Karim',
          lastName: null,
          accountType: 'VENDOR',
          returnTo: null,
        });
        expect(appleInput.identityToken).toBe('mock_apple_identity_token_456');
        expect(appleInput.firstName).toBe('Karim');
        expect(appleInput.lastName).toBeNull();

        expect(() =>
          AppleLoginInputSchema.parse({
            identityToken: 'mock_token',
            firstName: null,
            lastName: null,
            accountType: 'ADMIN',
            returnTo: null,
          })
        ).toThrow();
      });
    });

    describe('OTP and Password Recovery Schemas', () => {
      describe('OtpSendInputSchema & OtpVerifyInputSchema', () => {
        it('accepts all three documented OTP purposes', () => {
          const purposes: OtpPurpose[] = ['EMAIL_VERIFY', 'PASSWORD_RESET', 'PHONE_VERIFY'];
          for (const purpose of purposes) {
            expect(OtpPurposeSchema.parse(purpose)).toBe(purpose);
            const sendInput: OtpSendInput = OtpSendInputSchema.parse({ purpose });
            expect(sendInput.purpose).toBe(purpose);

            const verifyInput: OtpVerifyInput = OtpVerifyInputSchema.parse({
              purpose,
              code: '123456',
            });
            expect(verifyInput.code).toBe('123456');
          }
        });

        it('rejects invalid OTP purpose or invalid code', () => {
          expect(() => OtpSendInputSchema.parse({ purpose: 'LOGIN' })).toThrow();
          expect(() =>
            OtpVerifyInputSchema.parse({
              purpose: 'EMAIL_VERIFY',
              code: '123',
            })
          ).toThrow();
        });
      });

      describe('ForgotPasswordInputSchema', () => {
        it('accepts email and normalizes', () => {
          const input: ForgotPasswordInput = ForgotPasswordInputSchema.parse({
            email: '  User@Example.COM  ',
          });
          expect(input.email).toBe('user@example.com');
        });
      });

      describe('VerifyResetCodeInputSchema', () => {
        it('accepts valid flow and 6-digit code', () => {
          const input: VerifyResetCodeInput = VerifyResetCodeInputSchema.parse({
            flow: 'flow_reset_1234567890abcdef',
            code: '654321',
          });
          expect(input.code).toBe('654321');
        });

        it('rejects short flow or invalid code', () => {
          expect(() =>
            VerifyResetCodeInputSchema.parse({
              flow: 'short',
              code: '654321',
            })
          ).toThrow();

          expect(() =>
            VerifyResetCodeInputSchema.parse({
              flow: 'flow_reset_1234567890abcdef',
              code: '65432',
            })
          ).toThrow();
        });
      });

      describe('ResetPasswordInputSchema', () => {
        it('accepts valid reset password input', () => {
          const input: ResetPasswordInput = ResetPasswordInputSchema.parse({
            flow: 'flow_reset_1234567890abcdef',
            code: '654321',
            newPassword: 'NewPassword123',
            confirmPassword: 'NewPassword123',
          });
          expect(input.newPassword).toBe('NewPassword123');
        });

        it('rejects password mismatch on reset', () => {
          expect(() =>
            ResetPasswordInputSchema.parse({
              flow: 'flow_reset_1234567890abcdef',
              code: '654321',
              newPassword: 'NewPassword123',
              confirmPassword: 'DifferentPass123',
            })
          ).toThrow();
        });
      });

      describe('ChangePasswordInputSchema', () => {
        it('accepts valid change password input', () => {
          const input: ChangePasswordInput = ChangePasswordInputSchema.parse({
            currentPassword: 'OldPassword123',
            newPassword: 'NewPassword456',
            confirmPassword: 'NewPassword456',
          });
          expect(input.currentPassword).toBe('OldPassword123');
          expect(input.newPassword).toBe('NewPassword456');
        });

        it('rejects password mismatch on change', () => {
          expect(() =>
            ChangePasswordInputSchema.parse({
              currentPassword: 'OldPassword123',
              newPassword: 'NewPassword456',
              confirmPassword: 'MismatchPassword789',
            })
          ).toThrow();
        });
      });

      describe('DeleteAccountInputSchema', () => {
        it('accepts password and optional reason', () => {
          const input: DeleteAccountInput = DeleteAccountInputSchema.parse({
            password: 'CurrentPassword123',
            reason: 'Closing personal automotive inventory',
          });
          expect(input.password).toBe('CurrentPassword123');
          expect(input.reason).toBe('Closing personal automotive inventory');

          const inputNullReason = DeleteAccountInputSchema.parse({
            password: 'CurrentPassword123',
            reason: null,
          });
          expect(inputNullReason.reason).toBeNull();
        });

        it('rejects reason exceeding 500 characters', () => {
          expect(() =>
            DeleteAccountInputSchema.parse({
              password: 'Password123',
              reason: 'a'.repeat(501),
            })
          ).toThrow();
        });
      });
    });
  });

  describe('7. Claims Contracts', () => {
    describe('AuthClaimsSchema', () => {
      it('accepts valid Fastify JWT token claims', () => {
        const claims: AuthClaims = AuthClaimsSchema.parse({
          sub: 42,
          sid: 'sess_01h7x9k3p0000000000000001',
          email: 'user@example.com',
          emailVerified: true,
          phoneVerified: true,
          roles: ['CUSTOMER'],
          mfaAt: 1700000000,
          iat: 1700000000,
          exp: 1700000900,
          iss: 'arabiyatmart-api',
          aud: 'arabiyatmart-mobile',
        });
        expect(claims.sub).toBe(42);
        expect(claims.sid).toBe('sess_01h7x9k3p0000000000000001');
      });

      it('rejects missing sid or non-positive sub', () => {
        expect(() =>
          AuthClaimsSchema.parse({
            sub: -1,
            sid: 'sess_01',
            emailVerified: true,
            phoneVerified: true,
            roles: ['CUSTOMER'],
          })
        ).toThrow();
      });
    });

    describe('SessionClaimsSchema', () => {
      it('accepts safe session claims', () => {
        const claims: SessionClaims = SessionClaimsSchema.parse({
          sessionId: 'sess_01h7x9k3p0000000000000001',
          roles: ['VENDOR'],
          emailVerified: true,
          phoneVerified: false,
        });
        expect(claims.sessionId).toBe('sess_01h7x9k3p0000000000000001');
      });
    });
  });

  describe('8. Edge Cases & Account Lifecycle States (Step 5)', () => {
    it('correctly handles suspended account state fixture', () => {
      const suspendedUser: UserProfile = {
        ...validUserProfileFixture,
        status: 'SUSPENDED',
      };
      const parsed = UserProfileSchema.parse(suspendedUser);
      expect(parsed.status).toBe('SUSPENDED');
    });

    it('correctly handles deleted account state fixture', () => {
      const deletedUser: UserProfile = {
        ...validUserProfileFixture,
        status: 'DELETED',
      };
      const parsed = UserProfileSchema.parse(deletedUser);
      expect(parsed.status).toBe('DELETED');
    });

    it('correctly handles unverified email and unverified phone fixtures', () => {
      const unverifiedUser: UserProfile = {
        ...validUserProfileFixture,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
      };
      const parsed = UserProfileSchema.parse(unverifiedUser);
      expect(parsed.emailVerifiedAt).toBeNull();
      expect(parsed.phoneVerifiedAt).toBeNull();
    });

    it('createSafeSessionView produces identical result to createSafeSession', () => {
      const session1 = createSafeSession(validUserProfileFixture, 'GOOGLE');
      const session2 = createSafeSessionView(validUserProfileFixture, 'GOOGLE');
      expect(session1).toEqual(session2);
    });
  });
});
