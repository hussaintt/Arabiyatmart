import { z } from 'zod';
import type {
  CreateListingInput,
  ListingFeedState,
  SellListingDraft,
  SellPhoto,
  SellPhotoStatus,
  SellStep,
  SellWizardState,
  TransitionListingInput,
  UpdateListingInput,
  UpdatePriceInput,
} from '@/types/sell';
import {
  CurrencySchema,
  LocalizedTextSchema,
  PositiveMoneyCentsSchema,
  PublicIdSchema,
} from './common';
import {
  BodyTypeSchema,
  CarConditionSchema,
  ConditionGradeSchema,
  DrivetrainSchema,
  FuelTypeSchema,
  ListingCardSchema,
  ListingTransitionActionSchema,
  TransmissionSchema,
} from './listing';

const OptionalNullableString = z.string().trim().min(1).nullable().optional();

// ── Create & Update Listing Schemas ─────────────────────────────────────────

const CreateListingFieldsSchema = z.object({
  makePublicId: PublicIdSchema,
  modelPublicId: PublicIdSchema,
  generationPublicId: PublicIdSchema.optional(),
  trimPublicId: PublicIdSchema.optional(),
  year: z.number().int().min(1900).max(2100),
  mileageKm: z.number().int().nonnegative(),
  condition: CarConditionSchema,
  conditionGrade: ConditionGradeSchema.nullable().optional(),
  priceCents: PositiveMoneyCentsSchema,
  currency: CurrencySchema.optional(),
  isNegotiable: z.boolean().optional(),
  installmentAvailable: z.boolean().optional(),
  exchangeAccepted: z.boolean().optional(),
  fuelType: FuelTypeSchema,
  transmission: TransmissionSchema,
  bodyType: BodyTypeSchema,
  colorExterior: OptionalNullableString,
  colorInterior: OptionalNullableString,
  engineCc: z.number().int().positive().nullable().optional(),
  powerHp: z.number().int().positive().nullable().optional(),
  seats: z.number().int().positive().max(100).nullable().optional(),
  drivetrain: DrivetrainSchema.nullable().optional(),
  vin: z
    .string()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/)
    .nullable()
    .optional(),
  description: LocalizedTextSchema.nullable().optional(),
  features: z.array(z.string().trim().min(1)).max(200).nullable().optional(),
  cityId: z.number().int().positive(),
  areaId: z.number().int().positive().nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  registrationStatus: OptionalNullableString,
  hasWarranty: z.boolean().optional(),
  hasServiceHistory: z.boolean().optional(),
  contactPhone: OptionalNullableString,
  whatsappPhone: OptionalNullableString,
  allowChat: z.boolean().optional(),
  imageFilePublicIds: z
    .array(PublicIdSchema)
    .max(20)
    .refine((items) => new Set(items).size === items.length, 'Image IDs must be unique')
    .optional(),
  coverImagePublicId: PublicIdSchema.optional(),
  branchPublicId: PublicIdSchema.optional(),
});

export const CreateListingInputSchema: z.ZodType<CreateListingInput> =
  CreateListingFieldsSchema.superRefine((value, context) => {
    if (value.condition === 'NEW' && value.conditionGrade != null) {
      context.addIssue({
        code: 'custom',
        path: ['conditionGrade'],
        message: 'New cars cannot have a used-condition grade',
      });
    }
    if (
      value.coverImagePublicId &&
      !value.imageFilePublicIds?.includes(value.coverImagePublicId)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['coverImagePublicId'],
        message: 'Cover image must be in imageFilePublicIds',
      });
    }
    if (value.areaId && !value.cityId) {
      context.addIssue({
        code: 'custom',
        path: ['areaId'],
        message: 'areaId requires cityId',
      });
    }
    // Cross-field contact requirement: At least one contact channel must be enabled
    const hasPhone = Boolean(value.contactPhone && value.contactPhone.trim().length > 0);
    const hasWhatsapp = Boolean(value.whatsappPhone && value.whatsappPhone.trim().length > 0);
    const hasChat = value.allowChat === true;
    if (!hasPhone && !hasWhatsapp && !hasChat) {
      context.addIssue({
        code: 'custom',
        path: ['contactPhone'],
        message: 'At least one contact method must be provided: phone, WhatsApp, or chat',
      });
    }
  });

