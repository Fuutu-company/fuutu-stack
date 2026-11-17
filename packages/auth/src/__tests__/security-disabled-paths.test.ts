import { describe, expect, it } from "vitest";
import { composeDisabledPaths } from "../security/disabled-paths";

const ADMIN = ["/admin/ban-user", "/admin/impersonate-user"];
const ORGANIZATION = [
	"/organization/create",
	"/organization/update",
	"/organization/delete",
	"/organization/invite-member",
	"/organization/update-member-role",
	"/organization/remove-member",
	"/organization/cancel-invitation",
	"/organization/list-invitations",
];

describe("composeDisabledPaths", () => {
	it("closes /token, the admin endpoints and the organization mutations by default", () => {
		expect(
			composeDisabledPaths({
				mcpOAuthActive: true,
				adminEndpointPaths: ADMIN,
				exposeAdminEndpoints: false,
				exposeOrganizationEndpoints: false,
			}),
		).toEqual(["/token", ...ADMIN, ...ORGANIZATION]);
	});

	it("leaves /token open without MCP OAuth", () => {
		expect(
			composeDisabledPaths({
				mcpOAuthActive: false,
				adminEndpointPaths: ADMIN,
				exposeAdminEndpoints: false,
				exposeOrganizationEndpoints: false,
			}),
		).toEqual([...ADMIN, ...ORGANIZATION]);
	});

	it("serves the admin endpoints again when they are exposed", () => {
		expect(
			composeDisabledPaths({
				mcpOAuthActive: false,
				adminEndpointPaths: ADMIN,
				exposeAdminEndpoints: true,
				exposeOrganizationEndpoints: false,
			}),
		).toEqual(ORGANIZATION);
	});

	it("serves the organization endpoints again when they are exposed", () => {
		expect(
			composeDisabledPaths({
				mcpOAuthActive: true,
				adminEndpointPaths: ADMIN,
				exposeAdminEndpoints: false,
				exposeOrganizationEndpoints: true,
			}),
		).toEqual(["/token", ...ADMIN]);
	});
});
