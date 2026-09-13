/** Resolve backend upload paths against the configured media host before validation.
 * Only known marketplace media fields are adapted; malformed URLs still fail the schema.
 */
export function resolveMarketplaceMedia(payload: unknown, mediaOrigin: string): unknown {
  const resolve = (value: unknown): unknown => {
    if (typeof value !== 'string' || !/^\/uploads\/[a-zA-Z0-9/_.-]+$/.test(value)) return value;
    if (value.split('/').some(segment => segment === '.' || segment === '..')) return value;
    return new URL(value, mediaOrigin).toString();
  };
  const listing = (value: unknown): unknown => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const item = value as Record<string, unknown>;
    return {
      ...item,
      ...Object.fromEntries(['coverImageUrl', 'coverThumbnailUrl', 'coverMediumUrl', 'makeLogoUrl', 'logoUrl'].filter(key => key in item).map(key => [key, resolve(item[key])])),
      ...(Array.isArray(item.images) ? { images: item.images.map(image => {
        if (!image || typeof image !== 'object') return image;
        const img = image as Record<string, unknown>;
        return {
          ...img,
          url: resolve(img.url),
          ...(img.thumbnailUrl !== undefined ? { thumbnailUrl: resolve(img.thumbnailUrl) } : {}),
          ...(img.mediumUrl !== undefined ? { mediumUrl: resolve(img.mediumUrl) } : {}),
          ...(img.largeUrl !== undefined ? { largeUrl: resolve(img.largeUrl) } : {}),
        };
      }) } : {}),
      ...(item.vendor && typeof item.vendor === 'object' && !Array.isArray(item.vendor)
        ? { vendor: { ...item.vendor, logoUrl: resolve((item.vendor as Record<string, unknown>).logoUrl) } } : {}),
    };
  };
  if (Array.isArray(payload)) return payload.map(listing);
  if (!payload || typeof payload !== 'object') return payload;
  const envelope = payload as Record<string, unknown>;
  if (!('data' in envelope)) return payload;
  return { ...envelope, data: Array.isArray(envelope.data) ? envelope.data.map(listing) : listing(envelope.data) };
}
