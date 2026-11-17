import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { workflowJob as job } from "../workflow-job";

/**
 * Guard test: the kit repository's CI layout the E2E and DCO jobs depend on.
 *
 * - `next build` inlines `NEXT_PUBLIC_*` into client bundles. Locally every
 *   build runs through `tooling/scripts/next.mjs` (slot env); CI calls
 *   `next build` directly, so the E2E job sets the marketing URL itself —
 *   without it the saas user menu's legal links to marketing vanish.
 *   (Server components read it at runtime: `next.mjs start` sets it.)
 * - The docs job has no database: Prisma generate needs `DATABASE_URL`, and
 *   docs never import `@fuutu/db`, so its setup skips generation.
 * - DCO sign-off applies to external contributions: fork pull requests only.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../../");
const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf-8");

const ci = read(".github/workflows/ci.yml");

describe("ci workflow guard", () => {
	it("the saas E2E build gets the marketing URL its client bundle inlines", () => {
		const e2e = job(ci, "e2e");
		expect(e2e).not.toBe("");
		const env = e2e.slice(
			e2e.indexOf("\n    env:\n"),
			e2e.indexOf("\n    steps:\n"),
		);
		expect(env).toMatch(
			/^ {6}NEXT_PUBLIC_MARKETING_URL: http:\/\/localhost:3001$/m,
		);
	});

	it("the docs job skips Prisma generate (no DATABASE_URL, no @fuutu/db)", () => {
		const docs = job(ci, "e2e-docs");
		expect(docs).not.toBe("");
		expect(docs).toMatch(
			/- uses: \.\/\.github\/actions\/setup\n {8}with:\n {10}db-generate: "false"\n/,
		);
		const pkg = JSON.parse(read("apps/docs/package.json")) as {
			dependencies?: Record<string, string>;
		};
		expect(Object.keys(pkg.dependencies ?? {})).not.toContain("@fuutu/db");
	});
});

describe("dco workflow guard", () => {
	const dco = read(".github/workflows/dco.yml");
	const check = job(dco, "dco");

	it("runs only for pull requests from a fork", () => {
		expect(check).toContain(
			"\n    if: github.event.pull_request.head.repo.full_name != github.repository\n",
		);
	});

	it("still requires the author's Signed-off-by on every non-merge commit", () => {
		expect(check).toContain('trailer="Signed-off-by: $name <$email>"');
		expect(check).toContain('grep -Fxq -- "$trailer"');
		expect(check).toContain(
			'gh api --paginate "repos/$REPO/pulls/$PR_NUMBER/commits"',
		);
		expect(check).toContain('exit "$failed"');
	});
});
