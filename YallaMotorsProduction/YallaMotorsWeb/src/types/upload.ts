import type { JsonValue } from './common';

export type UploadPurpose =
  | 'USER_AVATAR'
  | 'LISTING_IMAGE'
  | 'LISTING_VIDEO'
  | 'VEHICLE_MAKE_LOGO'
  | 'TRIM_BROCHURE'
  | 'VENDOR_LOGO'
  | 'VENDOR_BANNER'
  | 'VENDOR_KYC'
  | 'VENDOR_BILLING_PROOF'
  | 'BANNER_IMAGE'
  | 'CHAT_ATTACHMENT'
  | 'EXPORT'
  | 'AI_STUDIO_SOURCE';

export type FileStatus = 'PROCESSING' | 'READY' | 'FAILED';

export interface UploadedFile {
  publicId: string;
  url: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  variants: JsonValue | null;
  thumbnailUrl: string | null;
  status: FileStatus;
}

export interface FileStatusResponse {
  publicId: string;
  status: FileStatus;
  mimeType: string;
  width: number | null;
  height: number | null;
  url: string | null;
  thumbnailUrl: string | null;
}

export interface UploadedFileResponse {
  data: UploadedFile;
}

export interface UploadedFileListResponse {
  data: UploadedFile[];
}

export interface FilePublicIdParams {
  publicId: string;
}

export interface UploadFileInput {
  purpose: UploadPurpose;
  file: File;
}
