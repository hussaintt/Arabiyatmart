import { z } from 'zod';
import type {
  CountResponse,
  CursorMeta,
  MessageResponse,
  MutationAckResponse,
  PageMeta,
} from '@/types/common';
import {
  HttpStatusSchema,
  JsonPrimitiveSchema,
  JsonValueSchema,
  FieldErrorSchema,
  ApiErrorBodySchema,
  OperationErrorSchema,
  ApiContractError,
  actionResultSchema,
} from './error';

export const LocaleSchema = z.enum(['ar', 'en']);
export const AccountTypeSchema = z.enum(['CUSTOMER', 'VENDOR', 'ADMIN']);
export const RegistrationAccountTypeSchema = z.enum(['CUSTOMER', 'VENDOR']);
export const UserStatusSchema = z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED']);
export const KycStatusSchema = z.enum(['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED']);
export const SignInMethodSchema = z.enum(['EMAIL_PASSWORD', 'GOOGLE', 'APPLE', 'OTP', 'RESTORED']);

export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const PublicIdSchema = z.string().trim().min(1).max(128);
export const SlugSchema = z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const CurrencySchema = z.string().trim().length(3).regex(/^[A-Z]{3}$/);
export const MoneyCentsSchema = z.number().int().safe().nonnegative();
export const PositiveMoneyCentsSchema = z.number().int().safe().positive();

export const LocalizedTextSchema = z.object({ ar: z.string(), en: z.string() });
export const PartialLocalizedTextSchema = z.object({ ar: z.string().optional(), en: z.string().optional() }).strict();
export const AtLeastOneLocalizedTextSchema = PartialLocalizedTextSchema.refine(
  (value) => value.ar !== undefined || value.en !== undefined,
  'At least one localized value is required'
);

export const CursorMetaSchema: z.ZodType<CursorMeta> = z.object({
  hasMore: z.boolean(),
  nextCursor: z.string().min(1).nullable(),
});

export const PageMetaSchema: z.ZodType<PageMeta> = z.object({
  total: z.number().int().nonnegative().nullable(),
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(100),
  hasMore: z.boolean(),
});

export const MessageResponseSchema: z.ZodType<MessageResponse> = z.object({ message: z.string() });
export const CountResponseSchema: z.ZodType<CountResponse> = z.object({ count: z.number().int().nonnegative() });
export const MutationAckResponseSchema: z.ZodType<MutationAckResponse> = z.object({ ok: z.literal(true) });

export {
  HttpStatusSchema,
  JsonPrimitiveSchema,
  JsonValueSchema,
  FieldErrorSchema,
  ApiErrorBodySchema,
  OperationErrorSchema,
  ApiContractError,
  actionResultSchema,
};
