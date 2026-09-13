import type { MetadataRoute } from 'next';
import { serverEnv } from '@/lib/env/server';

export default function robots(): MetadataRoute.Robots {
  const origin = serverEnv.SITE_ORIGIN.replace(/\/$/, '');
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/ar', '/en', '/ar/search', '/en/search', '/ar/listing/', '/en/listing/', '/ar/dealers', '/en/dealers', '/ar/catalogue/', '/en/catalogue/'],
      disallow: [
        '/api/',
        '/*/login', '/*/register', '/*/register-success', '/*/verify-email', '/*/forgot-password', '/*/reset-password',
        '/*/favorites', '/*/profile', '/*/notifications', '/*/saved-searches', '/*/sell', '/*/me/', '/*/best-offer/',
        '/*/compare', '/*/forbidden',
        '/*?*cursor=', '/*?*page=', '/*?*panel=', '/*?*returnTo=', '/*?*token=', '/*?*utm_',
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
