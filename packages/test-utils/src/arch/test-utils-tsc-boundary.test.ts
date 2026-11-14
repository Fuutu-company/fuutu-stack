import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * This package type-checks without `jsx`. App files may import `.tsx`
 * (e.g. `appFooter.actions[].Component`), so tests must load app modules
 * through a non-literal path — a literal `import("…/apps/…")` makes tsc
 * follow every `.tsx` the app imports and fail with TS6142.
 */
describe("test-utils tsc boundary", () => {
	it("no test imports an app module by literal path", () => {
		const dir = import.meta.dirname;
		const offenders = readdirSync(dir)
			.filter((f) => f.endsWith(".ts"))
			.filter((f) =>
				/import\(\s*["'](?:\.\.\/)+apps\/marketing\/src\/lib\/site-links["']/.test(
					readFileSync(join(dir, f), "utf8"),
				),
			);
		expect(offenders).toEqual([]);
	});
});
