import { z } from 'zod';
import type {
  DashboardOverview,
  DashboardOverviewResponse,
  DashboardRange,
  DashboardRangeParams,
  DashboardSummary,
  DashboardWindow,
} from '@/types/dashboard';
import {
  IsoDateTimeSchema,
  PublicIdSchema,
} from './common';
import { unwrapDataObject } from './taxonomy';

// ── Enums & Ranges ──────────────────────────────────────────────────────────

export const DashboardRangeSchema = z.enum([
  '7d',
  '30d',
  '90d',
]) satisfies z.ZodType<DashboardRange>;

export function dashboardRangeToDays(range: DashboardRange): number {
  switch (range) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
  }
}

// ── Overview Schemas ────────────────────────────────────────────────────────

export const DashboardWindowSchema: z.ZodType<DashboardWindow> = z.object({
  days: z.number().int().min(1).max(365),
  startAt: IsoDateTimeSchema,
});

export const DashboardSummarySchema: z.ZodType<DashboardSummary> = z
  .object({
    activeListingsCount: z.number().int().nonnegative(),
    totalViews: z.number().int().nonnegative(),
    totalLeads: z.number().int().nonnegative(),
    leadsByChannel: z.record(z.string(), z.number().int().nonnegative()),
    totalFavorites: z.number().int().nonnegative(),
    responseRatePercentage: z.number().min(0).max(100),
  })
  .superRefine((val, ctx) => {
    // Cross-field check: totalLeads should be >= sum of leadsByChannel
    const channelSum = Object.values(val.leadsByChannel).reduce(
      (acc, count) => acc + count,
      0
    );
    if (val.totalLeads < channelSum) {
      ctx.addIssue({
        code: 'custom',
        path: ['totalLeads'],
        message: 'totalLeads cannot be less than the sum of leads by channel',
      });
    }
  });

export const DashboardOverviewSchema: z.ZodType<DashboardOverview> = z.object({
  window: DashboardWindowSchema,
  summary: DashboardSummarySchema,
});

export const DashboardOverviewResponseSchema: z.ZodType<DashboardOverviewResponse> = z.object({
  data: DashboardOverviewSchema,
});

export const DashboardRangeParamsSchema: z.ZodType<DashboardRangeParams> = z.object({
  range: DashboardRangeSchema,
  vendorPublicId: PublicIdSchema,
});

// ── Adapters ─────────────────────────────────────────────────────────────────

function cleanRawDashboardOverview(raw: Record<string, unknown>): Record<string, unknown> {
  if (typeof raw.window !== 'object' || raw.window === null || Array.isArray(raw.window)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ['window'],
        message: 'Expected window property to be an object',
      },
    ]);
  }

  if (typeof raw.summary !== 'object' || raw.summary === null || Array.isArray(raw.summary)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ['summary'],
        message: 'Expected summary property to be an object',
      },
    ]);
  }

  const rawWindow = raw.window as Record<string, unknown>;
  const rawSummary = raw.summary as Record<string, unknown>;

  return {
    window: {
      days: rawWindow.days,
      startAt: rawWindow.startAt,
    },
    summary: {
      activeListingsCount: rawSummary.activeListingsCount,
      totalViews: rawSummary.totalViews,
      totalLeads: rawSummary.totalLeads,
      leadsByChannel: rawSummary.leadsByChannel,
      totalFavorites: rawSummary.totalFavorites,
      responseRatePercentage: rawSummary.responseRatePercentage,
    },
  };
}

export function adaptRawDashboardOverview(input: unknown): DashboardOverviewResponse {
  const obj = unwrapDataObject(input);
  const target = ('data' in obj && typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data))
    ? (obj.data as Record<string, unknown>)
    : obj;
  const cleaned = cleanRawDashboardOverview(target);
  const data = DashboardOverviewSchema.parse(cleaned);
  return { data };
}
