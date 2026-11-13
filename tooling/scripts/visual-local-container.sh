#!/usr/bin/env bash
# Runs INSIDE the Playwright container (see visual-local.mjs) — mirrors the CI
# e2e job: install, db push + seed (saas), prod build, visual specs.
# Mounts: /src (repo, read-only) · /out (<work>/<app>, holds ./actual) · /pnpm-store (volume)
# Env:    APP, HOST_UID, HOST_GID, DATABASE_URL (saas)
set -uo pipefail

export CI=1 FUUTU_TELEMETRY_DISABLED=1 PLAYWRIGHT_USE_PROD=1 HOME=/tmp/pw-home
export SWC_NATIVE_BINDING_CACHE=/tmp/swc-binding-cache
export FUUTU_VISUAL_SNAPSHOT_DIR=/out/actual
mkdir -p "$HOME" /work

# Host node_modules / build output are macOS/Windows binaries — leave them out
# and install fresh. Never copy any .env (host secrets, dev DB) — the patterns
# are unanchored so nested app .env files are dropped too — nor agent state
# (.claude holds worktrees with their own .env).
tar -C /src \
  --exclude=./node_modules --exclude='*/node_modules' \
  --exclude='*/.next' --exclude='*/.next-e2e' --exclude=./.git --exclude='*/.turbo' --exclude=./.turbo \
  --exclude='.env' --exclude='.env.*' --exclude='.claude' --exclude=./.fuutu \
  --exclude='*/test-results' --exclude='*/playwright-report' --exclude='*/visual-report' \
  -cf - . | tar -C /work -xf -
cd /work || exit 1

fail() { echo "visual-local: $1" >&2; finish 1; }
finish() {
  # Hand results back to the host user (Linux hosts: files would be root-owned).
  chown -R "${HOST_UID:-0}:${HOST_GID:-0}" /out 2>/dev/null || true
  exit "$1"
}

PNPM_VERSION="$(node -p 'require("./package.json").packageManager.split("@")[1]')"
npm install -g "pnpm@${PNPM_VERSION}" >/dev/null 2>&1 || fail "could not install pnpm@${PNPM_VERSION}"
pnpm config set store-dir /pnpm-store >/dev/null

# Minimal env only — no host provider secrets reach the container.
cat > .env <<ENV
DATABASE_URL=${DATABASE_URL:-postgresql://postgres:password@postgres:5432/fuutu-stack}
BETTER_AUTH_URL=http://localhost:3000
EMAIL_PROVIDER=console
NEXT_PUBLIC_ANALYTICS_PROVIDER=noop
FUUTU_TELEMETRY_DISABLED=1
ENV
if [ "$APP" = "saas" ]; then
  {
    echo "FUUTU_DISABLE_RATE_LIMIT=1"
    echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)"
  } >> .env
fi

# `next build` only reads apps/<app>/.env — CI passes these as job env, so do
# the same here (a build without BETTER_AUTH_SECRET/URL fails env validation).
set -a
. ./.env
set +a

pnpm install --frozen-lockfile || fail "pnpm install failed"
if [ "$APP" = "saas" ]; then
  pnpm db:generate || fail "db:generate failed"
  pnpm db:push || fail "db:push failed"
  NODE_ENV=development pnpm db:seed || fail "db:seed failed"
fi
pnpm -F "@fuutu/$APP" build || fail "build failed"

# --update-snapshots "passes" on pixel diffs — the report diffs ./actual against
# the pristine copy in /out/../expected, exactly like CI diffs against git HEAD.
pnpm -F "@fuutu/$APP" exec playwright test tests/visual.spec.ts \
  --update-snapshots --project=chromium --project=mobile-safari --reporter=list
status=$?
finish "$status"
