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
}));

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

const { auth } = await import("@fuutu/auth");
const { getOrganizationBySlug, getInvitationOrganizationId } = await import(
	"@fuutu/db"
);

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
