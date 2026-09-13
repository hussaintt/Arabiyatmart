import { z } from 'zod';

const locale = z.enum(['ar', 'en']);
const opaqueId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const requestId = z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/);
const outcome = z.enum(['succeeded', 'failed']);

export const ANALYTICS_ROUTE_TEMPLATES = [
  '/[locale]', '/[locale]/search', '/[locale]/dealers', '/[locale]/dealers/[slug]',
  '/[locale]/listing/[slug]', '/[locale]/catalogue/makes', '/[locale]/catalogue/makes/[makeSlug]',
  '/[locale]/catalogue/models/[publicId]', '/[locale]/catalogue/trims/[publicId]', '/[locale]/compare',
  '/[locale]/news', '/[locale]/privacy', '/[locale]/terms', '/[locale]/best-offer',
  '/[locale]/best-offer/[slug]', '/[locale]/favorites', '/[locale]/me/dashboard',
  '/[locale]/me/leads', '/[locale]/me/leads/[publicId]', '/[locale]/me/listings',
  '/[locale]/notifications', '/[locale]/profile', '/[locale]/profile/edit',
  '/[locale]/saved-searches', '/[locale]/sell', '/[locale]/forgot-password',
  '/[locale]/login', '/[locale]/register', '/[locale]/register-success',
  '/[locale]/reset-password', '/[locale]/verify-email', '/[locale]/forbidden',
] as const;

export type AnalyticsRouteTemplate = (typeof ANALYTICS_ROUTE_TEMPLATES)[number];
const routeTemplate = z.enum(ANALYTICS_ROUTE_TEMPLATES);

export const AnalyticsEventSchema = z.discriminatedUnion('name', [
  z.object({ name: z.literal('page_view'), route: routeTemplate, locale }).strict(),
  z.object({ name: z.literal('search_filter'), action: z.enum(['search', 'apply', 'clear', 'sort']), filter: z.enum(['query', 'make', 'model', 'price', 'year', 'mileage', 'location', 'seller', 'sort', 'all']), outcome }).strict(),
  z.object({ name: z.literal('listing_view'), listingId: opaqueId }).strict(),
  z.object({ name: z.literal('listing_contact'), listingId: opaqueId, channel: z.enum(['phone', 'whatsapp', 'message']), outcome: z.enum(['initiated', 'succeeded', 'failed']) }).strict(),
  z.object({ name: z.literal('listing_favorite'), listingId: opaqueId, action: z.enum(['add', 'remove']), outcome }).strict(),
  z.object({ name: z.literal('auth_outcome'), operation: z.enum(['login', 'register', 'logout', 'forgot_password', 'reset_password', 'verify_email', 'phone_verify', 'google', 'apple']), outcome, code: z.string().regex(/^[A-Z0-9_]{1,64}$/).optional(), status: z.number().int().min(100).max(599).optional(), requestId: requestId.optional() }).strict(),
  z.object({ name: z.literal('sell_step'), step: z.number().int().min(1).max(20), action: z.enum(['view', 'next', 'back', 'restore', 'discard']) }).strict(),
  z.object({ name: z.literal('sell_outcome'), operation: z.enum(['draft', 'submit', 'publish', 'promotion']), outcome, code: z.string().regex(/^[A-Z0-9_]{1,64}$/).optional(), status: z.number().int().min(100).max(599).optional(), requestId: requestId.optional() }).strict(),
  z.object({ name: z.literal('lead_outcome'), operation: z.enum(['contact', 'create', 'status_update']), channel: z.enum(['phone', 'whatsapp', 'message']).optional(), outcome, code: z.string().regex(/^[A-Z0-9_]{1,64}$/).optional(), status: z.number().int().min(100).max(599).optional(), requestId: requestId.optional() }).strict(),
  z.object({ name: z.literal('report_outcome'), outcome, code: z.string().regex(/^[A-Z0-9_]{1,64}$/).optional(), status: z.number().int().min(100).max(599).optional(), requestId: requestId.optional() }).strict(),
  z.object({ name: z.literal('vendor_switch'), scope: z.enum(['private', 'vendor']), outcome }).strict(),
  z.object({ name: z.literal('dashboard_range'), range: z.enum(['7d', '30d', '90d']) }).strict(),
]);

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

const STATIC_ROUTES = new Set<string>(ANALYTICS_ROUTE_TEMPLATES);
const DYNAMIC_ROUTES: readonly [RegExp, AnalyticsRouteTemplate][] = [
  [/^\/(?:ar|en)\/dealers\/[^/?#]+$/, '/[locale]/dealers/[slug]'],
  [/^\/(?:ar|en)\/listing\/[^/?#]+$/, '/[locale]/listing/[slug]'],
  [/^\/(?:ar|en)\/catalogue\/makes\/[^/?#]+$/, '/[locale]/catalogue/makes/[makeSlug]'],
  [/^\/(?:ar|en)\/catalogue\/models\/[^/?#]+$/, '/[locale]/catalogue/models/[publicId]'],
  [/^\/(?:ar|en)\/catalogue\/trims\/[^/?#]+$/, '/[locale]/catalogue/trims/[publicId]'],
  [/^\/(?:ar|en)\/best-offer\/[^/?#]+$/, '/[locale]/best-offer/[slug]'],
  [/^\/(?:ar|en)\/me\/leads\/[^/?#]+$/, '/[locale]/me/leads/[publicId]'],
];

/** Converts a browser path to a finite route template; query values are never retained. */
export function canonicalizeAnalyticsRoute(pathname: string | null | undefined): AnalyticsRouteTemplate | null {
  if (!pathname) return null;
  const path = pathname.split(/[?#]/, 1)[0]?.replace(/\/$/, '') || '/';
  if (!/^\/(?:ar|en)(?:\/|$)/.test(path)) return null;
  const templated = path.replace(/^\/(?:ar|en)/, '/[locale]') || '/[locale]';
  if (STATIC_ROUTES.has(templated)) return templated as AnalyticsRouteTemplate;
  for (const [pattern, route] of DYNAMIC_ROUTES) if (pattern.test(path)) return route;
  return null;
}

export function parseAnalyticsEvent(input: unknown): AnalyticsEvent | null {
  const result = AnalyticsEventSchema.safeParse(input);
  return result.success ? result.data : null;
}
