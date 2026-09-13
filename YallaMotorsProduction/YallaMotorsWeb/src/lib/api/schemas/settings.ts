import { z } from 'zod';
import type {
  FinanceConfig,
  PublicSetting,
  PublicSettingsResponse,
  SettingGroup,
  SettingType,
  SupportConfig,
} from '@/types/settings';
import { IsoDateTimeSchema } from './common';

export const SettingGroupSchema = z.enum([
  'BUSINESS',
  'LISTING',
  'VENDOR',
  'PAYMENT',
  'APP',
  'NOTIFICATION',
]) satisfies z.ZodType<SettingGroup>;

export const SettingTypeSchema = z.enum([
  'STRING',
  'NUMBER',
  'BOOLEAN',
  'JSON',
]) satisfies z.ZodType<SettingType>;

export const PublicSettingSchema: z.ZodType<PublicSetting> = z.object({
  key: z.string().min(2).max(120),
  group: SettingGroupSchema,
  value: z.string().max(8000),
  type: SettingTypeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const FinanceConfigSchema: z.ZodType<FinanceConfig> = z.object({
  annualRate: z.number().positive().max(1),
  downPaymentFraction: z.number().nonnegative().max(1),
  tenorMonths: z.number().int().positive().max(360),
});

export const SupportConfigSchema: z.ZodType<SupportConfig> = z.object({
  termsUrl: z.string().url().nullable(),
  privacyUrl: z.string().url().nullable(),
  supportEmail: z.string().email().nullable(),
  supportPhone: z.string().nullable(),
});

export const PublicSettingsResponseSchema: z.ZodType<PublicSettingsResponse> = z.object({
  data: z.object({
    rows: z.array(PublicSettingSchema),
    finance: FinanceConfigSchema,
    support: SupportConfigSchema,
  }),
});

// ── Fallback Defaults & Derivation ──────────────────────────────────────────

export const DEFAULT_FINANCE_CONFIG: FinanceConfig = {
  annualRate: 0.14,
  downPaymentFraction: 0.20,
  tenorMonths: 60,
};

function extractKeyValueMap(input: PublicSetting[] | Record<string, string>): Record<string, string> {
  if (Array.isArray(input)) {
    const map: Record<string, string> = {};
    for (const row of input) {
      if (typeof row === 'object' && row !== null && 'key' in row && 'value' in row) {
        map[String(row.key)] = String(row.value);
      }
    }
    return map;
  }
  return input;
}

export function deriveFinanceConfig(rowsOrMap: PublicSetting[] | Record<string, string>): FinanceConfig {
  const map = extractKeyValueMap(rowsOrMap);

  const rawRate = parseFloat(map['finance.default_annual_rate_pct'] ?? '');
  const rawDown = parseFloat(map['finance.min_down_payment_pct'] ?? '');
  const rawTenor = parseInt(map['finance.default_tenor_months'] ?? '', 10);

  const annualRate = (!isNaN(rawRate) && rawRate > 0 && rawRate <= 100)
    ? rawRate / 100
    : DEFAULT_FINANCE_CONFIG.annualRate;

  const downPaymentFraction = (!isNaN(rawDown) && rawDown >= 0 && rawDown <= 100)
    ? rawDown / 100
    : DEFAULT_FINANCE_CONFIG.downPaymentFraction;

  const tenorMonths = (!isNaN(rawTenor) && rawTenor > 0 && rawTenor <= 360)
    ? rawTenor
    : DEFAULT_FINANCE_CONFIG.tenorMonths;

  return FinanceConfigSchema.parse({
    annualRate,
    downPaymentFraction,
    tenorMonths,
  });
}

export function deriveSupportConfig(rowsOrMap: PublicSetting[] | Record<string, string>): SupportConfig {
  const map = extractKeyValueMap(rowsOrMap);

  const cleanString = (val?: string): string | null => {
    if (!val) return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const rawTerms = cleanString(map['legal.terms_url']);
  const rawPrivacy = cleanString(map['legal.privacy_url']);
  const rawEmail = cleanString(map['support.email']);
  const rawPhone = cleanString(map['support.phone']);

  return SupportConfigSchema.parse({
    termsUrl: rawTerms,
    privacyUrl: rawPrivacy,
    supportEmail: rawEmail,
    supportPhone: rawPhone,
  });
}

// ── Upstream Adapters ────────────────────────────────────────────────────────

export function adaptRawPublicSettings(input: unknown): PublicSettingsResponse {
  let rawRows: unknown[];
  let providedFinance: unknown = null;
  let providedSupport: unknown = null;

  if (Array.isArray(input)) {
    rawRows = input;
  } else if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      rawRows = obj.data;
    } else if (typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data)) {
      const dataObj = obj.data as Record<string, unknown>;
      if (Array.isArray(dataObj.rows)) {
        rawRows = dataObj.rows;
      } else {
        throw new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            path: ['data', 'rows'],
            message: 'Expected rows to be an array in settings data object',
          },
        ]);
      }
      if ('finance' in dataObj) providedFinance = dataObj.finance;
      if ('support' in dataObj) providedSupport = dataObj.support;
    } else {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['data'],
          message: 'Expected data property to be an array or object with rows array',
        },
      ]);
    }
  } else {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'Expected array or object input for public settings',
      },
    ]);
  }

  const rows: PublicSetting[] = rawRows.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: [index],
          message: 'Expected public setting row to be an object',
        },
      ]);
    }
    const item = raw as Record<string, unknown>;

    let updatedAt = item.updatedAt;
    if (updatedAt instanceof Date && !isNaN(updatedAt.getTime())) {
      updatedAt = updatedAt.toISOString();
    }

    return PublicSettingSchema.parse({
      key: item.key,
      group: item.group,
      value: item.value,
      type: item.type,
      updatedAt,
    });
  });

  const finance = providedFinance !== null && typeof providedFinance === 'object'
    ? FinanceConfigSchema.parse(providedFinance)
    : deriveFinanceConfig(rows);

  const support = providedSupport !== null && typeof providedSupport === 'object'
    ? SupportConfigSchema.parse(providedSupport)
    : deriveSupportConfig(rows);

  return PublicSettingsResponseSchema.parse({
    data: {
      rows,
      finance,
      support,
    },
  });
}
