import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { serverEnv } from '@/lib/env/server';

export const metadata: Metadata = {
  metadataBase: new URL(serverEnv.SITE_ORIGIN),
  applicationName: 'Arabiyatmart',
  title: "Arabiyatmart",
  description: "Egypt's trusted automotive marketplace",
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icons/icon-192.png',
    apple: { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
  },
  openGraph: {
    type: 'website',
    siteName: 'Arabiyatmart',
    images: [{ url: '/api/og/default?locale=ar', width: 1200, height: 630, alt: 'Arabiyatmart', type: 'image/png' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/api/og/default?locale=ar'],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
