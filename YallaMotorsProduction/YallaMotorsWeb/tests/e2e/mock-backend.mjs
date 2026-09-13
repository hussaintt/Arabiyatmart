import { createServer } from 'node:http';

const NOW = '2026-09-10T10:00:00.000Z';

function authFrom(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    const identity = typeof payload.e2eIdentity === 'string' ? payload.e2eIdentity : '';
    const sessionKey = typeof payload.e2eSession === 'string'
      ? payload.e2eSession
      : `${identity}:${String(payload.sub ?? 'unknown')}`;
    return { identity, sessionKey };
  } catch {
    return { identity: '', sessionKey: '' };
  }
}

const favoriteRemovals = new Set();
const deletedSearches = new Set();
const readNotifications = new Set();
const profileUpdates = new Map();
let uploadSequence = 0;

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

function profile(token, sessionKey) {
  const verifiedPhone = token !== 'e2e_unverified';
  return {
    publicId: `usr_${token}`,
    email: `${token}@arabiyatmart.test`,
    phone: verifiedPhone ? '+201001234567' : null,
    firstName: token.includes('manager') ? 'Mona' : 'Hassan',
    lastName: 'E2E',
    status: token === 'e2e_suspended' ? 'SUSPENDED' : 'ACTIVE',
    locale: 'en', emailVerifiedAt: NOW, phoneVerifiedAt: verifiedPhone ? NOW : null,
    kycStatus: 'APPROVED', kycApprovedAt: NOW, kycRejectionReason: null,
    lastLoginAt: NOW, createdAt: NOW, avatarUrl: null,
    accountType: token.includes('manager') || token.includes('staff') ? 'VENDOR' : 'CUSTOMER',
    roles: [], permissions: [],
    ...(profileUpdates.get(sessionKey) ?? {}),
  };
}

function listingCard(publicId, slug, title) {
  return {
    publicId, slug, title,
    makeName: { ar: 'تويوتا', en: 'Toyota' }, modelName: { ar: 'كورولا', en: 'Corolla' },
    year: 2024, mileageKm: 15000, priceCents: 65000000, currency: 'EGP',
    isNegotiable: true, fuelType: 'PETROL', transmission: 'AUTOMATIC', bodyType: 'SEDAN',
    condition: 'USED', conditionGrade: 'EXCELLENT', sellerType: 'PRIVATE',
    cityName: { ar: 'القاهرة', en: 'Cairo' }, coverImageUrl: null,
    officialPriceCents: null, isFavorited: true, isFeatured: false,
    featuredUntil: null, featuredTier: null, publishedAt: NOW,
    viewsCount: 42, favoritesCount: 3, imagesCount: 3, isSellerVerified: true,
  };
}

const primaryFavorite = listingCard('lst_favorite_alpha', 'toyota-corolla-favorite', 'Toyota Corolla Favorite');
const nextFavorite = listingCard('lst_favorite_beta', 'toyota-corolla-second', 'Toyota Corolla Second Page');
const savedSearch = {
  publicId: 'ss_alpha', name: 'Cairo Corollas', query: { makeSlug: 'toyota', modelSlug: 'corolla', condition: 'USED' },
  isActive: true, notifyPush: false, notifyEmail: true, lastMatchedAt: NOW, createdAt: NOW,
};
const notification = {
  publicId: 'ntf_alpha', type: 'LEAD_CREATED',
  title: { ar: 'طلب تواصل جديد', en: 'New buyer inquiry' },
  body: { ar: 'لديك طلب جديد', en: 'You received a new inquiry' },
  data: { path: '/me/leads/lead_alpha' }, readAt: null, createdAt: NOW,
};

