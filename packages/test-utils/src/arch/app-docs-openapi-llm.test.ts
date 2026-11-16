import { describe, expect, it } from "vitest";

/**
 * "Copy Markdown" / `.mdx` of an OpenAPI page: an agent pasting it must get
 * the operation itself — method, path, parameters, request and response
 * schemas, and the component schemas they reference — not just the title.
 */

const { openapiLLMText } = await import(
	"../../../../apps/docs/src/lib/openapi-llm-text"
);

const bundled = {
	openapi: "3.1.0",
	paths: {
		"/organizations/{slug}": {
			parameters: [
				{
					name: "slug",
					in: "path",
					required: true,
					schema: { type: "string" },
				},
			],
			get: {
				summary: "Get organization",
				description: "Returns one organization by slug.",
				responses: {
					"200": {
						description: "The organization",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Organization" },
							},
						},
					},
				},
			},
			delete: { summary: "Delete organization", responses: {} },
		},
	},
	components: {
		schemas: {
			Organization: {
				type: "object",
				properties: {
					id: { type: "string" },
					owner: { $ref: "#/components/schemas/User" },
				},
			},
			User: { type: "object", properties: { email: { type: "string" } } },
			Unrelated: { type: "object" },
		},
	},
};

const text = openapiLLMText({
	title: "Get organization",
	description: "Organization lookup",
	props: {
		payload: { bundled },
		operations: [{ path: "/organizations/{slug}", method: "get" }],
	},
});

describe("OpenAPI page Markdown", () => {
	it("starts with the title and description", () => {
		expect(text.startsWith("# Get organization\n\nOrganization lookup\n")).toBe(
			true,
		);
	});

	it("names the operation's method and path", () => {
		expect(text).toContain("## GET /organizations/{slug}");
		expect(text).toContain("Returns one organization by slug.");
	});

	it("includes path parameters and the response schema", () => {
		expect(text).toContain('"name": "slug"');
		expect(text).toContain('"$ref": "#/components/schemas/Organization"');
	});

	it("appends referenced component schemas transitively, and only those", () => {
		expect(text).toContain("### Organization");
		expect(text).toContain("### User");
		expect(text).not.toContain("Unrelated");
	});

	it("leaves out operations of the path that the page does not show", () => {
		expect(text).not.toContain("DELETE");
		expect(text).not.toContain("Delete organization");
	});
});
