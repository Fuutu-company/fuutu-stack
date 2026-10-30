#!/usr/bin/env bash
# Writes code=true|false to $GITHUB_OUTPUT — false when the diff is only
# docs/images/asset files, so all downstream jobs skip cheaply (e.g. the
# bot's baseline-only commits on a PR branch).
# Env (set by ci.yml): EVENT_NAME, BASE_REF, EVENT_BEFORE, GITHUB_OUTPUT.
set -euo pipefail

if [ "$EVENT_NAME" = "pull_request" ]; then
  git fetch origin "$BASE_REF" --depth=1
  DIFF=$(git diff --name-only "origin/$BASE_REF" HEAD)
else
  BEFORE="$EVENT_BEFORE"
  if [ -z "$BEFORE" ] || [ "$BEFORE" = "0000000000000000000000000000000000000000" ]; then
    BEFORE="HEAD~1"
  fi
  DIFF=$(git diff --name-only "$BEFORE" HEAD)
fi
if echo "$DIFF" | grep -qvE '\.(md|png|jpe?g|svg|webp|gif|ico|mp4|woff2?|ttf)$|(^|/)(README|CHANGELOG|LICENSE)(\.md)?$'; then
  echo "code=true" >> "$GITHUB_OUTPUT"
else
  echo "code=false" >> "$GITHUB_OUTPUT"
fi
