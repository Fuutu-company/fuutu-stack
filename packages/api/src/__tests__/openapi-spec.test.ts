import { describe, expect, it, vi } from "vitest";

// Minimal Better Auth spec: a path whose response refs a component schema
// — the real generator emits `#/components/schemas/Session` etc.
const betterAuthSpec = {
	openapi: "3.1.1",
	components: {
		schemas: {
			Session: {
				type: "object",
				properties: { id: { type: "string" } },
			},
		},
	},
	paths: {
		"/get-session": {
			get: {
				responses: {
					"200": {
						description: "Success",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Session" },
							},
						},
					},
				},
			},
		},
	},
};

vi.mock("@fuutu/auth", () => ({
	auth: {
		api: {},
		handler: vi.fn(async () => Response.json(betterAuthSpec)),
	},
}));

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

const { openApiHandler } = await import("../orpc/handler");

async function fetchSpec(): Promise<Record<string, unknown>> {
	const { matched, response } = await openApiHandler.handle(
		new Request("http://localhost/api/spec.json"),
		{
			prefix: "/api",
			context: { session: null, headers: new Headers(), apiKey: null },
		},
	);
	expect(matched).toBe(true);
	return (await response?.json()) as Record<string, unknown>;
}

describe("OpenAPI spec (/api/spec.json)", () => {
	it("mounts Better Auth paths under /auth", async () => {
		const spec = await fetchSpec();
		expect(Object.keys(spec.paths as object)).toContain("/auth/get-session");
	});

	it("resolves every component schema ref the merged spec uses", async () => {
		const spec = await fetchSpec();
		const refs = [
			...JSON.stringify(spec).matchAll(/#\/components\/schemas\/(\w+)/g),
		].map((m) => m[1]);
		const schemas =
			(spec.components as { schemas?: Record<string, unknown> } | undefined)
				?.schemas ?? {};

		expect(refs).toContain("Session");
		for (const ref of refs) {
			expect(schemas, `missing schema ${ref}`).toHaveProperty(String(ref));
		}
	});
});
