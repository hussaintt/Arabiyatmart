import { z } from 'zod';
import type {
  ApiErrorBody,
  FieldError,
  JsonPrimitive,
  JsonValue,
  OperationError,
} from '@/types/common';

export const HttpStatusSchema = z.union([
  z.literal(400),
  z.literal(401),
  z.literal(403),
  z.literal(404),
  z.literal(409),
  z.literal(413),
  z.literal(422),
  z.literal(429),
  z.literal(500),
  z.literal(502),
  z.literal(503),
  z.literal(504),
]);

export const JsonPrimitiveSchema: z.ZodType<JsonPrimitive> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    JsonPrimitiveSchema,
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ])
);

export const FieldErrorSchema: z.ZodType<FieldError> = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string(),
});

export const ApiErrorBodySchema = z.object({
  error: z.object({
    status: HttpStatusSchema,
    code: z.string(),
    message: z.string(),
    requestId: z.string().min(1),
    fieldErrors: z.array(FieldErrorSchema),
    details: JsonValueSchema.nullable(),
    retryAfterSeconds: z.number().int().nonnegative().nullable(),
  }),
}) satisfies z.ZodType<ApiErrorBody>;

export const OperationErrorSchema: z.ZodType<OperationError> = ApiErrorBodySchema;

export class ApiContractError extends Error {
  readonly body: OperationError;

  constructor(body: OperationError) {
    super(body.error.message);
    this.name = 'ApiContractError';
    this.body = body;
  }

  get status(): number {
    return this.body.error.status;
  }

  get code(): string {
    return this.body.error.code;
  }
}

export const actionResultSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), data }),
    z.object({ ok: z.literal(false), error: ApiErrorBodySchema.shape.error }),
  ]);
