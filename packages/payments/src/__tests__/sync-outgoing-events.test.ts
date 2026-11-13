import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderEvent } from "../types";

// A provider retry after a failed purchase-changed handler (or any later
// step) takes the dedup/update path, which never emits subscription.created
// or invoice.paid — so the outgoing event must leave with the purchase row.
const mockCreatePurchase = vi.fn();
const mockGetPurchaseByProviderSubscriptionId = vi.fn();
const mockGetPurchaseByCheckoutEventId = vi.fn();
const mockSetOrganizationPaymentsCustomerId = vi.fn();

vi.mock("@fuutu/db", () => ({
	createPurchase: mockCreatePurchase,
	updatePurchase: vi.fn(),
	getPurchaseByProviderSubscriptionId: mockGetPurchaseByProviderSubscriptionId,
	getPurchaseByCheckoutEventId: mockGetPurchaseByCheckoutEventId,
	getPurchasesByOrganizationId: vi.fn().mockResolvedValue([]),
	getPurchasesByUserId: vi.fn().mockResolvedValue([]),
	getActiveSubscriptionForUser: vi.fn(),
	getActiveSubscriptionForOrganization: vi.fn(),
	getCreditBalance: vi.fn().mockResolvedValue(null),
	setPaymentsCustomerId: vi.fn(),
	setOrganizationPaymentsCustomerId: mockSetOrganizationPaymentsCustomerId,
	upsertInvoiceByProviderId: vi.fn(),
	isUniqueViolation: () => false,
}));

vi.mock("@fuutu/credits", () => ({
	grantRecurringCredits: vi.fn(),
	grantTopUpCredits: vi.fn(),
	resetRecurringCredits: vi.fn(),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

vi.mock("@fuutu/env/saas", () => ({ env: { NODE_ENV: "test" } }));

const mockDispatchEvent = vi.fn();
vi.mock("@fuutu/webhooks", () => ({ dispatchEvent: mockDispatchEvent }));

const { processWebhookEvents } = await import("../sync");
const { onPurchaseChanged } = await import("../extensions");

const PROVIDER_ID = "test-provider";

const activation: ProviderEvent = {
	type: "subscription.activated",
	subscriptionId: "sub_1",
	customerId: "cust_1",
	productId: "prod_1",
	status: "ACTIVE",
	metadata: { organization_id: "org_1" },
};

const checkout: ProviderEvent = {
	type: "checkout.completed",
	eventId: "evt_1",
	productId: "prod_once",
	metadata: { user_id: "user_1" },
};

const emitted = () =>
	mockDispatchEvent.mock.calls.map(([arg]) => (arg as { event: string }).event);

describe("processWebhookEvents — outgoing events survive a failed handler", () => {
	const handler = vi.fn();
	let unsubscribe: () => void = () => {};

	beforeEach(() => {
		vi.clearAllMocks();
		mockDispatchEvent.mockResolvedValue(undefined);
		mockCreatePurchase.mockResolvedValue({ id: "purchase_1" });
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(null);
		mockGetPurchaseByCheckoutEventId.mockResolvedValue(null);
		handler.mockReset();
		unsubscribe = onPurchaseChanged(handler);
	});

	afterEach(() => {
		unsubscribe();
	});

	it("emits subscription.created although the handler throws, and the retry re-runs the handler", async () => {
		handler.mockRejectedValueOnce(new Error("store down"));

		await expect(
			processWebhookEvents(PROVIDER_ID, [activation]),
		).rejects.toThrow("1 webhook event(s) failed");
		expect(emitted()).toEqual(["subscription.created"]);
		expect(mockDispatchEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				event: "subscription.created",
				organizationId: "org_1",
			}),
		);

		// Provider redelivery: the purchase now exists → update path.
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
			id: "purchase_1",
			status: "ACTIVE",
			organizationId: "org_1",
			userId: null,
		});
		await processWebhookEvents(PROVIDER_ID, [activation]);
		expect(handler).toHaveBeenCalledTimes(2);
		expect(handler).toHaveBeenLastCalledWith({ organizationId: "org_1" });
		expect(emitted().filter((e) => e === "subscription.created")).toHaveLength(
			1,
		);
	});

	it("emits subscription.created although a later step after the insert throws", async () => {
		mockSetOrganizationPaymentsCustomerId.mockRejectedValueOnce(
			new Error("db blip"),
		);

		await expect(
			processWebhookEvents(PROVIDER_ID, [activation]),
		).rejects.toThrow("1 webhook event(s) failed");
		expect(emitted()).toEqual(["subscription.created"]);
	});

	it("emits invoice.paid for a one-time purchase although the handler throws, and the retry re-runs the handler", async () => {
		handler.mockRejectedValueOnce(new Error("store down"));

		await expect(processWebhookEvents(PROVIDER_ID, [checkout])).rejects.toThrow(
			"1 webhook event(s) failed",
		);
		expect(emitted()).toEqual(["invoice.paid"]);
		expect(mockDispatchEvent).toHaveBeenCalledWith(
			expect.objectContaining({ event: "invoice.paid", userId: "user_1" }),
		);

		// Redelivery: dedup by checkout event id.
		mockGetPurchaseByCheckoutEventId.mockResolvedValue({
			id: "purchase_1",
			userId: "user_1",
			organizationId: null,
		});
		await processWebhookEvents(PROVIDER_ID, [checkout]);
		expect(handler).toHaveBeenCalledTimes(2);
		expect(emitted()).toEqual(["invoice.paid"]);
	});

	it("emits nothing when the purchase insert itself fails", async () => {
		mockCreatePurchase.mockRejectedValueOnce(new Error("insert failed"));

		await expect(
			processWebhookEvents(PROVIDER_ID, [activation]),
		).rejects.toThrow("1 webhook event(s) failed");
		expect(mockDispatchEvent).not.toHaveBeenCalled();
	});
});
