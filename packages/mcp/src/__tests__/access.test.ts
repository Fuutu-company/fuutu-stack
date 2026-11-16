import { describe, expect, it } from "vitest";
import { canAccess, requireScopes } from "../index";
import type { McpUserPrincipal } from "../types";

const principal = (
	scopes: string[],
	via: McpUserPrincipal["via"] = "oauth",
): McpUserPrincipal => ({
	kind: "user",
	via,
	credentialId: "cred-1",
	userId: "user-1",
	organizationId: "org-1",
	orgRole: "member",
	systemRole: null,
	scopes,
});

describe("requireScopes", () => {
	it("admits a credential granted every listed scope", () => {
		const access = requireScopes("crm:read", "crm:write");
		expect(
			canAccess(access, principal(["openid", "crm:read", "crm:write"])),
		).toBe(true);
	});

	// "authenticated" ignores scopes: a token granted only `openid` would
	// still reach the tool.
	it("rejects a credential missing one of them", () => {
		const access = requireScopes("crm:read", "crm:write");
		expect(canAccess(access, principal(["openid"]))).toBe(false);
		expect(canAccess(access, principal(["crm:read"]))).toBe(false);
		expect(canAccess("authenticated", principal(["openid"]))).toBe(true);
	});

	it("applies to API keys too (their scopes are the key's)", () => {
		expect(canAccess(requireScopes("mcp"), principal(["mcp"], "api-key"))).toBe(
			true,
		);
		expect(
			canAccess(requireScopes("crm:read"), principal(["mcp"], "api-key")),
		).toBe(false);
	});

	it("never admits anonymous callers", () => {
		expect(canAccess(requireScopes("mcp"), { kind: "anonymous" })).toBe(false);
	});
});
