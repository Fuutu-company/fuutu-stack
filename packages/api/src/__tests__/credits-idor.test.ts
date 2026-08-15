import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { creditsRouter } from "../modules/credits/router";

vi.mock("@fuutu/db", () => ({
	getCreditEventsForOrganization: vi.fn(),
	getCreditEventsForUser: vi.fn(),
	getCreditPackagesForOrganization: vi.fn(),
	getCreditPackagesForUser: vi.fn(),
}));

vi.mock("@fuutu/credits", () => ({
	getCreditBalanceSummary: vi.fn(),
}));

vi.mock("@fuutu/auth", () => ({
	auth: {
		api: {
			getFullOrganization: vi.fn(),
		},
	},
}));

const {
	getCreditEventsForOrganization,
	getCreditEventsForUser,
	getCreditPackagesForOrganization,
	getCreditPackagesForUser,
} = await import("@fuutu/db");
const { getCreditBalanceSummary } = await import("@fuutu/credits");
const { auth } = await import("@fuutu/auth");

const authenticatedContext = makeSession<Context>(makeUser());
const unauthenticatedContext = makeSession<Context>(null);

const orgFixture = {
	id: "12345678-1234-1234-8123-123456789abc",
	name: "Acme",
	slug: "acme",
	createdAt: new Date("2024-01-01"),
	members: [{ userId: "user-1", role: "owner", id: "member-1" }],
	invitations: [],
};

const foreignOrgFixture = {
	id: "87654321-4321-4321-9123-210fedcba987",
	name: "Foreign Corp",
	slug: "foreign",
	createdAt: new Date("2024-01-01"),
	members: [{ userId: "user-evil", role: "owner", id: "member-evil" }],
	invitations: [],
};

describe("credits.balance — IDOR protection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCreditBalanceSummary).mockResolvedValue([] as never);
	});

	it("returns balance for the current user when no organizationId", async () => {
		await call(creditsRouter.balance, {}, { context: authenticatedContext });

		expect(getCreditBalanceSummary).toHaveBeenCalledWith({
			userId: "user-1",
			organizationId: undefined,
		});
	});

	it("returns balance for an org when user is a member", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);

		await call(
			creditsRouter.balance,
			{ organizationId: "12345678-1234-1234-8123-123456789abc" },
			{ context: authenticatedContext },
		);

		expect(getCreditBalanceSummary).toHaveBeenCalledWith({
			userId: undefined,
			organizationId: "12345678-1234-1234-8123-123456789abc",
		});
	});

	it("rejects FORBIDDEN when user is not a member of the org", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			foreignOrgFixture as never,
		);

		await expect(
			call(
				creditsRouter.balance,
				{ organizationId: "87654321-4321-4321-9123-210fedcba987" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		expect(getCreditBalanceSummary).not.toHaveBeenCalled();
	});

	it("rejects FORBIDDEN when org does not exist", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(null as never);

		await expect(
			call(
				creditsRouter.balance,
				{ organizationId: "99999999-9999-1999-9123-999999999999" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		expect(getCreditBalanceSummary).not.toHaveBeenCalled();
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(creditsRouter.balance, {}, { context: unauthenticatedContext }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("credits.history — IDOR protection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCreditEventsForUser).mockResolvedValue([] as never);
		vi.mocked(getCreditEventsForOrganization).mockResolvedValue([] as never);
	});

	it("returns events for the current user when no organizationId", async () => {
		await call(creditsRouter.history, {}, { context: authenticatedContext });

		expect(getCreditEventsForUser).toHaveBeenCalledWith("user-1", 50);
		expect(getCreditEventsForOrganization).not.toHaveBeenCalled();
	});

	it("returns events for an org when user is a member", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);

		await call(
			creditsRouter.history,
			{ organizationId: "12345678-1234-1234-8123-123456789abc" },
			{ context: authenticatedContext },
		);

		expect(getCreditEventsForOrganization).toHaveBeenCalledWith(
			"12345678-1234-1234-8123-123456789abc",
			50,
		);
		expect(getCreditEventsForUser).not.toHaveBeenCalled();
	});

	it("rejects FORBIDDEN when user is not a member of the org", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			foreignOrgFixture as never,
		);

		await expect(
			call(
				creditsRouter.history,
				{ organizationId: "87654321-4321-4321-9123-210fedcba987" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		expect(getCreditEventsForOrganization).not.toHaveBeenCalled();
		expect(getCreditEventsForUser).not.toHaveBeenCalled();
	});

	it("rejects FORBIDDEN when org does not exist", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(null as never);

		await expect(
			call(
				creditsRouter.history,
				{ organizationId: "99999999-9999-1999-9123-999999999999" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		expect(getCreditEventsForOrganization).not.toHaveBeenCalled();
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(creditsRouter.history, {}, { context: unauthenticatedContext }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("credits.packages — IDOR protection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getCreditPackagesForUser).mockResolvedValue([] as never);
		vi.mocked(getCreditPackagesForOrganization).mockResolvedValue([] as never);
	});

	it("returns packages for the current user when no organizationId", async () => {
		await call(creditsRouter.packages, {}, { context: authenticatedContext });

		expect(getCreditPackagesForUser).toHaveBeenCalledWith("user-1");
		expect(getCreditPackagesForOrganization).not.toHaveBeenCalled();
	});

	it("returns packages for an org when user is a member", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);

		await call(
			creditsRouter.packages,
			{ organizationId: "12345678-1234-1234-8123-123456789abc" },
			{ context: authenticatedContext },
		);

		expect(getCreditPackagesForOrganization).toHaveBeenCalledWith(
			"12345678-1234-1234-8123-123456789abc",
		);
		expect(getCreditPackagesForUser).not.toHaveBeenCalled();
	});

	it("rejects FORBIDDEN when user is not a member of the org", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			foreignOrgFixture as never,
		);

		await expect(
			call(
				creditsRouter.packages,
				{ organizationId: "87654321-4321-4321-9123-210fedcba987" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		expect(getCreditPackagesForOrganization).not.toHaveBeenCalled();
		expect(getCreditPackagesForUser).not.toHaveBeenCalled();
	});

	it("rejects FORBIDDEN when org does not exist", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(null as never);

		await expect(
			call(
				creditsRouter.packages,
				{ organizationId: "99999999-9999-1999-9123-999999999999" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		expect(getCreditPackagesForOrganization).not.toHaveBeenCalled();
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(creditsRouter.packages, {}, { context: unauthenticatedContext }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});
