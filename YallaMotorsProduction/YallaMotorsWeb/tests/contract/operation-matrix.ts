import type { AuthMode, HttpMethod } from '@/lib/api/server';

export interface OperationMatrixEntry {
  readonly operation: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly authMode: AuthMode;
  readonly private: boolean;
  readonly idempotent: boolean;
  readonly mutation: boolean;
}

const read = (operation: string, path: string, authMode: AuthMode, privateRead = false): OperationMatrixEntry => ({ operation, method: 'GET', path, authMode, private: privateRead, idempotent: false, mutation: false });
const mutation = (operation: string, method: Exclude<HttpMethod, 'GET' | 'HEAD'>, path: string, authMode: AuthMode, idempotent = true): OperationMatrixEntry => ({ operation, method, path, authMode, private: true, idempotent, mutation: true });

/**
 * Explicit browser-operation inventory. Price-offer operations are intentionally
 * absent: buyer/seller negotiation happens by direct contact leads only.
 */
export const OPERATION_MATRIX = [
  read('getSession', '/api/bff/session', 'S', true),
  mutation('loginWithGoogle', 'POST', '/api/bff/auth/google', 'O', false),
  mutation('loginWithApple', 'POST', '/api/bff/auth/apple', 'M', false),
  mutation('refreshSession', 'POST', '/api/bff/auth/refresh', 'S', false),
  mutation('verifyFirebasePhone', 'POST', '/api/bff/auth/phone/verify', 'M', false),
  read('getProfile', '/api/bff/me', 'S', true),

  read('listBanners', '/api/bff/banners', 'P'),
  read('getPublicSettings', '/api/bff/settings/public', 'P'),
  read('getSpotlight', '/api/bff/catalogue/spotlight', 'P'),
  read('getListingBatch', '/api/bff/listings/batch', 'P'),
  read('searchListings', '/api/bff/listings', 'O'),
  read('getSimilarListings', '/api/bff/listings/:slug/similar', 'P'),
  mutation('addFavorite', 'POST', '/api/bff/listings/:publicId/favorite', 'M'),
  mutation('removeFavorite', 'DELETE', '/api/bff/listings/:publicId/favorite', 'M'),
  read('getListing', '/api/bff/listings/:slug', 'O'),
  read('getVehicleSuggestions', '/api/bff/search/suggest', 'P'),
  read('listDealers', '/api/bff/dealers', 'P'),
  read('getDealerListings', '/api/bff/dealers/:slug/listings', 'P'),
  read('getDealer', '/api/bff/dealers/:slug', 'P'),

  read('listMakes', '/api/bff/taxonomy/makes', 'P'),
  read('listModels', '/api/bff/taxonomy/makes/:makeSlug/models', 'P'),
  read('listGenerations', '/api/bff/taxonomy/models/:modelPublicId/generations', 'P'),
  read('listTrims', '/api/bff/taxonomy/generations/:generationPublicId/trims', 'P'),
  read('getTrimBatch', '/api/bff/taxonomy/trims/batch', 'P'),
  read('getTrim', '/api/bff/taxonomy/trims/:publicId', 'P'),
  read('getModelsWithPrices', '/api/bff/catalogue/makes/:makeSlug/models-with-prices', 'P'),
  read('getCatalogueModel', '/api/bff/catalogue/models/:publicId', 'P'),
  read('getCatalogueTrim', '/api/bff/catalogue/trims/:publicId', 'P'),
  read('getTrimDealers', '/api/bff/catalogue/trims/:publicId/dealers', 'P'),
  read('getMakeDealers', '/api/bff/catalogue/makes/:makeSlug/dealers', 'P'),
  read('listCountries', '/api/bff/locations/countries', 'P'),
  read('getCountryConfig', '/api/bff/locations/countries/:code/config', 'P'),
  read('listCities', '/api/bff/locations/countries/:code/cities', 'P'),
  read('listAreas', '/api/bff/locations/cities/:cityId/areas', 'P'),
  read('listPromotionPackages', '/api/bff/promotions/packages', 'P'),

  read('getMyVendors', '/api/bff/me/vendors', 'S', true),
  read('getMyListings', '/api/bff/me/listings', 'S', true),
  read('getFavorites', '/api/bff/me/favorites', 'S', true),
  mutation('uploadFile', 'POST', '/api/bff/files', 'U'),
  read('getFileStatus', '/api/bff/files/:publicId/status', 'O', true),
  read('listSavedSearches', '/api/bff/me/saved-searches', 'S', true),
  read('listMyPromotions', '/api/bff/me/promotions', 'S', true),
  read('listNotifications', '/api/bff/notifications', 'S', true),
  read('getUnreadNotificationCount', '/api/bff/notifications/unread-count', 'S', true),
  mutation('markNotificationRead', 'PATCH', '/api/bff/notifications/:publicId/read', 'M'),
  read('listNotificationDevices', '/api/bff/notifications/devices', 'S', true),
  mutation('registerNotificationDevice', 'POST', '/api/bff/notifications/devices', 'M'),
  mutation('unregisterNotificationDevice', 'DELETE', '/api/bff/notifications/devices', 'M'),

  mutation('createLead', 'POST', '/api/bff/leads', 'O'),
  read('listSellerLeads', '/api/bff/me/leads', 'S', true),
  read('getSellerLead', '/api/bff/me/leads/:publicId', 'S', true),
  mutation('updateSellerLeadStatus', 'PATCH', '/api/bff/me/leads/:publicId/status', 'M'),
  mutation('createListingReport', 'POST', '/api/bff/reports', 'M'),
  read('getDashboardOverview', '/api/bff/me/dashboard', 'S', true),
  read('getVendorBillingSummary', '/api/bff/vendors/:vendorPublicId/billing/summary', 'S', true),
  read('getVendorEntitlements', '/api/bff/vendors/:vendorPublicId/entitlements', 'S', true),
  read('getVendorSubscription', '/api/bff/vendors/:vendorPublicId/subscription', 'S', true),
  read('listSubscriptionPlans', '/api/bff/subscription-plans', 'P'),
] as const satisfies readonly OperationMatrixEntry[];

export const READINESS_GATES = ['FAV-01', 'ERR-01', 'OUT-01', 'IDEM-01', 'AUTH-01', 'CACHE-01', 'FLOW-01', 'OBS-01'] as const;
