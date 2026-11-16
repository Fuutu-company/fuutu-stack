import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listSoleOwnedOrganizations = vi.fn();
const cancelUserOrThrow = vi.fn();
const cancelOrgOrThrow = vi.fn();

vi.mock("@fuutu/db", () => ({
	listSoleOwnedOrganizations: (...args: unknown[]) =>
		listSoleOwnedOrganizations(...args),
}));

vi.mock("../hooks/payments-sync", () => {
	class SubscriptionCancellationError extends Error {
		constructor() {
			super("Subscriptions could not be cancelled");
			this.name = "SubscriptionCancellationError";
		}
	}
	return {
		SubscriptionCancellationError,
		cancelActiveSubscriptionsForUserOrThrow: (...args: unknown[]) =>
			cancelUserOrThrow(...args),
		cancelActiveSubscriptionsForOrganizationOrThrow: (...args: unknown[]) =>
			cancelOrgOrThrow(...args),
	};
});

const { beforeUserDelete, beforeOrganizationDelete } = await import(
	"../hooks/account-deletion"
);
const { SubscriptionCancellationError } = await import(
	"../hooks/payments-sync"
);

beforeEach(() => {
	vi.clearAllMocks();
	listSoleOwnedOrganizations.mockResolvedValue([]);
	cancelUserOrThrow.mockResolvedValue(undefined);
	cancelOrgOrThrow.mockResolvedValue(undefined);
});

describe("beforeUserDelete", () => {
	it("refuses the sole owner of an organization and cancels nothing", async () => {
		listSoleOwnedOrganizations.mockResolvedValue([
			{ id: "org-1", name: "Acme", slug: "acme" },
		]);
		const error = await beforeUserDelete("user-1").catch((e: unknown) => e);
		expect(error).toBeInstanceOf(APIError);
		expect(error).toMatchObject({
			statusCode: 409,
			body: { code: "SOLE_ORGANIZATION_OWNER" },
		});
		expect(listSoleOwnedOrganizations).toHaveBeenCalledWith("user-1");
		expect(cancelUserOrThrow).not.toHaveBeenCalled();
	});

	it("aborts the delete when a subscription cannot be cancelled", async () => {
		cancelUserOrThrow.mockRejectedValue(new SubscriptionCancellationError());
		const error = await beforeUserDelete("user-1").catch((e: unknown) => e);
		expect(error).toBeInstanceOf(APIError);
		expect(error).toMatchObject({
			statusCode: 502,
			body: { code: "SUBSCRIPTION_CANCELLATION_FAILED" },
		});
	});

	it("lets the delete go ahead once every subscription is cancelled", async () => {
		await expect(beforeUserDelete("user-1")).resolves.toBeUndefined();
		expect(cancelUserOrThrow).toHaveBeenCalledWith("user-1");
	});

	it("rethrows unexpected errors", async () => {
		cancelUserOrThrow.mockRejectedValue(new Error("db down"));
		await expect(beforeUserDelete("user-1")).rejects.toThrow("db down");
	});
});

describe("beforeOrganizationDelete", () => {
	it("aborts the delete when a subscription cannot be cancelled", async () => {
		cancelOrgOrThrow.mockRejectedValue(new SubscriptionCancellationError());
		const error = await beforeOrganizationDelete("org-1").catch(
			(e: unknown) => e,
		);
		expect(error).toBeInstanceOf(APIError);
		expect(error).toMatchObject({ statusCode: 502 });
		expect(cancelOrgOrThrow).toHaveBeenCalledWith("org-1");
	});

	it("lets the delete go ahead once every subscription is cancelled", async () => {
		await expect(beforeOrganizationDelete("org-1")).resolves.toBeUndefined();
	});
});
