import { describe, expect, it } from "vitest";
import { extractBearerToken } from "../credentials";

const headers = (init: Record<string, string>) => new Headers(init);

describe("extractBearerToken", () => {
	it("reads a bearer token", () => {
		expect(
			extractBearerToken(headers({ authorization: "Bearer futu_sk_abc" })),
		).toBe("futu_sk_abc");
	});

	it("falls back to a custom header", () => {
		expect(
			extractBearerToken(headers({ "x-api-key": "futu_sk_abc" }), "x-api-key"),
		).toBe("futu_sk_abc");
	});

	it("treats a missing or empty token as no credential", () => {
		expect(extractBearerToken(headers({}))).toBeNull();
		expect(
			extractBearerToken(headers({ authorization: "Bearer " })),
		).toBeNull();
	});

	it("treats an unexpanded env placeholder as no credential", () => {
		// Clients such as Claude Code send `${VAR}` literally when the env
		// var behind a committed .mcp.json header is unset.
		expect(
			extractBearerToken(
				// biome-ignore lint/suspicious/noTemplateCurlyInString: the literal placeholder is the input under test
				headers({ authorization: "Bearer ${FUUTU_MCP_API_KEY}" }),
			),
		).toBeNull();
	});
});
