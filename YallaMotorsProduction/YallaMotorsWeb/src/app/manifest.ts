import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/ar',
    name: 'عربيات مارت | Arabiyatmart',
    short_name: 'عربيات مارت',
    description: 'السوق الموثوق لبيع وشراء السيارات في مصر',
    start_url: '/ar',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0b4ea2',
    lang: 'ar',
    dir: 'rtl',
    categories: ['automotive', 'shopping'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
