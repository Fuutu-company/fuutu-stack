# syntax=docker/dockerfile:1
# apps/docs — documentation site (Fumadocs)
# Build context MUST be the repo root (turbo prune produces a minimal
# workspace). See DEPLOY.md for the full Coolify/Railpack setup.

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
RUN pnpm dlx turbo@^2.11.5 prune @fuutu/docs --docker

# ------------------------------------------------------------- installer ----
# Cached dependency layer: only package.json files + the pruned lockfile
# (out/json) — a source-only change never re-downloads packages.
# NOTE: `pnpm fetch` is deliberately not used — it resolves and would
# enforce `minimumReleaseAge` against lockfile entries; plain
# `--frozen-lockfile` install does not.
FROM base AS installer
COPY --from=pruner /app/out/json/ .
# --ignore-scripts: the apps/docs postinstall (fumadocs-mdx) needs
# source.config.ts which only exists in out/full — it runs explicitly
# in the builder stage below.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# --------------------------------------------------------------- builder ----
FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
# Generate .source/ (gitignored fumadocs-mdx output, normally produced
# by the postinstall hook we skipped during install).
RUN pnpm --filter @fuutu/docs run postinstall
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
RUN pnpm --filter @fuutu/docs build

# ---------------------------------------------------------------- runner ----
FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=4000
COPY --from=builder --chown=node:node /app/apps/docs/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/docs/.next/static ./apps/docs/.next/static
COPY --from=builder --chown=node:node /app/apps/docs/public ./apps/docs/public
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/docs/server.js"]
