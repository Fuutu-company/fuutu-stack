#!/usr/bin/env bash
# Commit regenerated visual baselines back to the branch (PR head or pushed branch).
# Usage: ci-visual-baselines.sh <app> <branch> <mode>   mode = pr | push
# Writes pushed=1 to $GITHUB_OUTPUT when the push succeeds.
set -euo pipefail
app="$1"; branch="$2"; mode="${3:-push}"
dir=".fuutu/visual-baselines/${app}"

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add "$dir"
if git diff --cached --quiet; then
  echo "Baselines unchanged — nothing to commit"
  exit 0
fi
if [ "$mode" = "push" ]; then
  git commit -m "chore(visual): update ${app} baselines [skip ci]"
else
  git commit -m "chore(visual): update ${app} baselines"
fi

# A sibling matrix leg may push its own baseline commit first — rebase + retry.
for attempt in 1 2 3; do
  git fetch origin "$branch"
  if git rebase "origin/${branch}" && git push origin "HEAD:${branch}"; then
    echo "pushed=1" >> "$GITHUB_OUTPUT"
    exit 0
  fi
done

if [ "$mode" = "push" ]; then
  echo "::warning::Baseline push rejected (branch protection?) — baselines arrive via PR-branch commits instead."
else
  echo "::warning::Could not push baselines to ${branch} (fork PR?). Regenerate locally: pnpm -F @fuutu/${app} exec playwright test tests/visual.spec.ts --update-snapshots"
fi
