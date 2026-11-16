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

const { serveApiDocs } = await import("../orpc/api-docs");

async function fetchSpec(): Promise<Record<string, unknown>> {
	const response = await serveApiDocs("/spec.json");
	expect(response.status).toBe(200);
	return (await response.json()) as Record<string, unknown>;
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

describe("OpenAPI spec: AI chat streams", () => {
	it.each(["/chat/messages/stream", "/ai/chat"])(
		"describes %s as an event stream of text chunks",
		async (path) => {
			const spec = await fetchSpec();
			const operation = (
				spec.paths as Record<
					string,
					{ post?: { responses?: Record<string, { content?: unknown }> } }
				>
			)[path]?.post;
			const content = operation?.responses?.["200"]?.content as
				| Record<string, { schema?: unknown }>
				| undefined;
			expect(Object.keys(content ?? {})).toEqual(["text/event-stream"]);
			expect(JSON.stringify(content?.["text/event-stream"]?.schema)).toContain(
				'"type":"string"',
			);
		},
	);
});
