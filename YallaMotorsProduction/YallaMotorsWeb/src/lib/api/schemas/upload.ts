import { z } from 'zod';
import type {
  FilePublicIdParams,
  FileStatus,
  FileStatusResponse,
  UploadedFile,
  UploadedFileListResponse,
  UploadedFileResponse,
  UploadFileInput,
  UploadPurpose,
} from '@/types/upload';
import {
  JsonValueSchema,
  PublicIdSchema,
} from './common';
import { unwrapDataArray, unwrapDataObject } from './taxonomy';

// ── Enums ───────────────────────────────────────────────────────────────────

export const UploadPurposeSchema = z.enum([
  'USER_AVATAR',
  'LISTING_IMAGE',
  'LISTING_VIDEO',
  'VEHICLE_MAKE_LOGO',
  'TRIM_BROCHURE',
  'VENDOR_LOGO',
  'VENDOR_BANNER',
  'VENDOR_KYC',
  'VENDOR_BILLING_PROOF',
  'BANNER_IMAGE',
  'CHAT_ATTACHMENT',
  'EXPORT',
  'AI_STUDIO_SOURCE',
]) satisfies z.ZodType<UploadPurpose>;

export const FileStatusSchema = z.enum([
  'PROCESSING',
  'READY',
  'FAILED',
]) satisfies z.ZodType<FileStatus>;

// ── File Schemas ────────────────────────────────────────────────────────────

export const UploadedFileSchema: z.ZodType<UploadedFile> = z.object({
  publicId: PublicIdSchema,
  url: z.string().url().nullable(),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  variants: JsonValueSchema.nullable(),
  thumbnailUrl: z.string().url().nullable(),
  status: FileStatusSchema,
});

export const FileStatusResponseSchema: z.ZodType<FileStatusResponse> = z.object({
  publicId: PublicIdSchema,
  status: FileStatusSchema,
  mimeType: z.string().min(1),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  url: z.string().url().nullable(),
  thumbnailUrl: z.string().url().nullable(),
});

export const UploadedFileResponseSchema: z.ZodType<UploadedFileResponse> = z.object({
  data: UploadedFileSchema,
});

export const UploadedFileListResponseSchema: z.ZodType<UploadedFileListResponse> = z.object({
  data: z.array(UploadedFileSchema),
});

export const FilePublicIdParamsSchema: z.ZodType<FilePublicIdParams> = z.object({
  publicId: PublicIdSchema,
});

// ── Client-Only Input Schema ────────────────────────────────────────────────

export const UploadFileInputSchema: z.ZodType<UploadFileInput> = z.object({
  purpose: UploadPurposeSchema,
  file: z.custom<File>(
    (value) => typeof File !== 'undefined' && value instanceof File,
    'A browser File is required'
  ),
});

// ── Purpose Constraints ─────────────────────────────────────────────────────

export const UPLOAD_PURPOSE_CONFIG: Record<
  UploadPurpose,
  { maxSizeBytes: number; allowedMimeTypes: string[] }
> = {
  USER_AVATAR: {
    maxSizeBytes: 2 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  LISTING_IMAGE: {
    maxSizeBytes: 8 * 1024 * 1024,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ],
  },
  LISTING_VIDEO: {
    maxSizeBytes: 100 * 1024 * 1024,
    allowedMimeTypes: [
      'video/mp4',
      'video/quicktime',
      'video/x-matroska',
      'video/webm',
    ],
  },
  VEHICLE_MAKE_LOGO: {
    maxSizeBytes: 2 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  },
  TRIM_BROCHURE: {
    maxSizeBytes: 20 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf'],
  },
  VENDOR_LOGO: {
    maxSizeBytes: 4 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  VENDOR_BANNER: {
    maxSizeBytes: 8 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  VENDOR_KYC: {
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  VENDOR_BILLING_PROOF: {
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  },
  BANNER_IMAGE: {
    maxSizeBytes: 8 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  CHAT_ATTACHMENT: {
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
  EXPORT: {
    maxSizeBytes: 50 * 1024 * 1024,
    allowedMimeTypes: [
      'application/zip',
      'text/csv',
      'application/json',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
  AI_STUDIO_SOURCE: {
    maxSizeBytes: 15 * 1024 * 1024,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ],
  },
};

export function validateUploadFileMeta(
  purpose: UploadPurpose,
  mimeType: string,
  sizeBytes: number
): { valid: boolean; error?: string } {
  const config = UPLOAD_PURPOSE_CONFIG[purpose];
  if (!config) {
    return { valid: false, error: `Unknown purpose: ${purpose}` };
  }

  if (sizeBytes > config.maxSizeBytes) {
    const maxMb = Math.round(config.maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxMb}MB for ${purpose}`,
    };
  }

  const normalizedMime = mimeType.toLowerCase().trim();
  if (!config.allowedMimeTypes.includes(normalizedMime)) {
    return {
      valid: false,
      error: `MIME type ${mimeType} is not allowed for ${purpose}. Allowed types: ${config.allowedMimeTypes.join(', ')}`,
    };
  }

  return { valid: true };
}

// ── Adapters ─────────────────────────────────────────────────────────────────

function cleanRawUploadedFile(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    publicId: raw.publicId,
    url: raw.url === undefined ? null : raw.url,
    mimeType: raw.mimeType,
    sizeBytes: raw.sizeBytes,
    width: raw.width === undefined ? null : raw.width,
    height: raw.height === undefined ? null : raw.height,
    variants: raw.variants === undefined ? null : raw.variants,
    thumbnailUrl: raw.thumbnailUrl === undefined ? null : raw.thumbnailUrl,
    status: raw.status,
  };
}

export function adaptRawUploadedFile(input: unknown): UploadedFileResponse {
  const obj = unwrapDataObject(input);
  const target = ('data' in obj && typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data))
    ? (obj.data as Record<string, unknown>)
    : obj;
  const cleaned = cleanRawUploadedFile(target);
  const data = UploadedFileSchema.parse(cleaned);
  return { data };
}

export function adaptRawUploadedFileList(input: unknown): UploadedFileListResponse {
  const list = unwrapDataArray(input);
  const data = list.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['data', index],
          message: 'Expected uploaded file item to be an object',
        },
      ]);
    }
    const cleaned = cleanRawUploadedFile(item as Record<string, unknown>);
    return UploadedFileSchema.parse(cleaned);
  });
  return UploadedFileListResponseSchema.parse({ data });
}

export function adaptRawFileStatus(input: unknown): FileStatusResponse {
  const obj = unwrapDataObject(input);
  const target = ('data' in obj && typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data))
    ? (obj.data as Record<string, unknown>)
    : obj;

  const cleaned = {
    publicId: target.publicId,
    status: target.status,
    mimeType: target.mimeType,
    width: target.width === undefined ? null : target.width,
    height: target.height === undefined ? null : target.height,
    url: target.url === undefined ? null : target.url,
    thumbnailUrl: target.thumbnailUrl === undefined ? null : target.thumbnailUrl,
  };

  return FileStatusResponseSchema.parse(cleaned);
}