export const UpdateListingInputSchema: z.ZodType<UpdateListingInput> =
  CreateListingFieldsSchema.omit({ makePublicId: true, modelPublicId: true })
    .partial()
    .refine(
      (value) => Object.keys(value).length > 0,
      'At least one listing field is required'
    )
    .superRefine((value, context) => {
      if (value.condition === 'NEW' && value.conditionGrade != null) {
        context.addIssue({
          code: 'custom',
          path: ['conditionGrade'],
          message: 'New cars cannot have a used-condition grade',
        });
      }
      if (
        value.coverImagePublicId &&
        value.imageFilePublicIds &&
        !value.imageFilePublicIds.includes(value.coverImagePublicId)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['coverImagePublicId'],
          message: 'Cover image must be in imageFilePublicIds',
        });
      }
      if (value.areaId && !value.cityId) {
        context.addIssue({
          code: 'custom',
          path: ['areaId'],
          message: 'areaId requires cityId',
        });
      }
    });

export const TransitionListingInputSchema: z.ZodType<TransitionListingInput> = z
  .object({
    action: ListingTransitionActionSchema,
    rejectionReason: z.string().trim().min(3).max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.action === 'reject' && !value.rejectionReason) {
      context.addIssue({
        code: 'custom',
        path: ['rejectionReason'],
        message: 'Rejection reason is required',
      });
    }
    if (value.action !== 'reject' && value.rejectionReason) {
      context.addIssue({
        code: 'custom',
        path: ['rejectionReason'],
        message: 'Rejection reason is only valid for reject',
      });
    }
  });

export const UpdatePriceInputSchema: z.ZodType<UpdatePriceInput> = z.object({
  priceCents: PositiveMoneyCentsSchema,
});

// ── Sell Wizard & Draft State ───────────────────────────────────────────────

export const SellStepSchema: z.ZodType<SellStep> = z.enum([
  'condition',
  'vehicle',
  'details',
  'pricing',
  'photos',
  'location',
  'review',
]);

export const SellPhotoStatusSchema: z.ZodType<SellPhotoStatus> = z.enum([
  'PENDING',
  'UPLOADING',
  'PROCESSING',
  'READY',
  'FAILED',
]);

export const SellListingDraftSchema: z.ZodType<SellListingDraft> = z.object({
  condition: CarConditionSchema.nullable(),
  makePublicId: PublicIdSchema.nullable(),
  modelPublicId: PublicIdSchema.nullable(),
  generationPublicId: PublicIdSchema.nullable(),
  trimPublicId: PublicIdSchema.nullable(),
  year: z.number().int().min(1900).max(2100).nullable(),
  mileageKm: z.number().int().nonnegative().nullable(),
  fuelType: FuelTypeSchema.nullable(),
  transmission: TransmissionSchema.nullable(),
  bodyType: BodyTypeSchema.nullable(),
  engineCc: z.number().int().positive().nullable(),
  colorExterior: z.string().nullable(),
  colorInterior: z.string().nullable(),
  features: z.array(z.string()),
  description: z.string().max(5000),
  priceCents: PositiveMoneyCentsSchema.nullable(),
  isNegotiable: z.boolean(),
  installmentAvailable: z.boolean(),
  exchangeAccepted: z.boolean(),
  hasWarranty: z.boolean(),
  hasServiceHistory: z.boolean(),
  cityId: z.number().int().positive().nullable(),
  areaId: z.number().int().positive().nullable(),
  contactPhone: z.string().nullable(),
  whatsappPhone: z.string().nullable(),
  allowChat: z.boolean(),
});

export const SellPhotoSchema: z.ZodType<SellPhoto> = z.object({
  clientId: z.string().min(1),
  localPreviewUrl: z.string(),
  publicId: PublicIdSchema.nullable(),
  url: z.string().url().nullable(),
  status: SellPhotoStatusSchema,
  progress: z.number().min(0).max(1),
});

