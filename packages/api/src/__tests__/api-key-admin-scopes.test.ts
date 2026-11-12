import { makeSession, makeUser } from "@fuutu/test-utils";
import { OpenAPIGenerator } from "@orpc/openapi";
import { call } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { apiKeysRouter } from "../modules/api-keys/router";

// An app-defined vocabulary with one scope reserved for system admins
// (the kit default reserves none). The procedure's input type is the kit
// vocabulary, so app-only scopes are cast in the calls below.
vi.mock("../api-key-scopes", () => ({
	API_KEY_SCOPES: ["mcp", "versioning", "api", "internal"],
	API_KEY_ADMIN_SCOPES: ["internal"],
	API_SCOPE: "api",
}));

vi.mock("@fuutu/db", () => ({
	createApiKeyWithinLimit: vi.fn(),
	countApiKeys: vi.fn(),
	countOrgApiKeys: vi.fn(),
	getActiveSubscriptionForUser: vi.fn().mockResolvedValue(null),
	getActiveSubscriptionForOrganization: vi.fn().mockResolvedValue(null),
}));

vi.mock("@fuutu/auth", () => ({
	auth: { api: { getFullOrganization: vi.fn() } },
}));

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

const { createApiKeyWithinLimit, countApiKeys, countOrgApiKeys } = await import(
	"@fuutu/db"
);
const { auth } = await import("@fuutu/auth");

const orgFixture = {
	id: "org-1",
	name: "Acme",
	slug: "acme",
	members: [
		{ userId: "user-1", role: "owner", id: "member-1" },
		{ userId: "admin-1", role: "member", id: "member-2" },
	],
};

const orgOwner = makeSession<Context>(makeUser({ id: "user-1" }));
const systemAdmin = makeSession<Context>(
	makeUser({ id: "admin-1", role: "admin" }),
);

describe("apiKeys.create — admin-only scopes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(countApiKeys).mockResolvedValue(0);
		vi.mocked(countOrgApiKeys).mockResolvedValue(0);
		vi.mocked(createApiKeyWithinLimit).mockResolvedValue({
			id: "key-1",
			key: "futu_sk_abc",
			prefix: "futu_sk_abc...",
		});
	});

	it("forbids an org owner without system admin from minting an admin scope", async () => {
		await expect(
			call(
				apiKeysRouter.create,
				{
					name: "Key",
					organizationId: "org-1",
					scopes: ["mcp", "internal"] as never,
				},
				{ context: orgOwner },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(createApiKeyWithinLimit).not.toHaveBeenCalled();
	});

	it("lets a system admin mint an admin scope", async () => {
		await call(
			apiKeysRouter.create,
			{ name: "Key", organizationId: "org-1", scopes: ["internal"] as never },
			{ context: systemAdmin },
		);
		expect(createApiKeyWithinLimit).toHaveBeenCalledWith(
			expect.objectContaining({ scopes: ["internal"], userId: "admin-1" }),
		);
	});

	it("still lets non-admins mint the regular scopes", async () => {
		await call(
			apiKeysRouter.create,
			{ name: "Key", organizationId: "org-1", scopes: ["mcp", "api"] },
			{ context: orgOwner },
		);
		expect(createApiKeyWithinLimit).toHaveBeenCalledWith(
			expect.objectContaining({ scopes: ["mcp", "api"] }),
		);
	});

	it("stores each scope once", async () => {
		await call(
			apiKeysRouter.create,
			{ name: "Key", organizationId: "org-1", scopes: ["mcp", "mcp"] },
			{ context: orgOwner },
		);
		expect(createApiKeyWithinLimit).toHaveBeenCalledWith(
			expect.objectContaining({ scopes: ["mcp"] }),
		);
	});

	it("rejects a scope outside the configured vocabulary", async () => {
		await expect(
			call(
				apiKeysRouter.create,
				{
					name: "Key",
					organizationId: "org-1",
					scopes: ["maintainer"] as never,
				},
				{ context: systemAdmin },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(createApiKeyWithinLimit).not.toHaveBeenCalled();
	});
});

describe("apiKeys.create — OpenAPI", () => {
	it("documents scopes as an enum of the configured vocabulary", async () => {
		const generator = new OpenAPIGenerator({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		});
		const spec = await generator.generate(
			{ apiKeys: apiKeysRouter },
			{ info: { title: "test", version: "0.0.0" } },
		);
		const body = JSON.stringify(spec.paths?.["/api-keys"]?.post);
		expect(body).toContain('"enum":["mcp","versioning","api","internal"]');
	});
});
