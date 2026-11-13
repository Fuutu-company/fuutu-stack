import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: every `authConfig.redirects.*` key must be read by app or
 * package code. A key nobody reads is dead config — buyers edit it and
 * nothing changes (this happened with afterSignOut / afterEmailVerification).
 *
 * Static analysis (no imports): keys are parsed from the `redirects` block
 * of packages/auth/src/config.ts; usages are `redirects.<key>` occurrences
 * in non-test sources under apps/saas/src and packages/<pkg>/src.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const CONFIG_PATH = join(REPO_ROOT, "packages", "auth", "src", "config.ts");

function redirectKeys(): string[] {
	const source = readFileSync(CONFIG_PATH, "utf8");
	const block = source.match(/redirects:\s*\{([^}]*)\}/);
	if (!block?.[1]) throw new Error("authConfig.redirects block not found");
	return [...block[1].matchAll(/(\w+)\s*:/g)].map((m) => m[1] as string);
}

function listSources(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name === "__tests__") continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...listSources(full));
		else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name))
			out.push(full);
	}
	return out;
}

function allSources(): string[] {
	const packagesDir = join(REPO_ROOT, "packages");
	const pkgSrcDirs = readdirSync(packagesDir, { withFileTypes: true })
		.filter((e) => e.isDirectory())
		.map((e) => join(packagesDir, e.name, "src"))
		.filter((dir) => {
			try {
				readdirSync(dir);
				return true;
			} catch {
				return false;
			}
		});
	return [join(REPO_ROOT, "apps", "saas", "src"), ...pkgSrcDirs]
		.flatMap(listSources)
		.filter((file) => file !== CONFIG_PATH);
}

describe("auth redirects guard", () => {
	const sources = allSources().map((file) => ({
		file,
		text: readFileSync(file, "utf8"),
	}));

	it("parses the redirect keys", () => {
		expect(redirectKeys()).toEqual(
			expect.arrayContaining(["afterSignIn", "afterSignOut"]),
		);
	});

	for (const key of redirectKeys()) {
		it(`authConfig.redirects.${key} is read somewhere`, () => {
			const readers = sources.filter(({ text }) =>
				text.includes(`redirects.${key}`),
			);
			expect(readers.map((r) => r.file)).not.toEqual([]);
		});
	}

	it("sign-out call sites land on redirects.afterSignOut", () => {
		const signOutSites = sources.filter(({ text }) => /\bsignOut\(/.test(text));
		expect(signOutSites.length).toBeGreaterThan(0);
		for (const { file, text } of signOutSites) {
			expect(text, file).toContain("redirects.afterSignOut");
		}
	});
});
