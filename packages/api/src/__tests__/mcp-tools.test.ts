import { KIT_NAME, KIT_VERSION } from "@fuutu/config";
import { APP_VERSION } from "@fuutu/config/app-version";
import { canAccess, type McpUserPrincipal } from "@fuutu/mcp";
import { describe, expect, it, vi } from "vitest";
import { appInfoTool, whoamiTool } from "../mcp/tools";

vi.mock("@fuutu/db", () => ({
	getUserById: vi.fn(async () => ({
		id: "user-1",
		name: "Ada",
		email: "ada@example.com",
	})),
	getOrganizationById: vi.fn(async () => ({
		id: "org-1",
		name: "Acme",
		slug: "acme",
	})),
}));

const request = new Request("http://localhost/api/mcp");

describe("kit MCP tools", () => {
	it("app_info is public and separates app from kit identity", async () => {
		expect(appInfoTool.access).toBe("public");
		const info = await appInfoTool.handler(
			{},
			{ principal: { kind: "anonymous" }, request },
		);
		expect(info).toMatchObject({
			app: { version: APP_VERSION },
			kit: { name: KIT_NAME, version: KIT_VERSION },
		});
	});

	it("whoami needs the profile and email scopes on an OAuth token", () => {
		const oauth = (scopes: string[]): McpUserPrincipal => ({
			kind: "user",
			via: "oauth",
			credentialId: "token-1",
			clientId: "client-1",
			userId: "user-1",
			organizationId: null,
			orgRole: null,
			systemRole: "user",
			scopes,
		});
		expect(canAccess(whoamiTool.access, { kind: "anonymous" })).toBe(false);
		expect(canAccess(whoamiTool.access, oauth(["openid"]))).toBe(false);
		expect(canAccess(whoamiTool.access, oauth(["openid", "profile"]))).toBe(
			false,
		);
		expect(
			canAccess(whoamiTool.access, oauth(["openid", "profile", "email"])),
		).toBe(true);
	});

	it("whoami admits an API key (its scopes are the key's)", () => {
		expect(
			canAccess(whoamiTool.access, {
				kind: "user",
				via: "api-key",
				credentialId: "key-1",
				userId: "user-1",
				organizationId: "org-1",
				orgRole: "admin",
				systemRole: "user",
				scopes: ["mcp"],
			}),
		).toBe(true);
	});

	it("whoami reports user, org and role", async () => {
		const me = await whoamiTool.handler(
			{},
			{
				request,
				principal: {
					kind: "user",
					via: "api-key",
					credentialId: "key-1",
					userId: "user-1",
					organizationId: "org-1",
					orgRole: "admin",
					systemRole: "user",
					scopes: ["mcp"],
				},
			},
		);
		expect(me).toEqual({
			user: { id: "user-1", name: "Ada", email: "ada@example.com" },
			organization: { id: "org-1", name: "Acme", slug: "acme", role: "admin" },
			scopes: ["mcp"],
		});
	});
});