function vendor(publicId, role, status = 'APPROVED') {
  return {
    vendor: {
      publicId, slug: publicId.replaceAll('_', '-'), legalName: `${publicId} LLC`,
      displayName: { ar: `معرض ${publicId}`, en: `Store ${publicId}` }, description: null,
      email: `${publicId}@arabiyatmart.test`, phone: '+201009876543', logoUrl: null,
      bannerUrl: null, status, approvedAt: status === 'APPROVED' ? NOW : null,
      storeType: 'COMPANY', businessAddressLine: null, businessCountryId: 1,
      businessCityId: 1, businessPostalCode: null, defaultCurrency: 'EGP', createdAt: NOW,
    },
    membership: { vendorPublicId: publicId, role, invitedAt: NOW, acceptedAt: NOW },
  };
}

function memberships(token) {
  if (token === 'e2e_manager') return [vendor('vnd_alpha', 'MANAGER'), vendor('vnd_beta', 'OWNER')];
  if (token === 'e2e_staff') return [vendor('vnd_alpha', 'STAFF')];
  if (token === 'e2e_suspended') return [vendor('vnd_suspended', 'MANAGER', 'SUSPENDED')];
  return [];
}

const lead = {
  publicId: 'lead_alpha', channel: 'WHATSAPP', status: 'NEW', buyerName: 'Nour Buyer',
  buyerPhone: '+201112223333', note: 'Is this vehicle still available?', eventsCount: 1,
  lastActivityAt: NOW, createdAt: NOW,
  listing: { publicId: 'lst_alpha', slug: 'toyota-corolla-2024', title: 'Toyota Corolla 2024' },
  buyer: { publicId: 'usr_buyer', firstName: 'Nour', lastName: 'Buyer', phone: '+201112223333' },
  seller: { publicId: 'usr_seller', firstName: 'Hassan', lastName: 'Seller', phone: '+201001234567' },
};

