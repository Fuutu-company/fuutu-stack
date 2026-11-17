import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { organizationsRouter } from "../modules/organizations/router";

vi.mock("@fuutu/auth", () => ({
	auth: {
		api: {
			listOrganizations: vi.fn(),
			getFullOrganization: vi.fn(),
			createOrganization: vi.fn(),
			updateOrganization: vi.fn(),
			deleteOrganization: vi.fn(),
			createInvitation: vi.fn(),
			updateMemberRole: vi.fn(),
			removeMember: vi.fn(),
			listInvitations: vi.fn(),
			cancelInvitation: vi.fn(),
		},
	},
}));

vi.mock("@fuutu/db", () => ({
	getOrganizationBySlug: vi.fn(),
	getInvitationOrganizationId: vi.fn(),
	countOrganizationsForUser: vi.fn().mockResolvedValue(0),
	countOrganizationMembers: vi.fn().mockResolvedValue(0),
	getActiveSubscriptionForUser: vi.fn().mockResolvedValue(null),
	getActiveSubscriptionForOrganization: vi.fn().mockResolvedValue(null),
	getOrganizationWithMembers: vi.fn().mockResolvedValue(null),
	findOrganizationMember: vi.fn().mockResolvedValue(null),
}));

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

const { auth } = await import("@fuutu/auth");
const {
	getOrganizationBySlug,
	getInvitationOrganizationId,
	findOrganizationMember,
} = await import("@fuutu/db");

const authenticatedContext = makeSession<Context>(makeUser());
const unauthenticatedContext = makeSession<Context>(null);

const orgFixture = {
	id: "org-1",
	name: "Acme",
	slug: "acme",
	createdAt: new Date("2024-01-01"),
	members: [
		{ userId: "user-1", role: "owner", id: "member-1" },
		{ userId: "user-2", role: "member", id: "member-2" },
	],
	invitations: [],
};

