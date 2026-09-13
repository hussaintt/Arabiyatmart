import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import {
  getSecurityHeaders,
  getAllowedImageRemotePatterns,
} from "./src/lib/security/headers";
import { validateServerEnv } from "./src/lib/env/schema";

// Acceptance gate: Initialize environment validation during configuration initialization.
// A real production build (APP_ENV=production) missing required secrets, using non-HTTPS
// origins, or missing Redis idempotency fails field-specifically without leaking secret values.
// Ordinary local DoD builds (APP_ENV absent or development) run development validation.
if (process.env.APP_ENV === "production") {
  validateServerEnv(process.env, { isProduction: true });
} else {
  validateServerEnv(process.env, { isProduction: false });
}

const isProduction =
  process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(process.env.RELEASE ? { deploymentId: process.env.RELEASE } : {}),
  images: {
    domains: [
      "api.arabiyatmart.com",
      "images.unsplash.com",
      "lh3.googleusercontent.com",
      "appleid.cdn-apple.com",
    ],
    remotePatterns: getAllowedImageRemotePatterns({
      isProduction,
      backendOrigin: process.env.BACKEND_API_ORIGIN,
      mediaCdnOrigin: process.env.MEDIA_CDN_ORIGIN,
    }),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: getSecurityHeaders({
          isProduction,
          backendOrigin: process.env.BACKEND_API_ORIGIN,
          mediaCdnOrigin: process.env.MEDIA_CDN_ORIGIN,
          siteOrigin: process.env.SITE_ORIGIN,
          reportOnly: process.env.CSP_REPORT_ONLY === "true",
        }),
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
