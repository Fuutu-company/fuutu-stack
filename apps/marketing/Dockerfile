# syntax=docker/dockerfile:1
# apps/marketing — public marketing site
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
RUN pnpm dlx turbo@^2.11.5 prune @fuutu/marketing --docker

# ------------------------------------------------------------- installer ----
# Cached dependency layer: only package.json files + the pruned lockfile
# (out/json) — a source-only change never re-downloads packages.
# NOTE: `pnpm fetch` is deliberately not used — it resolves and would
# enforce `minimumReleaseAge` against lockfile entries; plain
# `--frozen-lockfile` install does not.
FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# --------------------------------------------------------------- builder ----
FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
# NOTE: @fuutu/db may ride along transitively but must never be
# imported by marketing (bundle-clean rule) — no prisma generate here.
# NEXT_PUBLIC_* is inlined into the client bundle — real values come
# from the deploy platform's build variables, NOT the runtime env.
ARG NEXT_PUBLIC_MARKETING_URL
ARG NEXT_PUBLIC_SAAS_URL
ARG NEXT_PUBLIC_DOCS_URL
ARG NEXT_PUBLIC_ANALYTICS_PROVIDER
ARG NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT
ARG NEXT_PUBLIC_ANALYTICS_SHOW_CONSENT_BANNER
ARG NEXT_PUBLIC_ANALYTICS_CONSENT_DOMAIN
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID
ARG NEXT_PUBLIC_UMAMI_SCRIPT_URL
ENV SKIP_ENV_VALIDATION=1
# Build-time telemetry emission point (only present when
# @fuutu/telemetry is in this app's pruned workspace).
RUN if [ -f packages/telemetry/bin/ping.mjs ]; then node packages/telemetry/bin/ping.mjs || true; fi
RUN pnpm --filter @fuutu/marketing build

# ---------------------------------------------------------------- runner ----
FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
COPY --from=builder --chown=node:node /app/apps/marketing/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/marketing/.next/static ./apps/marketing/.next/static
COPY --from=builder --chown=node:node /app/apps/marketing/public ./apps/marketing/public
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/marketing/server.js"]
