import { describe, expect, it } from "vitest";
import { matchesPublicPath } from "../public-path";

describe("matchesPublicPath", () => {
	it("string entries match by prefix", () => {
		expect(matchesPublicPath("/api/webhooks/creem", ["/api/webhooks"])).toBe(
			true,
		);
		expect(matchesPublicPath("/api/webhooks", ["/api/webhooks"])).toBe(true);
		expect(matchesPublicPath("/api/other", ["/api/webhooks"])).toBe(false);
	});

	// A prefix covers its own path segment only — `/auth` must not open
	// `/authors`, `/api/version` not `/api/versioning`.
	it("string entries stop at a path segment boundary", () => {
		expect(matchesPublicPath("/authors", ["/auth"])).toBe(false);
		expect(matchesPublicPath("/authorize", ["/auth"])).toBe(false);
		expect(matchesPublicPath("/api/versioning", ["/api/version"])).toBe(false);
		expect(matchesPublicPath("/api/mcpX", ["/api/mcp"])).toBe(false);
		expect(matchesPublicPath("/auth/sign-in", ["/auth"])).toBe(true);
	});

	it("an entry ending in / covers only paths below it", () => {
		expect(matchesPublicPath("/docs/intro", ["/docs/"])).toBe(true);
		expect(matchesPublicPath("/docsx", ["/docs/"])).toBe(false);
	});

	it("{ exact } entries match only the identical path", () => {
		const entries = [{ exact: "/pricing" }] as const;
		expect(matchesPublicPath("/pricing", entries)).toBe(true);
		expect(matchesPublicPath("/pricing/enterprise", entries)).toBe(false);
		expect(matchesPublicPath("/pricing-old", entries)).toBe(false);
		expect(matchesPublicPath("/", entries)).toBe(false);
	});

	it("mixes both entry kinds", () => {
		const entries = ["/api/hooks", { exact: "/status" }] as const;
		expect(matchesPublicPath("/api/hooks/x", entries)).toBe(true);
		expect(matchesPublicPath("/status", entries)).toBe(true);
		expect(matchesPublicPath("/status/details", entries)).toBe(false);
	});

	it("matches nothing for an empty list", () => {
		expect(matchesPublicPath("/anything", [])).toBe(false);
	});
});
