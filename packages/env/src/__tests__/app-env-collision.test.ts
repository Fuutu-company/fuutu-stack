import { beforeEach, describe, expect, it, vi } from "vitest";

// An app var reusing a kit key would silently get the kit schema — the
// env surfaces refuse to load instead, naming the key.
const shapes = vi.hoisted(() => ({
	server: {} as Record<string, unknown>,
	client: {} as Record<string, unknown>,
}));

vi.mock("../app-env", async () => {
	const { z } = await import("zod");
	const schemas = {
		DATABASE_URL: z.string(),
		APP_PARTNER_TOKEN: z.string().optional(),
		NEXT_PUBLIC_SAAS_URL: z.string().optional(),
		NEXT_PUBLIC_APP_REGION: z.string().optional(),
	};
	const pick = (keys: Record<string, unknown>) =>
		Object.fromEntries(
			Object.keys(keys).map((key) => [
				key,
				schemas[key as keyof typeof schemas],
			]),
		);
	return {
		get appServerEnv() {
			return pick(shapes.server);
		},
		get appClientEnv() {
			return pick(shapes.client);
		},
		get appClientRuntimeEnv() {
			return Object.fromEntries(
				Object.keys(shapes.client).map((key) => [key, undefined]),
			);
		},
	};
});

const originalEnv = process.env;

beforeEach(() => {
	vi.resetModules();
	process.env = {
		...originalEnv,
		DATABASE_URL: "postgresql://localhost:5432/test",
		BETTER_AUTH_SECRET: "a".repeat(32),
		BETTER_AUTH_URL: "http://localhost:3000",
	};
	delete process.env.SKIP_ENV_VALIDATION;
	shapes.server = {};
	shapes.client = {};
});

describe("app env keys colliding with kit keys", () => {
	it("refuses an app server var reusing a kit server key", async () => {
		shapes.server = { DATABASE_URL: true, APP_PARTNER_TOKEN: true };
		await expect(import("../saas")).rejects.toThrow(
			/app-env\.ts.*DATABASE_URL/,
		);
	});

	it("refuses an app client var reusing a kit client key, on every surface", async () => {
		shapes.client = { NEXT_PUBLIC_SAAS_URL: true };
		for (const surface of ["../saas", "../public", "../marketing", "../docs"]) {
			vi.resetModules();
			await expect(import(surface), surface).rejects.toThrow(
				/app-env\.ts.*NEXT_PUBLIC_SAAS_URL/,
			);
		}
	});

	it("loads app-only keys", async () => {
		shapes.server = { APP_PARTNER_TOKEN: true };
		shapes.client = { NEXT_PUBLIC_APP_REGION: true };
		await expect(import("../saas")).resolves.toBeDefined();
		vi.resetModules();
		await expect(import("../public")).resolves.toBeDefined();
	});
});
