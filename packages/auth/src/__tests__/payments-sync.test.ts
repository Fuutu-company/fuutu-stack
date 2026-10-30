import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	cancelActiveSubscriptionsForUser,
	syncSeatsForOrganization,
} from "../hooks/payments-sync";

const countOrganizationMembers = vi.fn();
const getPurchasesByUserId = vi.fn();
const cancelSubscription = vi.fn();
const updateSeatsInOrganizationSubscription = vi.fn();
const logError = vi.fn();

vi.mock("@fuutu/db", () => ({
	countOrganizationMembers: (...args: unknown[]) =>
		countOrganizationMembers(...args),
	getPurchasesByUserId: (...args: unknown[]) => getPurchasesByUserId(...args),
}));

vi.mock("@fuutu/payments", () => ({
	resolvePaymentProvider: () => ({ cancelSubscription }),
	updateSeatsInOrganizationSubscription: (...args: unknown[]) =>
		updateSeatsInOrganizationSubscription(...args),
	cancelAllSubscriptionsForOrganization: vi.fn(),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: (...args: unknown[]) => logError(...args),
	}),
}));

const sub = (over: Record<string, unknown> = {}) => ({
	type: "SUBSCRIPTION",
	subscriptionId: "sub_1",
	status: "ACTIVE",
	...over,
});

describe("syncSeatsForOrganization()", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		countOrganizationMembers.mockResolvedValue(3);
		updateSeatsInOrganizationSubscription.mockResolvedValue(undefined);
	});

	it("syncs the member count to the payment provider", async () => {
		await syncSeatsForOrganization("org-1");

		expect(updateSeatsInOrganizationSubscription).toHaveBeenCalledWith(
			"org-1",
			3,
		);
	});

	it("swallows provider failures and logs them", async () => {
		updateSeatsInOrganizationSubscription.mockRejectedValue(
			new Error("provider down"),
		);

		await expect(syncSeatsForOrganization("org-1")).resolves.toBeUndefined();
		expect(logError).toHaveBeenCalled();
	});
});

describe("cancelActiveSubscriptionsForUser()", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		cancelSubscription.mockResolvedValue(undefined);
	});

	it("cancels only active/trialing subscriptions", async () => {
		getPurchasesByUserId.mockResolvedValue([
			sub({ subscriptionId: "sub_active" }),
			sub({ subscriptionId: "sub_trial", status: "TRIALING" }),
			sub({ subscriptionId: "sub_canceled", status: "CANCELED" }),
			{ type: "ONE_TIME", subscriptionId: null, status: "ACTIVE" },
		]);

		await cancelActiveSubscriptionsForUser("user-1");

		expect(cancelSubscription).toHaveBeenCalledTimes(2);
		expect(cancelSubscription).toHaveBeenCalledWith("sub_active");
		expect(cancelSubscription).toHaveBeenCalledWith("sub_trial");
	});

	it("does not throw on a partial provider rejection and logs it", async () => {
		getPurchasesByUserId.mockResolvedValue([
			sub({ subscriptionId: "sub_ok" }),
			sub({ subscriptionId: "sub_bad" }),
		]);
		cancelSubscription
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("stripe 500"));

		await expect(
			cancelActiveSubscriptionsForUser("user-1"),
		).resolves.toBeUndefined();
		expect(cancelSubscription).toHaveBeenCalledTimes(2);
		expect(logError).toHaveBeenCalled();
	});

	it("returns silently when the purchase lookup fails", async () => {
		getPurchasesByUserId.mockRejectedValue(new Error("db down"));

		await expect(
			cancelActiveSubscriptionsForUser("user-1"),
		).resolves.toBeUndefined();
		expect(cancelSubscription).not.toHaveBeenCalled();
		expect(logError).toHaveBeenCalled();
	});
});
