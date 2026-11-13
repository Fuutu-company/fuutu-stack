import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: the dev seed's demo invoices use the plan catalog's
 * `BILLING_CURRENCY` (@fuutu/payments/config) — the seed cannot import it
 * (@fuutu/payments depends on @fuutu/db), so this keeps the copies aligned
 * when a project switches currency.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf-8");

describe("seed currency guard", () => {
	it("seeded invoices use BILLING_CURRENCY", () => {
		const billing = read("packages/payments/src/config.ts").match(
			/export const BILLING_CURRENCY\s*=\s*"([a-zA-Z]{3})"/,
		)?.[1];
		expect(billing, "BILLING_CURRENCY not found").toBeDefined();

		const seeded = [
			...read("packages/db/prisma/seed.ts").matchAll(
				/\bcurrency:\s*"([a-zA-Z]{3})"/g,
			),
		].map((m) => m[1]?.toLowerCase());
		expect(seeded.length).toBeGreaterThan(0);
		for (const currency of seeded) {
			expect(currency).toBe(billing?.toLowerCase());
		}
	});
});
