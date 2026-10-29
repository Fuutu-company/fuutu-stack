#!/usr/bin/env bash
# Prune pr-<N>/ visual-report dirs on the gh-pages branch once their PR is
# closed. Runs from a default-branch checkout; fetches gh-pages into a
# temporary worktree, prunes, commits and pushes. Needs GH_TOKEN (gh CLI).
set -euo pipefail
shopt -s nullglob

wt=".gh-pages-prune"
cleanup() { git worktree remove --force "$wt" 2>/dev/null || true; }
trap cleanup EXIT
cleanup

if ! git fetch origin gh-pages 2>/dev/null; then
	echo "gh-pages branch does not exist yet — nothing to prune"
	exit 0
fi
git worktree add --detach "$wt" origin/gh-pages >/dev/null

cd "$wt"
dirs=(pr-*/)
if [ ${#dirs[@]} -eq 0 ]; then
	echo "no pr-* report dirs — nothing to prune"
	exit 0
fi

open_prs=$(gh api "repos/{owner}/{repo}/pulls?state=open&per_page=100" --paginate --jq '.[].number')
is_open() { grep -qx "$1" <<<"$open_prs"; }

removed=0
for d in "${dirs[@]}"; do
	n="${d#pr-}"
	n="${n%/}"
	[[ "$n" =~ ^[0-9]+$ ]] || continue
	if ! is_open "$n"; then
		echo "pruning $d (PR #$n is closed)"
		git rm -rq "$d"
		removed=$((removed + 1))
	fi
done

if [ "$removed" -eq 0 ]; then
	echo "nothing to prune"
	exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git commit -m "chore(pages): prune visual reports of closed PRs [skip ci]"

# Another cleanup or a fresh deploy may have pushed first — rebase + retry.
for attempt in 1 2 3; do
	git fetch origin gh-pages
	if git rebase origin/gh-pages && git push origin "HEAD:gh-pages"; then
		echo "pruned $removed report dir(s)"
		exit 0
	fi
done

echo "::warning::Could not push gh-pages cleanup after 3 attempts."
exit 1
