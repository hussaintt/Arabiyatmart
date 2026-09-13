import { z } from 'zod';
import {
  AccountTypeSchema,
  IsoDateTimeSchema,
  LocaleSchema,
  PublicIdSchema,
  UserStatusSchema,
  KycStatusSchema,
} from '@/lib/api/schemas/common';
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

export const E164Schema = z
  .string()
  .trim()
  .regex(
    /^\+[1-9][0-9]{7,14}$/,
    'Phone number must be a valid E.164 string with country code (e.g. +201012345678)'
  );

export const RoleSummarySchema: z.ZodType<RoleSummary> = z.object({
  name: z.string().trim().min(1),
  description: z.string().nullable(),
  isSystem: z.boolean(),
});

export const UserProfileSchema: z.ZodType<UserProfile> = z.object({
  publicId: PublicIdSchema,
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().nullable(),
  firstName: z.string().trim().nullable(),
  lastName: z.string().trim().nullable(),
  status: UserStatusSchema,
  locale: LocaleSchema,
  emailVerifiedAt: IsoDateTimeSchema.nullable(),
  phoneVerifiedAt: IsoDateTimeSchema.nullable(),
  kycStatus: KycStatusSchema,
  kycApprovedAt: IsoDateTimeSchema.nullable(),
  kycRejectionReason: z.string().nullable(),
  lastLoginAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  avatarUrl: z.string().url().nullable(),
  accountType: AccountTypeSchema,
  roles: z.array(RoleSummarySchema).default([]),
  permissions: z.array(z.string()).default([]),
});

export const UserProfileResponseSchema: z.ZodType<UserProfileResponse> = z.object({
  data: UserProfileSchema,
});

export const SetPhoneInputSchema: z.ZodType<SetPhoneInput> = z
  .object({
    phone: E164Schema,
  })
  .strict();

export const VerifyFirebasePhoneInputSchema: z.ZodType<VerifyFirebasePhoneInput> = z
  .object({
    idToken: z.string().trim().min(1).max(8192),
    phone: E164Schema.nullable(),
  })
  .strict();

export const VerifiedPhoneUserSchema: z.ZodType<VerifiedPhoneUser> = z.object({
  publicId: PublicIdSchema,
  phone: E164Schema.nullable(),
  phoneVerifiedAt: IsoDateTimeSchema,
});

export const VerifiedPhoneUserResponseSchema: z.ZodType<VerifiedPhoneUserResponse> = z.object({
  data: VerifiedPhoneUserSchema,
});

export const UpdateProfileInputSchema: z.ZodType<UpdateProfileInput> = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    phone: E164Schema.optional(),
    locale: LocaleSchema.optional(),
    avatarFileId: PublicIdSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one profile field is required');

export const VendorRoleSchema = z.enum(['OWNER', 'MANAGER', 'STAFF', 'VIEWER']);
export const VendorMembershipStatusSchema = z.enum(['ACTIVE', 'INVITED', 'SUSPENDED']);

export const VendorMembershipSchema: z.ZodType<VendorMembership> = z.object({
  vendorPublicId: PublicIdSchema,
  role: VendorRoleSchema,
  joinedAt: IsoDateTimeSchema,
  status: VendorMembershipStatusSchema,
});

/**
 * Normalizes upstream user payload by stripping internal identifiers
 * (e.g. numeric `id` or `roleId`) before schema validation.
 */
export function normalizeUserProfile(raw: unknown): UserProfile {
  if (typeof raw !== 'object' || raw === null) {
    return UserProfileSchema.parse(raw);
  }
  const rest = { ...(raw as Record<string, unknown>) };
  delete rest.id;
  let roles = rest.roles;
  if (Array.isArray(roles)) {
    roles = roles.map((r) => {
      if (typeof r === 'object' && r !== null) {
        const roleRest = { ...(r as Record<string, unknown>) };
        delete roleRest.roleId;
        return roleRest;
      }
      return r;
    });
  } else {
    roles = [];
  }
  const permissions = Array.isArray(rest.permissions) ? rest.permissions : [];
  return UserProfileSchema.parse({
    ...rest,
    roles,
    permissions,
  });
}
