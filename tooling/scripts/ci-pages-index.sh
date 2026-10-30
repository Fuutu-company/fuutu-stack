#!/usr/bin/env bash
# Regenerate the gh-pages index tree (root listing + per-dir landing pages)
# so visual reports are navigable from the Pages root. Called by ci.yml
# after the report deploy; a rejected push (fork PR) warns — the next
# deploy regenerates the index. The index embeds per-dir last-commit
# timestamps and PR titles, so it is regenerated inside the retry loop on
# top of the latest origin/gh-pages — concurrent matrix-leg pushes
# converge instead of conflicting on index.html.
# Requires: GH_TOKEN (gh api), GITHUB_WORKSPACE, GITHUB_REPOSITORY.
set -euo pipefail

repo="$GITHUB_WORKSPACE"
wt=/tmp/gh-pages
meta=/tmp/pr-meta.json
cd "$repo"
git worktree remove --force "$wt" 2>/dev/null || true
if ! git fetch origin gh-pages; then
  echo "::warning::gh-pages branch not found — skipping index update"
  exit 0
fi
git worktree add --detach "$wt" origin/gh-pages
cd "$wt"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
pushed=0
for attempt in 1 2 3; do
  git fetch origin gh-pages
  git reset --hard origin/gh-pages
  # PR metadata → /tmp/pr-meta.json: title + head branch via `gh api`
  # (failures tolerated → the "PR #N" fallback renders), last-commit time
  # for the dir via `git log` (→ "updated").
  echo '{}' > "$meta"
  for d in "$wt"/pr-*/; do
    [ -d "$d" ] || continue
    name="$(basename "$d")"
    n="${name#pr-}"
    info="$(gh api "repos/$GITHUB_REPOSITORY/pulls/$n" --jq '{title, branch: .head.ref}' 2>/dev/null || echo '{}')"
    updated="$(git -C "$wt" log -1 --format=%cI -- "$name" 2>/dev/null || true)"
    node -e '
      const fs = require("node:fs");
      const [metaPath, num, infoJson, upd] = process.argv.slice(1);
      const m = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      let info = {};
      try { info = JSON.parse(infoJson || "{}"); } catch {}
      m[num] = { ...info, ...(upd ? { updated: upd } : {}) };
      fs.writeFileSync(metaPath, JSON.stringify(m));
    ' "$meta" "$n" "$info" "$updated"
  done
  node "$repo/tooling/scripts/visual-pages-index.mjs" "$wt" --pr-meta "$meta"
  git add -A
  if git diff --cached --quiet; then
    echo "index unchanged — nothing to commit"
    pushed=1
    break
  fi
  git commit -m "chore(pages): update visual-report index [skip ci]"
  if git push origin "HEAD:gh-pages"; then
    pushed=1
    break
  fi
done
if [ "$pushed" != "1" ]; then
  echo "::warning::Could not push gh-pages index update after 3 attempts (fork PR?). It regenerates on the next deploy."
fi
cd "$repo"
git worktree remove --force "$wt" 2>/dev/null || true
