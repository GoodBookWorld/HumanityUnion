# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages/types ./packages/types
RUN pnpm --filter @hu/api build

FROM node:20-alpine AS runner
RUN apk add --no-cache wget
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 hu && adduser --system --uid 1001 --ingroup hu hu

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/types ./packages/types

USER hu
WORKDIR /app/apps/api
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-4000}/api/v1/health || exit 1

# Production must run compiled output (not tsx watch / start:prod).
CMD ["node", "dist/index.js"]
