import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertLocalHost } from "../../prisma/seed-guards";

// `db:seed` writes demo users with a published password: it must only
// ever run against a local throwaway database.

describe("assertLocalHost", () => {
	it.each([
		"postgresql://u:p@localhost:5432/db",
		"postgresql://u:p@127.0.0.1:5432/db",
		"postgresql://u:p@[::1]:5432/db",
	])("accepts %s", (url) => {
		expect(() => assertLocalHost(url, "database")).not.toThrow();
	});

	it.each([
		"postgresql://u:p@db.example.com:5432/db",
		"postgresql://u:p@localhost.evil.com:5432/db",
		"not a url",
	])("refuses %s", (url) => {
		expect(() => assertLocalHost(url, "database")).toThrow(/Refusing/);
	});

	// Inside a deployed compose stack `postgres` is the production database:
	// only an explicit FUUTU_ALLOW_SEED=1 makes it count as local.
	it("refuses the compose database host unless seeding there is allowed", () => {
		const url = "postgresql://fuutu:pw@postgres:5432/fuutu-stack";
		expect(() => assertLocalHost(url, "database")).toThrow(/Refusing/);
		expect(() =>
			assertLocalHost(url, "database", { allowComposeHost: false }),
		).toThrow(/Refusing/);
		expect(() =>
			assertLocalHost(url, "database", { allowComposeHost: true }),
		).not.toThrow();
	});
});

describe("db:seed", () => {
	it("checks its database with the guard, the compose host only on FUUTU_ALLOW_SEED=1", () => {
		const source = readFileSync(
			join(import.meta.dirname, "../../prisma/seed.ts"),
			"utf8",
		);
		expect(source).toMatch(
			/assertLocalHost\(env\.DATABASE_URL, "database", \{\s*allowComposeHost: env\.FUUTU_ALLOW_SEED === "1",\s*\}\)/,
		);
		expect(source).not.toMatch(/"postgres"\]\.includes/);
	});
});
