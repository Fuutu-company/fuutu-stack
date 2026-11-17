import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The kit's auth link pages read the one-time token from `?token=` and drop
 * it from the address bar with `useStripQueryParam` (helper unit-tested in
 * `../app-auth-url-token.test.ts`).
 */

const SAAS = join(import.meta.dirname, "../../../../../apps/saas/src");

describe("auth link pages strip the token after reading it", () => {
	for (const file of [
		"app/auth/verify/page.tsx",
		"modules/auth/components/auth-reset-password.tsx",
	]) {
		it(file, () => {
			const source = readFileSync(join(SAAS, file), "utf-8");
			expect(source).toMatch(/useStripQueryParam\(\s*["']token["']/);
		});
	}
});
