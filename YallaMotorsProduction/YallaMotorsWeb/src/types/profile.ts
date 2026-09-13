import type {
  AccountType,
  KycStatus,
  Locale,
  UserStatus,
} from './common';

export type { AccountType, KycStatus, Locale, UserStatus };

export interface RoleSummary {
  name: string;
  description: string | null;
  isSystem: boolean;
}

export interface UserProfile {
  publicId: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  status: UserStatus;
  locale: Locale;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  kycStatus: KycStatus;
  kycApprovedAt: string | null;
  kycRejectionReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  avatarUrl: string | null;
  accountType: AccountType;
  roles: RoleSummary[];
  permissions: string[];
}

export interface UserProfileResponse {
  data: UserProfile;
}

export interface SetPhoneInput {
  phone: string;
}

export interface VerifyFirebasePhoneInput {
  idToken: string;
  phone: string | null;
}

export interface VerifiedPhoneUser {
  publicId: string;
  phone: string | null;
  phoneVerifiedAt: string;
}

export interface VerifiedPhoneUserResponse {
  data: VerifiedPhoneUser;
}

export interface UpdateProfileInput {
  firstName?: string | undefined;
  lastName?: string | undefined;
  phone?: string | undefined;
  locale?: Locale | undefined;
  avatarFileId?: string | null | undefined;
}

export type VendorRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'VIEWER';
export type VendorMembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED';

export interface VendorMembership {
  vendorPublicId: string;
  role: VendorRole;
  joinedAt: string;
  status: VendorMembershipStatus;
}
