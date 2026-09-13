FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG APP_ENV=development
ARG SITE_ORIGIN=https://arabiyatmart.com
ARG NEXT_PUBLIC_SITE_ORIGIN=https://arabiyatmart.com
ARG BACKEND_API_ORIGIN=https://api.arabiyatmart.com
ARG NEXT_PUBLIC_API_BASE_URL=https://api.arabiyatmart.com
ARG MEDIA_CDN_ORIGIN=https://api.arabiyatmart.com
ARG NEXT_PUBLIC_MEDIA_CDN_ORIGIN=https://api.arabiyatmart.com
ARG JWT_ACCESS_SECRET=arabiyatmart-dev-access-secret-32chars!!
ARG JWT_REFRESH_SECRET=arabiyatmart-dev-refresh-secret-32chars!

ENV APP_ENV=$APP_ENV \
    SITE_ORIGIN=$SITE_ORIGIN \
    NEXT_PUBLIC_SITE_ORIGIN=$NEXT_PUBLIC_SITE_ORIGIN \
    BACKEND_API_ORIGIN=$BACKEND_API_ORIGIN \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    MEDIA_CDN_ORIGIN=$MEDIA_CDN_ORIGIN \
    NEXT_PUBLIC_MEDIA_CDN_ORIGIN=$NEXT_PUBLIC_MEDIA_CDN_ORIGIN \
    JWT_ACCESS_SECRET=$JWT_ACCESS_SECRET \
    JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/tsconfig.json ./tsconfig.json

USER nextjs
EXPOSE 3001

CMD ["npm", "run", "start"]
