import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The visual baselines render ids of the seeded users and the Acme org
 * (admin audit log target column, admin links). A random id per seed made
 * every CI run commit a "changed" screenshot — the dev seed uses fixed ids.
 */
const REPO_ROOT = join(import.meta.dirname, "../../../../../");
const seed = readFileSync(
	join(REPO_ROOT, "packages/db/prisma/seed.ts"),
	"utf8",
);

const UUID = /^"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"$/;

describe("dev seed: ids the UI renders are fixed", () => {
	for (const name of [
		"adminId",
		"memberId",
		"twoFactorId",
		"inviteeId",
		"orgId",
	]) {
		it(`${name} is a UUID literal, not generated per run`, () => {
			const value = new RegExp(`const ${name} = ([^;]+);`).exec(seed)?.[1];
			expect(value, `const ${name} in seed.ts`).toMatch(UUID);
		});
	}

	it("the fixed ids are distinct", () => {
		const ids = [...seed.matchAll(/const \w+Id = ("[0-9a-f-]{36}");/g)].map(
			(m) => m[1],
		);
		expect(ids.length).toBe(5);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