const publicListing = {
  publicId: 'lst_contact_alpha', slug: 'toyota-corolla-contact', title: 'Toyota Corolla Direct Contact',
  sellerType: 'PRIVATE', status: 'ACTIVE', rejectionReason: null,
  make: { publicId: 'mak_toyota', slug: 'toyota', name: { ar: 'تويوتا', en: 'Toyota' } },
  model: { publicId: 'mod_corolla', slug: 'corolla', name: { ar: 'كورولا', en: 'Corolla' } },
  generation: null, trim: null, year: 2024, mileageKm: 15000, priceCents: 65000000,
  currency: 'EGP', isNegotiable: true, installmentAvailable: false, exchangeAccepted: false,
  condition: 'USED', conditionGrade: 'EXCELLENT', fuelType: 'PETROL', transmission: 'AUTOMATIC',
  bodyType: 'SEDAN', colorExterior: 'White', colorInterior: 'Black', engineCc: 1600,
  powerHp: null, seats: 5, drivetrain: 'FWD', vin: null,
  description: { ar: 'سيارة بحالة ممتازة', en: 'A well maintained direct-contact car' },
  features: ['ABS'], city: { id: 1, name: { ar: 'القاهرة', en: 'Cairo' } }, area: null,
  lat: null, lng: null, registrationStatus: null, hasWarranty: false, hasServiceHistory: true,
  images: [], contactPhone: '+201001112222', whatsappPhone: '+201009998888', allowChat: true,
  vendor: null, publishedAt: NOW, expiresAt: '2026-10-10T10:00:00.000Z', createdAt: NOW,
  featuredUntil: null, viewsCount: 50, favoritesCount: 2, leadsCount: 1, isFavorited: false,
};

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json', 'x-request-id': 'req_e2e_fixed' });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:3200');
  if (url.pathname === '/health') return send(response, 200, { ok: true });
  if (url.pathname === '/v1/taxonomy/makes' && request.method === 'GET') return send(response, 200, { data: [] });
  if (/^\/v1\/taxonomy\/(?:makes\/[^/]+\/models|models\/[^/]+\/generations|generations\/[^/]+\/trims)$/.test(url.pathname) && request.method === 'GET') return send(response, 200, { data: [] });
  if (url.pathname === '/v1/locations/countries/EG/cities' && request.method === 'GET') return send(response, 200, { data: [{ id: 1, countryId: 1, name: { ar: 'القاهرة', en: 'Cairo' }, isActive: true }] });
  if (/^\/v1\/locations\/cities\/\d+\/areas$/.test(url.pathname) && request.method === 'GET') return send(response, 200, { data: [] });
  if (url.pathname === '/v1/listings/toyota-corolla-contact' && request.method === 'GET') return send(response, 200, { data: publicListing });
  if (url.pathname === '/v1/listings/toyota-corolla-contact/similar' && request.method === 'GET') return send(response, 200, { data: [] });
  if (url.pathname === '/v1/listings/created-toyota-corolla' && request.method === 'GET') return send(response, 200, { data: { ...publicListing, publicId: 'lst_created_e2e', slug: 'created-toyota-corolla', title: 'Created Toyota Corolla' } });
  if (url.pathname === '/v1/listings/created-toyota-corolla/similar' && request.method === 'GET') return send(response, 200, { data: [] });
  const { identity: token, sessionKey } = authFrom(request);
  if (!token.startsWith('e2e_')) return send(response, 401, { error: { status: 401, code: 'UNAUTHORIZED', message: 'Test authentication required' } });

  if (url.pathname === '/v1/me' && request.method === 'GET') return send(response, 200, profile(token, sessionKey));
  if (url.pathname === '/v1/me' && request.method === 'PATCH') {
    const update = await readJson(request);
    profileUpdates.set(sessionKey, update);
    return send(response, 200, profile(token, sessionKey));
  }
  if (url.pathname === '/v1/auth/phone' && request.method === 'POST') return send(response, 200, { message: 'Phone verification started.' });
  if (url.pathname === '/v1/otp/send' && request.method === 'POST') return send(response, 200, { message: 'Verification code sent.' });
  if (url.pathname === '/v1/otp/verify' && request.method === 'POST') return send(response, 200, { message: 'Verification completed.' });
  if (url.pathname === '/v1/notifications/unread-count' && request.method === 'GET') {
    return send(response, 200, { count: readNotifications.has(sessionKey) ? 0 : 1 });
  }
  if (url.pathname === '/v1/me/listings/favorites' && request.method === 'GET') {
    const cursor = url.searchParams.get('cursor');
    if (cursor) return send(response, 200, { data: [nextFavorite], meta: { hasMore: false, nextCursor: null } });
    const data = favoriteRemovals.has(sessionKey) ? [nextFavorite] : [primaryFavorite];
    return send(response, 200, { data, meta: { hasMore: !favoriteRemovals.has(sessionKey), nextCursor: favoriteRemovals.has(sessionKey) ? null : 'fav_next' } });
  }
  if (/^\/v1\/listings\/[^/]+\/favorite$/.test(url.pathname) && request.method === 'DELETE') {
    favoriteRemovals.add(sessionKey);
    return send(response, 200, { data: { favorited: false } });
  }
  if (url.pathname === '/v1/me/saved-searches' && request.method === 'GET') {
    return send(response, 200, { data: deletedSearches.has(sessionKey) ? [] : [savedSearch] });
  }
  if (url.pathname === '/v1/me/saved-searches/ss_alpha' && request.method === 'PATCH') {
    const update = await readJson(request);
    return send(response, 200, { data: { ...savedSearch, ...update } });
  }
  if (url.pathname === '/v1/me/saved-searches/ss_alpha' && request.method === 'DELETE') {
    deletedSearches.add(sessionKey);
    response.writeHead(204, { 'x-request-id': 'req_e2e_fixed' });
    return response.end();
  }
  if (url.pathname === '/v1/notifications' && request.method === 'GET') {
    return send(response, 200, { data: [{ ...notification, readAt: readNotifications.has(sessionKey) ? NOW : null }], meta: { hasMore: false, nextCursor: null } });
  }
  if (url.pathname === '/v1/notifications/devices' && request.method === 'GET') return send(response, 200, { data: [] });
  if (url.pathname === '/v1/notifications/ntf_alpha/read' && request.method === 'PATCH') {
    readNotifications.add(sessionKey);
    return send(response, 200, { data: { ...notification, readAt: NOW } });
  }
  if (url.pathname === '/v1/notifications/read-all' && request.method === 'POST') {
    readNotifications.add(sessionKey);
    return send(response, 200, { count: 0 });
  }
  if (url.pathname === '/v1/files/upload' && request.method === 'POST') {
    request.resume();
    uploadSequence += 1;
    const publicId = `file_e2e_${uploadSequence}`;
    return send(response, 201, { data: { publicId, url: null, mimeType: 'image/png', sizeBytes: 1024, width: 192, height: 192, variants: null, thumbnailUrl: null, status: 'PROCESSING' } });
  }
  if (/^\/v1\/files\/file_e2e_\d+\/status$/.test(url.pathname) && request.method === 'GET') {
    const publicId = url.pathname.split('/')[3];
    return send(response, 200, { data: { publicId, status: 'READY', mimeType: 'image/jpeg', width: 1200, height: 630, url: 'http://127.0.0.1:3100/images/og-default.jpg', thumbnailUrl: null } });
  }
  if (url.pathname === '/v1/me/listings' && request.method === 'POST') {
    request.resume();
    return send(response, 201, { data: { ...listingCard('lst_created_e2e', 'created-toyota-corolla', 'Created Toyota Corolla'), isFavorited: false } });
  }
  if (url.pathname === '/v1/vendors/mine' && request.method === 'GET') return send(response, 200, { data: memberships(token) });
  if ((url.pathname === '/v1/leads/me' || /^\/v1\/vendors\/[^/]+\/leads$/.test(url.pathname)) && request.method === 'GET') {
    return send(response, 200, { data: token === 'e2e_buyer' ? [] : [lead], meta: { hasMore: false, nextCursor: null } });
  }
  if (/^\/v1\/(?:vendors\/[^/]+\/leads|leads\/me)\/lead_alpha$/.test(url.pathname) && request.method === 'GET') {
    return send(response, 200, { data: { ...lead, events: [{ type: 'CREATED', meta: null, createdAt: NOW }] } });
  }
  if (/^\/v1\/(?:vendors\/[^/]+\/leads|leads\/me)\/lead_alpha\/status$/.test(url.pathname) && request.method === 'PATCH') {
    const update = await readJson(request);
    return send(response, 200, { data: { ...lead, status: update.status ?? 'CONTACTED' } });
  }
  if (url.pathname === '/v1/leads' && request.method === 'POST') {
    const input = await readJson(request);
    return send(response, 201, { data: { ...lead, publicId: 'lead_contact_e2e', channel: input.channel ?? 'WHATSAPP', buyerPhone: input.buyerPhone ?? null, buyerName: input.buyerName ?? null, note: input.note ?? null } });
  }
  if (url.pathname === '/v1/reports' && request.method === 'POST') {
    const input = await readJson(request);
    return send(response, 201, { data: {
      publicId: 'rpt_contact_e2e', category: input.category ?? 'WRONG_INFO',
      details: input.details ?? null, status: 'RECEIVED', createdAt: NOW,
      listing: { publicId: publicListing.publicId, slug: publicListing.slug, title: publicListing.title },
    } });
  }
  if (/^\/v1\/vendors\/[^/]+\/analytics\/overview$/.test(url.pathname) && request.method === 'GET') {
    const days = Number(url.searchParams.get('days') ?? 30);
    return send(response, 200, { data: { window: { days, startAt: NOW }, summary: { activeListingsCount: 7, totalViews: 1240, totalLeads: 12, leadsByChannel: { WHATSAPP: 7, CALL_REVEAL: 5 }, totalFavorites: 31, responseRatePercentage: 91.5 } } });
  }
  return send(response, 404, { error: { status: 404, code: 'NOT_FOUND', message: 'Unknown deterministic test endpoint' } });
}).listen(3200, '127.0.0.1');
