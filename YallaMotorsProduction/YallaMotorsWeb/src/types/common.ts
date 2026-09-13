export type Locale = 'ar' | 'en';
export type AccountType = 'CUSTOMER' | 'VENDOR' | 'ADMIN';
export type RegistrationAccountType = 'CUSTOMER' | 'VENDOR';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type KycStatus = 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type SignInMethod = 'EMAIL_PASSWORD' | 'GOOGLE' | 'APPLE' | 'OTP' | 'RESTORED';
export type HttpStatus = 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 502 | 503 | 504;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface LocalizedText {
  ar: string;
  en: string;
}

export interface PartialLocalizedText {
  ar?: string | undefined;
  en?: string | undefined;
}

export interface CursorMeta {
  hasMore: boolean;
  nextCursor: string | null;
}

export interface PageMeta {
  total: number | null;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    status: HttpStatus;
    code: string;
    message: string;
    requestId: string;
    fieldErrors: FieldError[];
    details: JsonValue | null;
    retryAfterSeconds: number | null;
  };
}

export type OperationError = ApiErrorBody;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: OperationError['error'] };

export interface MessageResponse {
  message: string;
}

export interface CountResponse {
  count: number;
}

export interface MutationAckResponse {
  ok: true;
}

export type IsoDateTime = string;
export type PublicId = string;
export type Slug = string;
export type Currency = string;
export type MoneyCents = number;
export type PositiveMoneyCents = number;
