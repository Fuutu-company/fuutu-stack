import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { workflowJob as job } from "./workflow-job";

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf-8");

const ci = read(".github/workflows/ci.yml");

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

/**
 * The artifact comes from the E2E job, whose dependency code controls it:
 * an empty or gutted artifact must not become a commit that deletes the
 * baselines. Runs the push job's replace step as GitHub would (bash -e,
 * pipefail). Small drops (orphans pruned by visual-prune.mjs) still pass;
 * a large deliberate prune is committed by hand.
 */
describe("visual-baselines replace step", () => {
	const step = (() => {
		const push = job(ci, "visual-baselines");
		const start = push.indexOf("- name: Replace baselines with the artifact");
		const rest = push.slice(start);
		const block = rest.slice(rest.indexOf("run: |\n") + "run: |\n".length);
		const lines: string[] = [];
		for (const line of block.split("\n")) {
			if (line.trim() !== "" && !line.startsWith(" ".repeat(10))) break;
			lines.push(line.slice(10));
		}
		return lines.join("\n");
	})();

	const run = (checkout: string[], artifact: string[]) => {
		const root = mkdtempSync(join(tmpdir(), "visual-replace-"));
		const dir = join(root, "repo", ".fuutu", "visual-baselines", "saas");
		const temp = join(root, "temp");
		mkdirSync(dir, { recursive: true });
		mkdirSync(join(temp, "baselines"), { recursive: true });
		for (const f of checkout) writeFileSync(join(dir, f), "old");
		for (const f of artifact) writeFileSync(join(temp, "baselines", f), "new");
		const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", step], {
			cwd: join(root, "repo"),
			env: { ...process.env, APP: "saas", RUNNER_TEMP: temp },
			encoding: "utf8",
		});
		const after = readdirSync(dir).sort();
		rmSync(root, { recursive: true, force: true });
		return { status: result.status, after, output: result.stdout };
	};
	const pngs = (n: number) =>
		Array.from({ length: n }, (_, i) => `page-${i}-chromium-linux.png`);

	it("is found in the workflow", () => {
		expect(step).toContain("-name '*.png'");
	});

	it("aborts when the artifact holds no PNG, keeping the baselines", () => {
		const { status, after } = run(pngs(10), ["notes.txt"]);
		expect(status).not.toBe(0);
		expect(after).toEqual(pngs(10).sort());
	});

	it("aborts when more than a fifth of the baselines would go", () => {
		const { status, after } = run(pngs(10), pngs(7));
		expect(status).not.toBe(0);
		expect(after).toEqual(pngs(10).sort());
	});

	it("replaces the baselines when a few orphans were pruned", () => {
		const { status, after } = run(pngs(10), pngs(9));
		expect(status).toBe(0);
		expect(after).toEqual(pngs(9).sort());
	});

	it("takes new baselines into an app that had none", () => {
		const { status, after } = run([], pngs(3));
		expect(status).toBe(0);
		expect(after).toEqual(pngs(3).sort());
	});
});
