import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { paymentsRouter } from "../modules/payments/router";

vi.mock("@fuutu/payments", () => ({
	getOrgEntitlement: vi.fn(),
	resolvePaymentProvider: vi.fn(),
	PaymentsDisabledError: class PaymentsDisabledError extends Error {},
	WebhookConfigError: class WebhookConfigError extends Error {},
	CREDIT_TOPUPS: [],
}));

vi.mock("@fuutu/db", () => ({}));

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

const { auth } = await import("@fuutu/auth");
const { getOrgEntitlement } = await import("@fuutu/payments");

const authenticatedContext = makeSession<Context>(makeUser());
const unauthenticatedContext = makeSession<Context>(null);

describe("payments.orgPlans.list", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the resolved plan of every organization the caller belongs to", async () => {
		vi.mocked(auth.api.listOrganizations).mockResolvedValue([
			{ id: "org-a", name: "A", slug: "a" },
			{ id: "org-b", name: "B", slug: "b" },
		] as never);
		vi.mocked(getOrgEntitlement).mockImplementation(
			async (organizationId: string) =>
				({ planId: organizationId === "org-a" ? "pro" : "free" }) as never,
		);

		const result = await call(
			paymentsRouter.orgPlans.list,
			{},
			{ context: authenticatedContext },
		);

		expect(auth.api.listOrganizations).toHaveBeenCalledWith({
			headers: authenticatedContext.headers,
		});
		expect(result).toEqual({
			items: [
				{ organizationId: "org-a", planId: "pro" },
				{ organizationId: "org-b", planId: "free" },
			],
		});
	});

	it("only resolves entitlements for the caller's own organizations", async () => {
		vi.mocked(auth.api.listOrganizations).mockResolvedValue([
			{ id: "org-a", name: "A", slug: "a" },
		] as never);
		vi.mocked(getOrgEntitlement).mockResolvedValue({
			planId: "enterprise",
		} as never);

		await call(
			paymentsRouter.orgPlans.list,
			{},
			{ context: authenticatedContext },
		);

		expect(getOrgEntitlement).toHaveBeenCalledTimes(1);
		expect(getOrgEntitlement).toHaveBeenCalledWith("org-a");
	});

	it("returns an empty list without resolving entitlements when the caller has no organizations", async () => {
		vi.mocked(auth.api.listOrganizations).mockResolvedValue([] as never);

		const result = await call(
			paymentsRouter.orgPlans.list,
			{},
			{ context: authenticatedContext },
		);

		expect(result).toEqual({ items: [] });
		expect(getOrgEntitlement).not.toHaveBeenCalled();
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(
				paymentsRouter.orgPlans.list,
				{},
				{ context: unauthenticatedContext },
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		expect(auth.api.listOrganizations).not.toHaveBeenCalled();
	});
});
