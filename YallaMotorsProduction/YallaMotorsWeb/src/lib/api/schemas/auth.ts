import { z } from 'zod';
import {
  RegistrationAccountTypeSchema,
  SignInMethodSchema,
} from '@/lib/api/schemas/common';
import {
  UserProfileSchema,
} from './profile';
import type {
  AppleLoginInput,
  AuthClaims,
  ChangePasswordInput,
  DeleteAccountInput,
  ForgotPasswordInput,
  GoogleLoginInput,
  LoginInput,
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
import type { UserProfile } from '@/types/profile';
import type { SignInMethod } from '@/types/common';

export const EmailSchema = z.string().trim().toLowerCase().email().max(254);

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-z]/, 'Requires a lowercase letter')
  .regex(/[A-Z]/, 'Requires an uppercase letter')
  .regex(/[0-9]/, 'Requires a number');

export const OtpCodeSchema = z.string().regex(/^\d{6}$/, 'OTP code must be exactly 6 digits');

export const ReturnToSchema = z
  .string()
  .max(2048)
  .nullable()
  .refine(
    (value) => {
      if (value === null) return true;
      if (
        !value.startsWith('/') ||
        value.startsWith('//') ||
        value.includes('\\') ||
        /%5[cC]/i.test(value) ||
        /[\u0000-\u001F]/.test(value)
      ) {
        return false;
      }
      try {
        const dummyOrigin = 'https://arabiyatmart.internal';
        const parsed = new URL(value, dummyOrigin);
        return parsed.origin === dummyOrigin;
      } catch {
        return false;
      }
    },
    'returnTo must be a safe relative application path'
  );

export const ResetFlowSchema = z.string().min(16).max(512);

export const OtpPurposeSchema = z.enum(['EMAIL_VERIFY', 'PASSWORD_RESET', 'PHONE_VERIFY']);

export const UpstreamTokenResponseSchema: z.ZodType<UpstreamTokenResponse> = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().positive().finite(),
});

export const ServerCredentialsSchema: z.ZodType<ServerCredentials> = UpstreamTokenResponseSchema;

export const SafeSessionSchema: z.ZodType<SafeSession> = z.object({
  user: UserProfileSchema,
  signInMethod: SignInMethodSchema,
  isAuthenticated: z.literal(true),
});

export const SessionViewSchema: z.ZodType<SessionView> = SafeSessionSchema;

export const SessionResponseSchema: z.ZodType<SessionResponse> = z.object({
  data: SafeSessionSchema.nullable(),
});

export const LoginInputSchema: z.ZodType<LoginInput> = z
  .object({
    email: EmailSchema,
    password: z.string().min(1).max(128),
    returnTo: ReturnToSchema,
  })
  .strict();

export const RegisterInputSchema: z.ZodType<RegisterInput> = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(80),
    lastName: z.string().trim().min(1, 'Last name is required').max(80),
    email: EmailSchema,
    password: PasswordSchema,
    confirmPassword: z.string().min(1).max(128),
    accountType: RegistrationAccountTypeSchema,
    returnTo: ReturnToSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
    }
  });

export const GoogleLoginInputSchema: z.ZodType<GoogleLoginInput> = z
  .object({
    idToken: z.string().trim().min(1).max(8192),
    accountType: RegistrationAccountTypeSchema,
    returnTo: ReturnToSchema,
  })
  .strict();

export const AppleLoginInputSchema: z.ZodType<AppleLoginInput> = z
  .object({
    identityToken: z.string().trim().min(1).max(8192),
    firstName: z.string().trim().min(1).max(80).nullable(),
    lastName: z.string().trim().min(1).max(80).nullable(),
    accountType: RegistrationAccountTypeSchema,
    returnTo: ReturnToSchema,
  })
  .strict();

export const OtpSendInputSchema: z.ZodType<OtpSendInput> = z
  .object({
    purpose: OtpPurposeSchema,
  })
  .strict();

export const OtpVerifyInputSchema: z.ZodType<OtpVerifyInput> = z
  .object({
    purpose: OtpPurposeSchema,
    code: OtpCodeSchema,
  })
  .strict();

export const ForgotPasswordInputSchema: z.ZodType<ForgotPasswordInput> = z
  .object({
    email: EmailSchema,
  })
  .strict();

export const VerifyResetCodeInputSchema: z.ZodType<VerifyResetCodeInput> = z
  .object({
    flow: ResetFlowSchema,
    code: OtpCodeSchema,
  })
  .strict();

export const ResetPasswordInputSchema: z.ZodType<ResetPasswordInput> = z
  .object({
    flow: ResetFlowSchema,
    code: OtpCodeSchema,
    newPassword: PasswordSchema,
    confirmPassword: z.string().min(1).max(128),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
    }
  });

export const ChangePasswordInputSchema: z.ZodType<ChangePasswordInput> = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: PasswordSchema,
    confirmPassword: z.string().min(1).max(128),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
    }
  });

export const DeleteAccountInputSchema: z.ZodType<DeleteAccountInput> = z
  .object({
    password: z.string().min(1).max(128),
    reason: z.string().trim().max(500).nullable(),
  })
  .strict();

export const AuthClaimsSchema: z.ZodType<AuthClaims> = z.object({
  sub: z.number().int().positive(),
  sid: z.string().min(1),
  email: z.string().email().optional(),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  roles: z.array(z.string()),
  mfaAt: z.number().int().positive().optional(),
  iat: z.number().int().positive().optional(),
  exp: z.number().int().positive().optional(),
  iss: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
});

export const SessionClaimsSchema: z.ZodType<SessionClaims> = z.object({
  sessionId: z.string().min(1),
  roles: z.array(z.string()),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
});

export function createSafeSession(
  user: UserProfile,
  signInMethod: SignInMethod = 'EMAIL_PASSWORD'
): SafeSession {
  return {
    user: UserProfileSchema.parse(user),
    signInMethod: SignInMethodSchema.parse(signInMethod),
    isAuthenticated: true,
  };
}

export const createSafeSessionView = createSafeSession;

export function projectSafeSession(
  tokens: unknown,
  user: unknown,
  signInMethod: SignInMethod = 'EMAIL_PASSWORD'
): { credentials: UpstreamTokenResponse; session: SessionView } {
  const credentials = UpstreamTokenResponseSchema.parse(tokens);
  const validatedUser = UserProfileSchema.parse(user);
  const session = createSafeSession(validatedUser, signInMethod);
  return { credentials, session };
}
