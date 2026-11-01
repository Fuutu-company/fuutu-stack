import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	assertInviteSeatAvailable,
	assertSeatAvailable,
} from "../hooks/seat-limit";

const mockEnv = vi.hoisted(() => ({
	env: {
		NEXT_PUBLIC_MARKETING_URL: "https://marketing.test" as string | undefined,
	},
}));

const countOrganizationMembers = vi.fn();
const countPendingInvitations = vi.fn();
const getOrgEntitlement = vi.fn();

vi.mock("@fuutu/db", () => ({
	countOrganizationMembers: (...args: unknown[]) =>
		countOrganizationMembers(...args),
	countPendingInvitations: (...args: unknown[]) =>
		countPendingInvitations(...args),
}));

vi.mock("@fuutu/payments", () => ({
	getOrgEntitlement: (...args: unknown[]) => getOrgEntitlement(...args),
}));

vi.mock("@fuutu/env/saas", () => mockEnv);

const entitlement = (membersPerOrg: number | "unlimited" | false) => ({
	scope: "organization",
	ownerId: "org-1",
	planId: "free",
	tier: "free",
	features: [],
	limits: { membersPerOrg },
});

describe("assertSeatAvailable()", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEnv.env.NEXT_PUBLIC_MARKETING_URL = "https://marketing.test";
		getOrgEntitlement.mockResolvedValue(entitlement(5));
		countOrganizationMembers.mockResolvedValue(2);
	});

	it("resolves when the org is below its seat limit", async () => {
		await expect(assertSeatAvailable("org-1")).resolves.toBeUndefined();
		expect(getOrgEntitlement).toHaveBeenCalledWith("org-1");
		expect(countOrganizationMembers).toHaveBeenCalledWith("org-1");
	});

	it("rejects with APIError 402, seatsTotal and upgradeUrl at the limit", async () => {
		countOrganizationMembers.mockResolvedValue(5);

		const err = await assertSeatAvailable("org-1").catch((e) => e);
		expect(err).toBeInstanceOf(APIError);
		expect((err as APIError).statusCode).toBe(402);
		expect((err as APIError).body).toMatchObject({
			message: "Organization seat limit reached",
			seatsTotal: 5,
			upgradeUrl: "https://marketing.test/pricing",
		});
	});

	it("falls back to /pricing when NEXT_PUBLIC_MARKETING_URL is unset", async () => {
		mockEnv.env.NEXT_PUBLIC_MARKETING_URL = undefined;
		countOrganizationMembers.mockResolvedValue(5);

		const err = await assertSeatAvailable("org-1").catch((e) => e);
		expect((err as APIError).body).toMatchObject({
			upgradeUrl: "/pricing",
		});
	});

	it('always resolves when the plan is "unlimited"', async () => {
		getOrgEntitlement.mockResolvedValue(entitlement("unlimited"));
		countOrganizationMembers.mockResolvedValue(999);

		await expect(assertSeatAvailable("org-1")).resolves.toBeUndefined();
	});

	it("treats a false limit as 0 seats and always rejects", async () => {
		getOrgEntitlement.mockResolvedValue(entitlement(false));
		countOrganizationMembers.mockResolvedValue(0);

		const err = await assertSeatAvailable("org-1").catch((e) => e);
		expect((err as APIError).statusCode).toBe(402);
		expect((err as APIError).body).toMatchObject({ seatsTotal: 0 });
	});
});

describe("assertInviteSeatAvailable()", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEnv.env.NEXT_PUBLIC_MARKETING_URL = "https://marketing.test";
		getOrgEntitlement.mockResolvedValue(entitlement(5));
		countOrganizationMembers.mockResolvedValue(3);
		countPendingInvitations.mockResolvedValue(1);
	});

	it("resolves when members + pending invitations stay below the limit", async () => {
		await expect(assertInviteSeatAvailable("org-1")).resolves.toBeUndefined();
		expect(countPendingInvitations).toHaveBeenCalledWith("org-1");
	});

	it("rejects when pending invitations fill the remaining seats", async () => {
		countPendingInvitations.mockResolvedValue(2);

		const err = await assertInviteSeatAvailable("org-1").catch((e) => e);
		expect(err).toBeInstanceOf(APIError);
		expect((err as APIError).statusCode).toBe(402);
	});

	it('resolves on "unlimited" regardless of pending count', async () => {
		getOrgEntitlement.mockResolvedValue(entitlement("unlimited"));
		countPendingInvitations.mockResolvedValue(999);

		await expect(assertInviteSeatAvailable("org-1")).resolves.toBeUndefined();
	});
});
