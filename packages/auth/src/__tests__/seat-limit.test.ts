import { paymentsConfig } from "@fuutu/payments/config";
import { APIError } from "better-auth/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	assertInviteSeatAvailable,
	assertSeatAvailable,
} from "../hooks/seat-limit";

const countOrganizationMembers = vi.fn();
const countPendingInvitations = vi.fn();
const getOrganizationById = vi.fn();
const getOrgEntitlement = vi.fn();

vi.mock("@fuutu/db", () => ({
	countOrganizationMembers: (...args: unknown[]) =>
		countOrganizationMembers(...args),
	countPendingInvitations: (...args: unknown[]) =>
		countPendingInvitations(...args),
	getOrganizationById: (...args: unknown[]) => getOrganizationById(...args),
}));

vi.mock("@fuutu/payments", () => ({
	getOrgEntitlement: (...args: unknown[]) => getOrgEntitlement(...args),
}));

// Limits deliberately disagree with seatsTotal — the gate must read
// the entitlement's seatsTotal, never recompute from LIMITS.
const entitlement = (seatsTotal: number | null) => ({
	scope: "organization",
	ownerId: "org-1",
	planId: "free",
	tier: "free",
	features: [],
	limits: { membersPerOrg: 1 },
	seatsTotal,
});

afterEach(() => {
	paymentsConfig.seatUpgradeUrl = undefined;
});

describe("assertSeatAvailable()", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getOrgEntitlement.mockResolvedValue(entitlement(5));
		getOrganizationById.mockResolvedValue({ id: "org-1", slug: "acme" });
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
			upgradeUrl: "/organizations/acme/settings/billing",
		});
	});

	it("links the 402 to paymentsConfig.seatUpgradeUrl when configured", async () => {
		paymentsConfig.seatUpgradeUrl = (slug) => `https://shop.test/seats/${slug}`;
		countOrganizationMembers.mockResolvedValue(5);

		const err = await assertSeatAvailable("org-1").catch((e) => e);
		expect((err as APIError).body).toMatchObject({
			upgradeUrl: "https://shop.test/seats/acme",
		});
		expect(getOrganizationById).toHaveBeenCalledWith("org-1");
	});

	it("reads the cap from Entitlement.seatsTotal, not LIMITS", async () => {
		getOrgEntitlement.mockResolvedValue(entitlement(10));
		countOrganizationMembers.mockResolvedValue(7);

		await expect(assertSeatAvailable("org-1")).resolves.toBeUndefined();
	});

	it("always resolves when seatsTotal is null (unlimited)", async () => {
		getOrgEntitlement.mockResolvedValue(entitlement(null));
		countOrganizationMembers.mockResolvedValue(999);

		await expect(assertSeatAvailable("org-1")).resolves.toBeUndefined();
	});

	it("rejects every add when seatsTotal is 0", async () => {
		getOrgEntitlement.mockResolvedValue(entitlement(0));
		countOrganizationMembers.mockResolvedValue(0);

		const err = await assertSeatAvailable("org-1").catch((e) => e);
		expect((err as APIError).statusCode).toBe(402);
		expect((err as APIError).body).toMatchObject({ seatsTotal: 0 });
	});
});

describe("assertInviteSeatAvailable()", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getOrgEntitlement.mockResolvedValue(entitlement(5));
		getOrganizationById.mockResolvedValue({ id: "org-1", slug: "acme" });
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

	it("resolves on unlimited (null) seats regardless of pending count", async () => {
		getOrgEntitlement.mockResolvedValue(entitlement(null));
		countPendingInvitations.mockResolvedValue(999);

		await expect(assertInviteSeatAvailable("org-1")).resolves.toBeUndefined();
	});
});
