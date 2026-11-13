# syntax=docker/dockerfile:1
# apps/saas — authed app (Next.js + Hono /api/*)
# Build context MUST be the repo root (turbo prune produces a minimal
# workspace). Full Coolify/Railpack setup: https://docs.fuutustack.com/docs/deployment

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN apk add --no-cache libc6-compat && corepack enable
WORKDIR /app

# ---------------------------------------------------------------- prune ----
FROM base AS pruner
COPY . .
# Turbo version tracks the workspace catalog (pnpm-workspace.yaml).
RUN pnpm dlx turbo@^2.11.5 prune @fuutu/saas --docker

# ------------------------------------------------------------- installer ----
# Cached dependency layer: only package.json files + the pruned lockfile
# (out/json) — a source-only change never re-downloads packages.
# NOTE: `pnpm fetch` is deliberately not used — it resolves and would
# enforce `minimumReleaseAge` against lockfile entries; plain
# `--frozen-lockfile` install does not.
FROM base AS installer
COPY --from=pruner /app/out/json/ .
# --ignore-scripts: workspace lifecycle scripts (e.g. fumadocs-mdx in
# apps/docs, prisma generate) need source files that only exist in
# out/full — they run explicitly in the builder stage below.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# --------------------------------------------------------------- builder ----
FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
# Prisma client output (packages/db/prisma/generated) is gitignored —
# generate it inside the image. prisma.config.ts requires DATABASE_URL
# to exist; a dummy is sufficient for codegen.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm --filter @fuutu/db exec prisma generate
# NEXT_PUBLIC_* is inlined into the client bundle — real values come
# from the deploy platform's build variables, NOT the runtime env.
ARG NEXT_PUBLIC_MARKETING_URL
ARG NEXT_PUBLIC_SAAS_URL
ARG NEXT_PUBLIC_ANALYTICS_PROVIDER
ARG NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT
ARG NEXT_PUBLIC_ANALYTICS_SHOW_CONSENT_BANNER
ARG NEXT_PUBLIC_ANALYTICS_CONSENT_DOMAIN
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID
ARG NEXT_PUBLIC_UMAMI_SCRIPT_URL
# Server env (DATABASE_URL, BETTER_AUTH_*) is validated at boot, not at
# build — SKIP_ENV_VALIDATION is the documented escape hatch for builds.
ENV SKIP_ENV_VALIDATION=1
# Build-time telemetry emission point (mirrors the root `prebuild`
# script; exits 0, 5 s timeout, never fails the build).
RUN if [ -f packages/telemetry/bin/ping.mjs ]; then node packages/telemetry/bin/ping.mjs || true; fi
RUN pnpm --filter @fuutu/saas build

# -------------------------------------------------------------- migrator ----
# One-shot `prisma migrate deploy` image (the runner ships no prisma CLI).
#   docker build --target migrator -f apps/saas/Dockerfile -t app-migrate .
#   docker run --rm -e DATABASE_URL=postgresql://… app-migrate
FROM base AS migrator
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
WORKDIR /app/packages/db
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

# ---------------------------------------------------------------- runner ----
FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder --chown=node:node /app/apps/saas/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/saas/.next/static ./apps/saas/.next/static
COPY --from=builder --chown=node:node /app/apps/saas/public ./apps/saas/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/version').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/saas/server.js"]
