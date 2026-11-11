import { KIT_NAME, KIT_VERSION } from "@fuutu/config";
import { APP_VERSION } from "@fuutu/config/app-version";
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

	it("whoami requires auth and reports user, org and role", async () => {
		expect(whoamiTool.access).toBe("authenticated");
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
