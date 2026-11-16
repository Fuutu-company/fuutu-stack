import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The community Discord invite is never public: it is shown only inside
 * the signed-in app. No tracked file on a public surface — the repo
 * front page, contribution guide, GitHub templates, the marketing and
 * docs apps, and `@fuutu/config` (bundled into both) — carries a
 * `discord.gg/` invite link.
 */

const ROOT = join(import.meta.dirname, "../../../..");
const PUBLIC_PATHS = [
	"README.md",
	"CONTRIBUTING.md",
	".github",
	"apps/marketing",
	"apps/docs",
	"packages/config",
];
const INVITE = /discord\.gg\//i;

const tracked = execFileSync("git", ["ls-files", "-z", "--", ...PUBLIC_PATHS], {
	cwd: ROOT,
	encoding: "utf8",
})
	.split("\0")
	.filter(Boolean);

describe("Discord invite guard", () => {
	it("scans the tracked public files", () => {
		expect(tracked).toEqual(
			expect.arrayContaining([
				"README.md",
				"CONTRIBUTING.md",
				".github/ISSUE_TEMPLATE/config.yml",
				"apps/marketing/src/app-urls.ts",
				"packages/config/index.ts",
			]),
		);
		expect(tracked.some((file) => file.startsWith("apps/docs/"))).toBe(true);
	});

	it("no tracked public file links a discord.gg invite", () => {
		const offenders = tracked.filter((file) => {
			let text: string;
			try {
				text = readFileSync(join(ROOT, file), "utf8");
			} catch {
				return false;
			}
			return INVITE.test(text);
		});
		expect(offenders).toEqual([]);
	});
});
