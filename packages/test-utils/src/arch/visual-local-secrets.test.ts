import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const read = (...p: string[]) => readFileSync(join(REPO_ROOT, ...p), "utf8");

describe("visual-local: container never receives host secrets", () => {
	const script = read("tooling", "scripts", "visual-local-container.sh");
	const excludes = [...script.matchAll(/--exclude=('([^']*)'|(\S+))/g)].map(
		(m) => m[2] ?? m[3] ?? "",
	);

	/**
	 * GNU tar (the container's) matches an unanchored `--exclude` pattern
	 * without a slash against every path component; `./x` only matches the
	 * archive root.
	 */
	const globToRegExp = (glob: string) =>
		new RegExp(
			`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
		);
	const excluded = (path: string) =>
		excludes.some((pattern) =>
			pattern.includes("/")
				? globToRegExp(pattern).test(`./${path}`)
				: path.split("/").some((part) => globToRegExp(pattern).test(part)),
		);

	it("excludes .env files at every depth, unanchored", () => {
		expect(excludes).toContain(".env");
		expect(excludes).toContain(".env.*");
		expect(excludes.filter((p) => p.startsWith("./.env"))).toEqual([]);
		for (const path of [
			".env",
			".env.local",
			"apps/saas/.env",
			"apps/saas/.env.local",
			"apps/marketing/.env.production",
			"packages/db/.env",
		]) {
			expect(excluded(path), path).toBe(true);
		}
	});

	it("excludes agent state (.claude, incl. worktrees with their own .env)", () => {
		expect(excludes).toContain(".claude");
		expect(excluded(".claude/worktrees/x/apps/saas/src/page.tsx")).toBe(true);
	});

	it("still copies the source", () => {
		for (const path of [
			"apps/saas/src/app/layout.tsx",
			"packages/env/src/saas.ts",
			"package.json",
		]) {
			expect(excluded(path), path).toBe(false);
		}
	});

	it("writes only the minimal env vars into the container's .env", () => {
		const body = script.match(/cat > \.env <<ENV\n([\s\S]*?)\nENV/)?.[1];
		const keys = (body ?? "").split("\n").map((line) => line.split("=")[0]);
		expect(keys).toEqual([
			"DATABASE_URL",
			"BETTER_AUTH_URL",
			"EMAIL_PROVIDER",
			"NEXT_PUBLIC_ANALYTICS_PROVIDER",
			"NEXT_PUBLIC_MARKETING_URL",
			"PAYMENTS_PRO_PRICE_ID",
			"FUUTU_TELEMETRY_DISABLED",
			// Required by the production build / server, like in CI.
			"TRUST_PROXY_HEADERS",
			// The seed refuses the compose host `postgres` without it.
			"FUUTU_ALLOW_SEED",
		]);
		// The only interpolated host value is the throwaway container DB.
		expect(body?.match(/\$\{?\w+/g)).toEqual(["${DATABASE_URL"]);
	});

	it("passes no host environment into the container", () => {
		const runner = read("tooling", "scripts", "visual-local.mjs");
		const dockerApp = runner.slice(
			runner.indexOf("async function dockerApp"),
			runner.indexOf("// ── Native mode"),
		);
		expect(dockerApp).not.toContain("process.env");
		expect(dockerApp).not.toContain("--env-file");
	});
});
