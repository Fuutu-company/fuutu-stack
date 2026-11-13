import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: GET procedures receive their input from the query string,
 * where every value is a string. `z.number()` / `z.boolean()` reject
 * `?page=2` with 400 on the REST (OpenAPI) surface. Use
 * `z.coerce.number()` (safe for RPC numbers too) — and never
 * `z.coerce.boolean()` ("false" → true); use `z.stringbool()` for
 * REST-only booleans.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const MODULES_DIR = join(REPO_ROOT, "packages", "api", "src", "modules");

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			return entry === "__tests__" ? [] : walk(path);
		}
		return path.endsWith(".ts") ? [path] : [];
	});
}

const getProcedures = walk(MODULES_DIR).filter((file) =>
	/method:\s*"GET"/.test(readFileSync(file, "utf8")),
);

describe("GET query coercion guard", () => {
	it("finds GET procedures to check", () => {
		expect(getProcedures.length).toBeGreaterThan(5);
	});

	for (const file of getProcedures) {
		it(`${relative(REPO_ROOT, file)} coerces query numbers/booleans`, () => {
			const source = readFileSync(file, "utf8");
			expect(source).not.toMatch(/\bz\.number\(/);
			expect(source).not.toMatch(/\bz\.boolean\(/);
			expect(source).not.toMatch(/\bz\.coerce\.boolean\(/);
		});
	}
});
