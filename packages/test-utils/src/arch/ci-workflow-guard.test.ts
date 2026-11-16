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
 * `pnpm install`, `next build` and Playwright, so no token may sit in
 * `.git/config` or the job env. The bot token reaches only the baseline
 * push script, through step env.
 */
describe("workflow credential guard", () => {
	const e2e = job(ci, "e2e");
	const jobEnv = e2e.slice(
		e2e.indexOf("\n    env:\n"),
		e2e.indexOf("\n    steps:\n"),
	);

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

	it("only the baseline push steps get the push token", () => {
		const steps = e2e.split("\n      - ").filter((s) => s.includes("secrets."));
		expect(steps.length).toBeGreaterThan(0);
		for (const step of steps) {
			expect(step).toContain("tooling/scripts/ci-visual-baselines.sh");
			expect(step).toMatch(/^ {10}GIT_PUSH_TOKEN: \$\{\{ secrets\./m);
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
