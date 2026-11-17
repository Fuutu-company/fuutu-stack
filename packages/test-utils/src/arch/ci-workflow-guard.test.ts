import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: CI workflow settings the E2E and DCO jobs depend on.
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

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf-8");

/** A job's block from a workflow (jobs sit at two-space indent). */
function job(workflow: string, name: string): string {
	const start = workflow.indexOf(`\n  ${name}:\n`);
	if (start === -1) return "";
	const rest = workflow.slice(start + 1);
	const next = rest.slice(1).search(/\n {2}[\w-]+:\n/);
	return next === -1 ? rest : rest.slice(0, next + 1);
}

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

/**
 * Credentials stay out of reach of dependency code: the E2E job runs
 * `pnpm install`, `next build` and Playwright — code from node_modules can
 * plant hooks, `$GITHUB_ENV` entries or edit scripts for later steps of the
 * same job. So the E2E job holds no push token at all and only reads the
 * repo; it uploads the regenerated baselines as an artifact, and the
 * `visual-baselines` job — which runs no dependency code — pushes them from
 * a fresh checkout.
 */
describe("workflow credential guard", () => {
	const e2e = job(ci, "e2e");
	const push = job(ci, "visual-baselines");
	const jobEnv = e2e.slice(
		e2e.indexOf("\n    env:\n"),
		e2e.indexOf("\n    steps:\n"),
	);
	/** A job's `permissions:` block. */
	const permissions = (block: string) => {
		const start = block.indexOf("\n    permissions:\n");
		if (start === -1) return "";
		const rest = block.slice(start + 1);
		const end = rest.slice(1).search(/\n {4}[\w-]+:/);
		return end === -1 ? rest : rest.slice(0, end + 1);
	};

	it("the E2E checkout keeps no credentials in .git/config", () => {
		const checkout = e2e.slice(e2e.indexOf("- uses: actions/checkout@"));
		const withBlock = checkout.slice(0, checkout.indexOf("\n      - "));
		expect(withBlock).toMatch(/^ {10}persist-credentials: false$/m);
		expect(withBlock).not.toMatch(/^ {10}token:/m);
	});

	it("no secret is exposed in the E2E job env", () => {
		expect(jobEnv).not.toBe("");
		expect(jobEnv).not.toContain("secrets.");
	});

	it("the E2E job gets no push token and cannot write the repo", () => {
		expect(e2e).not.toContain("secrets.");
		expect(e2e).not.toContain("github.token");
		expect(e2e).not.toContain("ci-visual-baselines.sh");
		expect(permissions(e2e)).toMatch(/^ {6}contents: read( +#.*)?$/m);
		expect(permissions(e2e)).not.toMatch(/contents: write/);
	});

	it("the E2E job hands the baselines over as an artifact", () => {
		expect(e2e).toMatch(
			/uses: actions\/upload-artifact@v\d+\n {8}with:\n {10}name: visual-baselines-\$\{\{ matrix\.app \}\}\n {10}path: \.fuutu\/visual-baselines\/\$\{\{ matrix\.app \}\}\n/,
		);
	});

	it("the push job runs no dependency code", () => {
		expect(push).not.toBe("");
		expect(push).toContain("needs: e2e");
		expect(push).not.toContain("./.github/actions/setup");
		expect(push).not.toMatch(/\b(pnpm|npm|npx|yarn|node|bun)\b/);
		expect(push).not.toMatch(/^ {4}container:/m);
	});

	it("the push job copies only PNG files into the baseline dir", () => {
		expect(push).toMatch(/-name '\*\.png'/);
		expect(push).toMatch(/-type f/);
	});

	it("the push job checks out fresh, without stored credentials, and may write", () => {
		const checkout = push.slice(push.indexOf("- uses: actions/checkout@"));
		const withBlock = checkout.slice(0, checkout.indexOf("\n      - "));
		expect(withBlock).toMatch(/^ {10}persist-credentials: false$/m);
		expect(permissions(push)).toMatch(/^ {6}contents: write( +#.*)?$/m);
	});

	it("only the baseline push steps get the push token", () => {
		const steps = push
			.split("\n      - ")
			.filter((s) => s.includes("secrets.") || s.includes("github.token"));
		expect(steps.length).toBeGreaterThan(0);
		for (const step of steps) {
			expect(step).toContain("tooling/scripts/ci-visual-baselines.sh");
			expect(step).toMatch(/^ {10}GIT_PUSH_TOKEN: \$\{\{ /m);
		}
	});

	it("the baseline script authenticates git from env, not argv", () => {
		const script = read("tooling/scripts/ci-visual-baselines.sh");
		expect(script).toContain("GIT_PUSH_TOKEN");
		expect(script).toContain("GIT_CONFIG_KEY_0=");
		expect(script).not.toMatch(/git -c http/);
	});

	it("the version job runs no package install next to its deploy key", () => {
		const version = job(read(".github/workflows/version.yml"), "version");
		expect(version).not.toBe("");
		expect(version).not.toContain("./.github/actions/setup");
		expect(version).not.toMatch(/\bpnpm (install|i)\b/);
	});
});

describe("maintenance workflow guard", () => {
	const audit = job(read(".github/workflows/maintenance.yml"), "audit");

	it("reports production advisories (high and above) without failing", () => {
		expect(audit).toMatch(
			/^ +pnpm audit --prod --audit-level=high \|\| true$/m,
		);
		expect(audit).toContain('>> "$GITHUB_STEP_SUMMARY"');
	});
});
