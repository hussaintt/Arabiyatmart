import type {
  RegistrationAccountType,
  SignInMethod,
} from './common';
import type { UserProfile } from './profile';

export type { RegistrationAccountType, SignInMethod };

export interface UpstreamTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type ServerCredentials = UpstreamTokenResponse;

export interface SafeSession {
  user: UserProfile;
  signInMethod: SignInMethod;
  isAuthenticated: true;
}

export type SessionView = SafeSession;

export interface SessionResponse {
  data: SafeSession | null;
}

export interface LoginInput {
  email: string;
  password: string;
  returnTo: string | null;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: 'CUSTOMER' | 'VENDOR';
  returnTo: string | null;
}

export interface GoogleLoginInput {
  idToken: string;
  accountType: 'CUSTOMER' | 'VENDOR';
  returnTo: string | null;
}

export interface AppleLoginInput {
  identityToken: string;
  firstName: string | null;
  lastName: string | null;
  accountType: 'CUSTOMER' | 'VENDOR';
  returnTo: string | null;
}

export type OtpPurpose = 'EMAIL_VERIFY' | 'PASSWORD_RESET' | 'PHONE_VERIFY';

export interface OtpSendInput {
  purpose: OtpPurpose;
}

export interface OtpVerifyInput {
  purpose: OtpPurpose;
  code: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface VerifyResetCodeInput {
  flow: string;
  code: string;
}

export interface ResetPasswordInput {
  flow: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface DeleteAccountInput {
  password: string;
  reason: string | null;
}

export interface AuthClaims {
  sub: number;
  sid: string;
  email?: string | undefined;
  emailVerified: boolean;
  phoneVerified: boolean;
  roles: string[];
  mfaAt?: number | undefined;
  iat?: number | undefined;
  exp?: number | undefined;
  iss?: string | undefined;
  aud?: string | string[] | undefined;
}

export interface SessionClaims {
  sessionId: string;
  roles: string[];
  emailVerified: boolean;
  phoneVerified: boolean;
}

export type AuthProvider = 'EMAIL' | 'GOOGLE' | 'APPLE';
