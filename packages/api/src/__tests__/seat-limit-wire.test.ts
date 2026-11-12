import { makeSession, makeUser } from "@fuutu/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

// Mount the real invite procedure behind the real RPC handler — the
// seat-limit code and data must survive serialization to the client,
// not flatten into a generic 500.
vi.mock("../orpc/router", async () => {
	const { inviteMember } = await import(
		"../modules/organizations/members/procedures/invite"
	);
	return { router: { organizations: { members: { invite: inviteMember } } } };
});
vi.mock("../orpc/openapi-merge", () => ({
	getBetterAuthSpecPaths: vi.fn(async () => ({})),
}));
vi.mock("@fuutu/auth", () => ({
	auth: {
		api: {
			getFullOrganization: vi.fn().mockResolvedValue({
				id: "org-1",
				members: [{ userId: "user-1", role: "owner", id: "member-1" }],
			}),
			createInvitation: vi.fn().mockRejectedValue(
				Object.assign(new Error("Organization seat limit reached"), {
					name: "APIError",
					status: "PAYMENT_REQUIRED",
					statusCode: 402,
					body: {
						message: "Organization seat limit reached",
						seatsTotal: 3,
						upgradeUrl: "/organizations/acme/settings/billing",
					},
				}),
			),
		},
	},
}));
vi.mock("@fuutu/db", () => ({
	countOrganizationMembers: vi.fn().mockResolvedValue(0),
	getActiveSubscriptionForOrganization: vi.fn().mockResolvedValue(null),
	getActiveSubscriptionForUser: vi.fn().mockResolvedValue(null),
}));
vi.mock("@fuutu/ai", () => ({ resolveAIProvider: vi.fn() }));

const { rpcHandler } = await import("../orpc/handler");

describe("seat-limit error over the RPC wire", () => {
	it("arrives as HTTP 402 with code PAYMENT_REQUIRED and the seat data", async () => {
		const context = makeSession<Context>(makeUser());
		const { response } = await rpcHandler.handle(
			new Request("http://localhost/api/rpc/organizations/members/invite", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					json: {
						organizationId: "org-1",
						email: "new@fuutu.local",
						role: "member",
					},
				}),
			}),
			{ prefix: "/api/rpc", context },
		);

		expect(response?.status).toBe(402);
		const body = (await response?.json()) as { json: unknown };
		expect(body.json).toMatchObject({
			code: "PAYMENT_REQUIRED",
			status: 402,
			data: {
				seatsTotal: 3,
				upgradeUrl: "/organizations/acme/settings/billing",
			},
		});
	});
});
