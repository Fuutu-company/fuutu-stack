import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: local E2E servers (`next.mjs e2e <app>`) seed like CI. Without a
 * Pro price id the seed puts Acme on Free, so plan-gated specs (webhooks)
 * and limit-bound ones (API keys, 2 per org on Free) failed locally only.
 */
const REPO_ROOT = join(import.meta.dirname, "../../../../");
const launcher = readFileSync(
	join(REPO_ROOT, "tooling", "scripts", "next.mjs"),
	"utf8",
);

describe("local E2E matches CI", () => {
	it("defaults PAYMENTS_PRO_PRICE_ID in the e2e env, keeping a set value", () => {
		const e2eEnv = launcher.match(/\.\.\.\(e2e && \{([\s\S]*?)\}\)/)?.[1];
		expect(e2eEnv).toMatch(
			/PAYMENTS_PRO_PRICE_ID:\s*process\.env\.PAYMENTS_PRO_PRICE_ID \|\| "[^"]+"/,
		);
	});
});