export const SellWizardStateSchema: z.ZodType<SellWizardState> = z
  .object({
    currentStep: SellStepSchema,
    draft: SellListingDraftSchema,
    photos: z.array(SellPhotoSchema).max(20),
    coverPhotoClientId: z.string().nullable(),
    isSubmitting: z.boolean(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    createdListing: ListingCardSchema.nullable(),
    isSuccess: z.boolean(),
  })
  .superRefine((val, ctx) => {
    if (val.coverPhotoClientId) {
      const match = val.photos.find((p) => p.clientId === val.coverPhotoClientId);
      if (!match) {
        ctx.addIssue({
          code: 'custom',
          path: ['coverPhotoClientId'],
          message: 'coverPhotoClientId must match an existing photo clientId',
        });
      }
    }
  });

export const ListingFeedStateSchema: z.ZodType<ListingFeedState> = z.object({
  items: z.array(ListingCardSchema),
  page: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  isLoadingMore: z.boolean(),
  loadMoreError: z.string().nullable(),
});

// ── Projection from Draft to API Input ──────────────────────────────────────

export function projectDraftToCreateInput(
  draft: SellListingDraft,
  photos: SellPhoto[],
  coverPhotoClientId: string | null
): CreateListingInput {
  if (!draft.condition) throw new Error('Car condition is required');
  if (!draft.makePublicId) throw new Error('Make is required');
  if (!draft.modelPublicId) throw new Error('Model is required');
  if (draft.year === null) throw new Error('Year is required');
  if (draft.mileageKm === null) throw new Error('Mileage is required');
  if (!draft.fuelType) throw new Error('Fuel type is required');
  if (!draft.transmission) throw new Error('Transmission is required');
  if (!draft.bodyType) throw new Error('Body type is required');
  if (draft.priceCents === null) throw new Error('Price is required');
  if (draft.cityId === null) throw new Error('City is required');

  const readyPhotos = photos.filter((p) => p.status === 'READY' && p.publicId !== null);
  const imageFilePublicIds = readyPhotos.map((p) => p.publicId as string);

  let coverImagePublicId: string | undefined;
  if (coverPhotoClientId) {
    const coverPhoto = readyPhotos.find((p) => p.clientId === coverPhotoClientId);
    if (coverPhoto && coverPhoto.publicId) {
      coverImagePublicId = coverPhoto.publicId;
    }
  }
  if (!coverImagePublicId && imageFilePublicIds.length > 0) {
    coverImagePublicId = imageFilePublicIds[0];
  }

  const payload: CreateListingInput = {
    condition: draft.condition,
    makePublicId: draft.makePublicId,
    modelPublicId: draft.modelPublicId,
    year: draft.year,
    mileageKm: draft.mileageKm,
    priceCents: draft.priceCents,
    fuelType: draft.fuelType,
    transmission: draft.transmission,
    bodyType: draft.bodyType,
    cityId: draft.cityId,
    isNegotiable: draft.isNegotiable,
    installmentAvailable: draft.installmentAvailable,
    exchangeAccepted: draft.exchangeAccepted,
    hasWarranty: draft.hasWarranty,
    hasServiceHistory: draft.hasServiceHistory,
    allowChat: draft.allowChat,
  };

  if (draft.generationPublicId) payload.generationPublicId = draft.generationPublicId;
  if (draft.trimPublicId) payload.trimPublicId = draft.trimPublicId;
  if (draft.engineCc !== null) payload.engineCc = draft.engineCc;
  if (draft.colorExterior) payload.colorExterior = draft.colorExterior;
  if (draft.colorInterior) payload.colorInterior = draft.colorInterior;
  if (draft.description && draft.description.trim().length > 0) {
    payload.description = { ar: draft.description, en: draft.description };
  }
  if (draft.features.length > 0) payload.features = draft.features;
  if (draft.areaId !== null) payload.areaId = draft.areaId;
  if (draft.contactPhone) payload.contactPhone = draft.contactPhone;
  if (draft.whatsappPhone) payload.whatsappPhone = draft.whatsappPhone;
  if (imageFilePublicIds.length > 0) {
    payload.imageFilePublicIds = imageFilePublicIds;
    if (coverImagePublicId) payload.coverImagePublicId = coverImagePublicId;
  }

  return CreateListingInputSchema.parse(payload);
}
