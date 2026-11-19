import { describe, expect, it, vi } from "vitest";

// `SKIP_ENV_VALIDATION=1` builds (the app Dockerfiles) import this module
// without BETTER_AUTH_URL — loading it must not throw. The server
// re-evaluates it at runtime, where the env schema requires the URL.
vi.mock("@fuutu/env/saas", () => ({ env: {} }));
vi.mock("better-auth/oauth2", () => ({ verifyBearerToken: vi.fn() }));

describe("mcp-oauth without BETTER_AUTH_URL (image build)", () => {
	it("loads and keeps MCP OAuth off", async () => {
		const { mcpOAuth } = await import("../mcp-oauth");
		expect(mcpOAuth.active).toBe(false);
	});
});