describe("organizations.list", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the current user's organizations", async () => {
		vi.mocked(auth.api.listOrganizations).mockResolvedValue([
			orgFixture,
		] as never);

		const result = await call(
			organizationsRouter.list,
			{},
			{
				context: authenticatedContext,
			},
		);

		expect(auth.api.listOrganizations).toHaveBeenCalledWith({
			headers: authenticatedContext.headers,
		});
		expect(result).toEqual({
			items: [orgFixture],
			page: 1,
			limit: 50,
			total: 1,
			totalPages: 1,
		});
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(
				organizationsRouter.list,
				{},
				{
					context: unauthenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("organizations.get", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the organization by slug for a member", async () => {
		vi.mocked(getOrganizationBySlug).mockResolvedValue({
			id: "org-1",
			slug: "acme",
			name: "Acme",
		} as never);
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);

		const result = await call(
			organizationsRouter.get,
			{ slug: "acme" },
			{ context: authenticatedContext },
		);

		expect(getOrganizationBySlug).toHaveBeenCalledWith("acme");
		expect(result).toEqual(orgFixture);
	});

	it("returns no invitations (invitee emails) to a member who may not invite", async () => {
		vi.mocked(getOrganizationBySlug).mockResolvedValue({
			id: "org-1",
			slug: "acme",
		} as never);
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			invitations: [{ id: "inv-1", email: "invitee@acme.dev" }],
		} as never);

		const asMember = await call(
			organizationsRouter.get,
			{ slug: "acme" },
			{ context: makeSession<Context>(makeUser({ id: "user-2" })) },
		);
		expect(asMember.invitations).toEqual([]);

		const asOwner = await call(
			organizationsRouter.get,
			{ slug: "acme" },
			{ context: authenticatedContext },
		);
		expect(asOwner.invitations).toHaveLength(1);
	});

	it("throws NOT_FOUND when org does not exist", async () => {
		vi.mocked(getOrganizationBySlug).mockResolvedValue(null as never);

		await expect(
			call(
				organizationsRouter.get,
				{ slug: "nope" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("throws FORBIDDEN when user is not a member", async () => {
		vi.mocked(getOrganizationBySlug).mockResolvedValue({
			id: "org-1",
			slug: "acme",
		} as never);
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [{ userId: "user-2", role: "member" }],
		} as never);

		await expect(
			call(
				organizationsRouter.get,
				{ slug: "acme" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("maps the Better Auth non-member 403 to FORBIDDEN, never a 500", async () => {
		vi.mocked(getOrganizationBySlug).mockResolvedValue({
			id: "org-1",
			slug: "acme",
		} as never);
		vi.mocked(auth.api.getFullOrganization).mockRejectedValue(
			Object.assign(new Error("User is not a member of the organization"), {
				name: "APIError",
				statusCode: 403,
			}),
		);

		await expect(
			call(
				organizationsRouter.get,
				{ slug: "acme" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
	});

	it("rejects invalid slug format", async () => {
		await expect(
			call(
				organizationsRouter.get,
				{ slug: "A" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toBeDefined();
	});
});

describe("organizations.create", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates an organization with valid input", async () => {
		vi.mocked(auth.api.createOrganization).mockResolvedValue(
			orgFixture as never,
		);

		const result = await call(
			organizationsRouter.create,
			{ name: "Acme", slug: "acme" },
			{ context: authenticatedContext },
		);

		expect(auth.api.createOrganization).toHaveBeenCalledWith({
			body: { name: "Acme", slug: "acme" },
			headers: authenticatedContext.headers,
		});
		expect(result).toEqual(orgFixture);
	});

	it("surfaces the per-user organization cap as FORBIDDEN, not a 500", async () => {
		vi.mocked(auth.api.createOrganization).mockRejectedValue(
			Object.assign(
				new Error("You have reached the maximum number of organizations"),
				{
					name: "APIError",
					status: "FORBIDDEN",
					statusCode: 403,
					body: {
						code: "YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS",
						message: "You have reached the maximum number of organizations",
					},
				},
			),
		);

		await expect(
			call(
				organizationsRouter.create,
				{ name: "Acme", slug: "acme" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			status: 403,
			message: "Organization limit reached",
		});
	});

	it("passes other Better Auth errors through unchanged", async () => {
		const taken = Object.assign(new Error("Organization already exists"), {
			name: "APIError",
			status: "BAD_REQUEST",
			statusCode: 400,
			body: { code: "ORGANIZATION_ALREADY_EXISTS" },
		});
		vi.mocked(auth.api.createOrganization).mockRejectedValue(taken);

		await expect(
			call(
				organizationsRouter.create,
				{ name: "Acme", slug: "acme" },
				{ context: authenticatedContext },
			),
		).rejects.toBe(taken);
	});

	it("rejects empty name", async () => {
		await expect(
			call(
				organizationsRouter.create,
				{ name: "", slug: "acme" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toBeDefined();
	});

	it("rejects invalid slug", async () => {
		await expect(
			call(
				organizationsRouter.create,
				{ name: "Acme", slug: "Invalid Slug!" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toBeDefined();
	});
});

describe("organizations.update", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("updates the organization name as admin", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(auth.api.updateOrganization).mockResolvedValue({
			...orgFixture,
			name: "New Name",
		} as never);

		const result = await call(
			organizationsRouter.update,
			{ organizationId: "org-1", name: "New Name" },
			{ context: authenticatedContext },
		);

		expect(auth.api.updateOrganization).toHaveBeenCalledWith({
			body: { organizationId: "org-1", data: { name: "New Name" } },
			headers: authenticatedContext.headers,
		});
		expect(result).toMatchObject({ name: "New Name" });
	});

	it("updates the organization logo as admin", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(auth.api.updateOrganization).mockResolvedValue({
			...orgFixture,
			logo: "/image-proxy/organization-logos/org-1/logo.png",
		} as never);

		await call(
			organizationsRouter.update,
			{
				organizationId: "org-1",
				logo: "/image-proxy/organization-logos/org-1/logo.png",
			},
			{ context: authenticatedContext },
		);

		expect(auth.api.updateOrganization).toHaveBeenCalledWith({
			body: {
				organizationId: "org-1",
				data: { logo: "/image-proxy/organization-logos/org-1/logo.png" },
			},
			headers: authenticatedContext.headers,
		});
	});

	it("clears the organization logo with null", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(auth.api.updateOrganization).mockResolvedValue({
			...orgFixture,
			logo: null,
		} as never);

		await call(
			organizationsRouter.update,
			{ organizationId: "org-1", logo: null },
			{ context: authenticatedContext },
		);

		expect(auth.api.updateOrganization).toHaveBeenCalledWith({
			body: { organizationId: "org-1", data: { logo: null } },
			headers: authenticatedContext.headers,
		});
	});

	it("throws FORBIDDEN when user is not admin", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [{ userId: "user-1", role: "member" }],
		} as never);

		await expect(
			call(
				organizationsRouter.update,
				{ organizationId: "org-1", name: "X" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

describe("organizations.update as a non-member", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("maps the Better Auth non-member 403 to FORBIDDEN", async () => {
		vi.mocked(auth.api.getFullOrganization).mockRejectedValue(
			Object.assign(new Error("User is not a member of the organization"), {
				name: "APIError",
				statusCode: 403,
			}),
		);

		await expect(
			call(
				organizationsRouter.update,
				{ organizationId: "org-1", name: "New Name" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
		expect(auth.api.updateOrganization).not.toHaveBeenCalled();
	});
});

describe("organizations.update logo and Better Auth errors", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
	});

	it.each([
		"https://evil.example/pixel.png",
		"/image-proxy/organization-logos/org-2/logo.png",
		"/image-proxy/avatars/org-1/logo.png",
		"/image-proxy/organization-logos/org-1/../logo.png",
	])("rejects logo %s with BAD_REQUEST before Better Auth", async (logo) => {
		await expect(
			call(
				organizationsRouter.update,
				{ organizationId: "org-1", logo },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(auth.api.updateOrganization).not.toHaveBeenCalled();
	});

	it("maps a Better Auth INVALID_PROFILE_INPUT APIError to BAD_REQUEST", async () => {
		vi.mocked(auth.api.updateOrganization).mockRejectedValue(
			Object.assign(new Error("Name must be at most 100 characters"), {
				name: "APIError",
				statusCode: 400,
				body: { code: "INVALID_PROFILE_INPUT" },
			}),
		);
		await expect(
			call(
				organizationsRouter.update,
				{ organizationId: "org-1", name: "Acme" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST", status: 400 });
	});

	it("maps a failed subscription cancel on delete to BAD_GATEWAY", async () => {
		vi.mocked(auth.api.deleteOrganization).mockRejectedValue(
			Object.assign(new Error("Subscriptions could not be cancelled"), {
				name: "APIError",
				statusCode: 502,
				body: { code: "SUBSCRIPTION_CANCELLATION_FAILED" },
			}),
		);
		await expect(
			call(
				organizationsRouter.delete,
				{ organizationId: "org-1" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "BAD_GATEWAY", status: 502 });
	});

	it("rethrows errors that are not Better Auth client errors", async () => {
		vi.mocked(auth.api.deleteOrganization).mockRejectedValue(new Error("boom"));
		await expect(
			call(
				organizationsRouter.delete,
				{ organizationId: "org-1" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ message: "boom" });
	});
});

describe("organizations.delete", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("deletes the organization as owner", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(auth.api.deleteOrganization).mockResolvedValue("ok" as never);

		const result = await call(
			organizationsRouter.delete,
			{ organizationId: "org-1" },
			{ context: authenticatedContext },
		);

		expect(auth.api.deleteOrganization).toHaveBeenCalledWith({
			body: { organizationId: "org-1" },
			headers: authenticatedContext.headers,
		});
		expect(result).toEqual({ success: true });
	});

	it("throws FORBIDDEN when user is not owner", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [{ userId: "user-1", role: "admin" }],
		} as never);

		await expect(
			call(
				organizationsRouter.delete,
				{ organizationId: "org-1" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

describe("organizations.members.invite", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("invites a member as admin", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(auth.api.createInvitation).mockResolvedValue({
			id: "inv-1",
			email: "new@fuutu.local",
		} as never);

		const result = await call(
			organizationsRouter.members.invite,
			{ organizationId: "org-1", email: "new@fuutu.local", role: "member" },
			{ context: authenticatedContext },
		);

		expect(auth.api.createInvitation).toHaveBeenCalledWith({
			body: {
				email: "new@fuutu.local",
				role: "member",
				organizationId: "org-1",
			},
			headers: authenticatedContext.headers,
		});
		expect(result).toMatchObject({ id: "inv-1" });
	});

	it("throws FORBIDDEN when user is not admin", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [{ userId: "user-1", role: "member" }],
		} as never);

		await expect(
			call(
				organizationsRouter.members.invite,
				{ organizationId: "org-1", email: "new@fuutu.local", role: "member" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("surfaces the seat-limit hook as a typed PAYMENT_REQUIRED error", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(auth.api.createInvitation).mockRejectedValue(
			Object.assign(new Error("Organization seat limit reached"), {
				name: "APIError",
				status: "PAYMENT_REQUIRED",
				statusCode: 402,
				body: {
					message: "Organization seat limit reached",
					seatsTotal: 5,
					upgradeUrl: "/organizations/acme/settings/billing",
				},
			}),
		);

		await expect(
			call(
				organizationsRouter.members.invite,
				{ organizationId: "org-1", email: "new@fuutu.local", role: "member" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({
			code: "PAYMENT_REQUIRED",
			status: 402,
			data: {
				seatsTotal: 5,
				upgradeUrl: "/organizations/acme/settings/billing",
			},
		});
	});

	it("leaves the seat cap to the entitlement-based hook (no LIMITS pre-count)", async () => {
		const { countOrganizationMembers } = await import("@fuutu/db");
		vi.mocked(countOrganizationMembers).mockResolvedValue(999);
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(auth.api.createInvitation).mockResolvedValue({
			id: "inv-1",
		} as never);

		await expect(
			call(
				organizationsRouter.members.invite,
				{ organizationId: "org-1", email: "new@fuutu.local", role: "member" },
				{ context: authenticatedContext },
			),
		).resolves.toMatchObject({ id: "inv-1" });
	});

	it("rejects invalid email", async () => {
		await expect(
			call(
				organizationsRouter.members.invite,
				{ organizationId: "org-1", email: "not-an-email", role: "member" },
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});
});

describe("organizations.members.remove", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("removes a member as admin", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(auth.api.removeMember).mockResolvedValue("ok" as never);

		const result = await call(
			organizationsRouter.members.remove,
			{ organizationId: "org-1", memberIdOrEmail: "member-2" },
			{ context: authenticatedContext },
		);

		expect(auth.api.removeMember).toHaveBeenCalledWith({
			body: { memberIdOrEmail: "member-2", organizationId: "org-1" },
			headers: authenticatedContext.headers,
		});
		expect(result).toEqual({ success: true });
	});

	it("throws FORBIDDEN when trying to remove the owner", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [{ userId: "user-1", role: "owner", id: "member-1" }],
		} as never);

		await expect(
			call(
				organizationsRouter.members.remove,
				{ organizationId: "org-1", memberIdOrEmail: "member-1" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("throws FORBIDDEN when admin tries to remove another admin", async () => {
		const adminContext = makeSession<Context>(
			makeUser({ id: "user-3", role: "admin" }),
		);
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [
				{ userId: "user-1", role: "owner", id: "member-1" },
				{ userId: "user-2", role: "admin", id: "member-2" },
				{ userId: "user-3", role: "admin", id: "member-3" },
			],
		} as never);

		await expect(
			call(
				organizationsRouter.members.remove,
				{ organizationId: "org-1", memberIdOrEmail: "member-2" },
				{ context: adminContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("allows owner to remove an admin", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [
				{ userId: "user-1", role: "owner", id: "member-1" },
				{ userId: "user-2", role: "admin", id: "member-2" },
			],
		} as never);
		vi.mocked(auth.api.removeMember).mockResolvedValue("ok" as never);

		const result = await call(
			organizationsRouter.members.remove,
			{ organizationId: "org-1", memberIdOrEmail: "member-2" },
			{ context: authenticatedContext },
		);

		expect(result).toEqual({ success: true });
	});
});

describe("organizations.members.updateRole", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("throws FORBIDDEN when owner demotes themselves", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);

		await expect(
			call(
				organizationsRouter.members.updateRole,
				{
					organizationId: "org-1",
					memberId: "member-1",
					role: "member",
				},
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("throws FORBIDDEN when an admin demotes an owner", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [
				{ userId: "user-0", role: "owner", id: "member-0" },
				{ userId: "user-1", role: "admin", id: "member-1" },
			],
		} as never);

		await expect(
			call(
				organizationsRouter.members.updateRole,
				{
					organizationId: "org-1",
					memberId: "member-0",
					role: "member",
				},
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(auth.api.updateMemberRole).not.toHaveBeenCalled();
	});

	it("throws FORBIDDEN when an admin assigns owner", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [
				{ userId: "user-0", role: "owner", id: "member-0" },
				{ userId: "user-1", role: "admin", id: "member-1" },
				{ userId: "user-2", role: "member", id: "member-2" },
			],
		} as never);

		await expect(
			call(
				organizationsRouter.members.updateRole,
				{
					organizationId: "org-1",
					memberId: "member-2",
					role: "owner",
				},
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(auth.api.updateMemberRole).not.toHaveBeenCalled();
	});

	it("allows owner to promote another member", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(auth.api.updateMemberRole).mockResolvedValue({
			id: "member-2",
			role: "admin",
		} as never);

		const result = await call(
			organizationsRouter.members.updateRole,
			{
				organizationId: "org-1",
				memberId: "member-2",
				role: "admin",
			},
			{ context: authenticatedContext },
		);

		expect(auth.api.updateMemberRole).toHaveBeenCalledWith({
			body: {
				memberId: "member-2",
				role: "admin",
				organizationId: "org-1",
			},
			headers: authenticatedContext.headers,
		});
		expect(result).toEqual({ id: "member-2", role: "admin" });
	});

	it("passes the resolved member id when addressed by user id", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(auth.api.updateMemberRole).mockResolvedValue({} as never);

		await call(
			organizationsRouter.members.updateRole,
			{ organizationId: "org-1", memberId: "user-2", role: "admin" },
			{ context: authenticatedContext },
		);

		expect(auth.api.updateMemberRole).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({ memberId: "member-2" }),
			}),
		);
	});
});

describe("organizations.members.list ordering", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns members in a total order: createdAt asc, id asc on ties", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [
				{
					id: "m-c",
					userId: "user-1",
					role: "owner",
					createdAt: new Date("2024-01-02T00:00:00Z"),
				},
				{
					id: "m-b",
					userId: "user-2",
					role: "member",
					createdAt: new Date("2024-01-01T00:00:00Z"),
				},
				{
					id: "m-a",
					userId: "user-3",
					role: "member",
					createdAt: new Date("2024-01-01T00:00:00Z"),
				},
			],
		} as never);

		const result = await call(
			organizationsRouter.members.list,
			{ organizationId: "org-1" },
			{ context: authenticatedContext },
		);

		expect(result.items.map((m) => m.id)).toEqual(["m-a", "m-b", "m-c"]);
	});
});

describe("organizations.invitations.list", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("lists invitations as admin", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(auth.api.listInvitations).mockResolvedValue([
			{ id: "inv-1", email: "pending@fuutu.local" },
		] as never);

		const result = await call(
			organizationsRouter.invitations.list,
			{ organizationId: "org-1" },
			{ context: authenticatedContext },
		);

		expect(auth.api.listInvitations).toHaveBeenCalledWith({
			query: { organizationId: "org-1" },
			headers: authenticatedContext.headers,
		});
		expect(result).toEqual({
			items: [{ id: "inv-1", email: "pending@fuutu.local" }],
			total: 1,
			page: 1,
			limit: 1,
			totalPages: 1,
		});
	});

	// Pending invitations carry invitee emails — only members who may
	// invite see them.
	it("rejects a plain member (needs INVITE_MEMBER)", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		await expect(
			call(
				organizationsRouter.invitations.list,
				{ organizationId: "org-1" },
				{ context: makeSession<Context>(makeUser({ id: "user-2" })) },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(auth.api.listInvitations).not.toHaveBeenCalled();
	});

	it("returns invitations in a total order: createdAt desc, id asc on ties", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(auth.api.listInvitations).mockResolvedValue([
			{ id: "inv-b", createdAt: new Date("2024-01-01T00:00:00Z") },
			{ id: "inv-c", createdAt: new Date("2024-01-02T00:00:00Z") },
			{ id: "inv-a", createdAt: new Date("2024-01-01T00:00:00Z") },
		] as never);

		const result = await call(
			organizationsRouter.invitations.list,
			{ organizationId: "org-1" },
			{ context: authenticatedContext },
		);

		expect(result.items.map((i) => i.id)).toEqual(["inv-c", "inv-a", "inv-b"]);
	});
});

describe("organizations.invitations.revoke", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("revokes an invitation as admin", async () => {
		vi.mocked(getInvitationOrganizationId).mockResolvedValue({
			organizationId: "org-1",
		} as never);
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(auth.api.cancelInvitation).mockResolvedValue("ok" as never);

		const result = await call(
			organizationsRouter.invitations.revoke,
			{ invitationId: "inv-1" },
			{ context: authenticatedContext },
		);

		expect(auth.api.cancelInvitation).toHaveBeenCalledWith({
			body: { invitationId: "inv-1" },
			headers: authenticatedContext.headers,
		});
		expect(result).toEqual({ success: true });
	});

	it("throws NOT_FOUND when invitation does not exist", async () => {
		vi.mocked(getInvitationOrganizationId).mockResolvedValue(null as never);

		await expect(
			call(
				organizationsRouter.invitations.revoke,
				{ invitationId: "inv-missing" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

// getFullOrganization caps the member list; a target beyond the cap must be
// resolved from the DB, never defaulted to "member".
describe("member target outside the loaded member list", () => {
	const cappedOrg = {
		...orgFixture,
		members: [{ userId: "user-1", role: "admin", id: "member-1" }],
	};
	const ownerRow = {
		id: "member-0",
		userId: "user-0",
		role: "owner",
		email: "owner@example.com",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			cappedOrg as never,
		);
		vi.mocked(findOrganizationMember).mockImplementation(async (_org, id) =>
			id === "member-0" ? ownerRow : null,
		);
	});

	it("an admin cannot demote an owner missing from the loaded list", async () => {
		await expect(
			call(
				organizationsRouter.members.updateRole,
				{ organizationId: "org-1", memberId: "member-0", role: "member" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(auth.api.updateMemberRole).not.toHaveBeenCalled();
	});

	it("an admin cannot remove an owner missing from the loaded list", async () => {
		await expect(
			call(
				organizationsRouter.members.remove,
				{ organizationId: "org-1", memberIdOrEmail: "member-0" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(auth.api.removeMember).not.toHaveBeenCalled();
	});

	it("an unknown member id is NOT_FOUND", async () => {
		await expect(
			call(
				organizationsRouter.members.updateRole,
				{ organizationId: "org-1", memberId: "nope", role: "member" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(
			call(
				organizationsRouter.members.remove,
				{ organizationId: "org-1", memberIdOrEmail: "nope" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
