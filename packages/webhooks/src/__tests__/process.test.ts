import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

vi.mock("@fuutu/env/saas", () => ({
	env: { NODE_ENV: "test" },
}));

const recoverStaleDeliveriesMock = vi.fn();
const claimPendingDeliveriesMock = vi.fn();
const getWebhookForDeliveryMock = vi.fn();
const updateDeliveryStatusMock = vi.fn();
const deliverWebhookMock = vi.fn();

vi.mock("@fuutu/db", () => ({
	recoverStaleDeliveries: (...args: unknown[]) =>
		recoverStaleDeliveriesMock(...args),
	claimPendingDeliveries: (...args: unknown[]) =>
		claimPendingDeliveriesMock(...args),
	getWebhookForDelivery: (...args: unknown[]) =>
		getWebhookForDeliveryMock(...args),
	updateDeliveryStatus: (...args: unknown[]) =>
		updateDeliveryStatusMock(...args),
}));

vi.mock("../deliver", () => ({
	deliverWebhook: (...args: unknown[]) => deliverWebhookMock(...args),
}));

import { processPendingDeliveries } from "../process";

const activeWebhook = {
	id: "wh-1",
	url: "https://example.com/hook",
	secret: "s",
	events: ["test.event"],
	isActive: true,
};

function makeDelivery(overrides: Record<string, unknown> = {}) {
	return {
		id: "del-1",
		webhookId: "wh-1",
		eventId: "evt-1",
		eventType: "test.event",
		payload: { foo: "bar" },
		status: "processing",
		responseCode: null,
		responseBody: null,
		attempt: 1,
		attemptedAt: new Date(),
		nextRetryAt: null,
		...overrides,
	};
}

function lastStatusUpdate() {
	const calls = updateDeliveryStatusMock.mock.calls;
	return calls[calls.length - 1]?.[1] as Record<string, unknown> | undefined;
}

describe("processPendingDeliveries", () => {
	beforeEach(() => {
		recoverStaleDeliveriesMock.mockReset();
		claimPendingDeliveriesMock.mockReset();
		getWebhookForDeliveryMock.mockReset();
		updateDeliveryStatusMock.mockReset();
		deliverWebhookMock.mockReset();
		recoverStaleDeliveriesMock.mockResolvedValue({ count: 0 });
	});

	it("calls recoverStaleDeliveries before claiming pending deliveries", async () => {
		claimPendingDeliveriesMock.mockResolvedValue([]);

		await processPendingDeliveries();

		expect(recoverStaleDeliveriesMock).toHaveBeenCalledTimes(1);
		expect(recoverStaleDeliveriesMock).toHaveBeenCalledWith({
			timeoutMs: 5 * 60 * 1000,
			maxRetries: 5,
			retryBaseDelayMs: 1000,
			maxRetryDelayMs: 60 * 60 * 1000,
		});
		expect(claimPendingDeliveriesMock).toHaveBeenCalledTimes(1);
	});

	it("still claims deliveries when recoverStaleDeliveries finds none", async () => {
		claimPendingDeliveriesMock.mockResolvedValue([]);

		const result = await processPendingDeliveries();

		expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
		expect(claimPendingDeliveriesMock).toHaveBeenCalledTimes(1);
	});

	it("marks a successful delivery as success", async () => {
		const delivery = makeDelivery();
		claimPendingDeliveriesMock.mockResolvedValue([delivery]);
		getWebhookForDeliveryMock.mockResolvedValue(activeWebhook);
		deliverWebhookMock.mockResolvedValue({
			success: true,
			responseCode: 200,
			responseBody: "OK",
			error: null,
		});

		const result = await processPendingDeliveries();

		expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
		expect(updateDeliveryStatusMock).toHaveBeenCalledWith("del-1", {
			status: "success",
			responseCode: 200,
			responseBody: "OK",
			attempt: 1,
			nextRetryAt: null,
		});
	});

	it("schedules a retry with backoff on failure below maxRetries", async () => {
		const delivery = makeDelivery({ attempt: 1 });
		claimPendingDeliveriesMock.mockResolvedValue([delivery]);
		getWebhookForDeliveryMock.mockResolvedValue(activeWebhook);
		deliverWebhookMock.mockResolvedValue({
			success: false,
			responseCode: 500,
			responseBody: "err",
			error: null,
		});

		const result = await processPendingDeliveries();

		expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
		const update = lastStatusUpdate();
		expect(update?.status).toBe("retrying");
		expect(update?.attempt).toBe(2);
		expect(update?.nextRetryAt).toBeInstanceOf(Date);
	});

	it("marks the delivery failed when retries are exhausted", async () => {
		const delivery = makeDelivery({ attempt: 5 });
		claimPendingDeliveriesMock.mockResolvedValue([delivery]);
		getWebhookForDeliveryMock.mockResolvedValue(activeWebhook);
		deliverWebhookMock.mockResolvedValue({
			success: false,
			responseCode: 500,
			responseBody: "err",
			error: null,
		});

		const result = await processPendingDeliveries();

		expect(result.failed).toBe(1);
		const update = lastStatusUpdate();
		expect(update?.status).toBe("failed");
		expect(update?.nextRetryAt).toBeNull();
	});

	it("marks deliveries terminal-failed when the webhook is gone or inactive (no processing loop)", async () => {
		const delivery = makeDelivery();
		claimPendingDeliveriesMock.mockResolvedValue([delivery]);
		getWebhookForDeliveryMock.mockResolvedValue(null);

		const result = await processPendingDeliveries();

		expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
		const update = lastStatusUpdate();
		expect(update?.status).toBe("failed");
		expect(update?.nextRetryAt).toBeNull();
		expect(deliverWebhookMock).not.toHaveBeenCalled();
	});

	it("persists the transport error as the failure reason when there is no response body", async () => {
		const delivery = makeDelivery();
		claimPendingDeliveriesMock.mockResolvedValue([delivery]);
		getWebhookForDeliveryMock.mockResolvedValue(activeWebhook);
		deliverWebhookMock.mockResolvedValue({
			success: false,
			responseCode: null,
			responseBody: null,
			error: "getaddrinfo ENOTFOUND example.com",
		});

		const result = await processPendingDeliveries();

		expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
		const update = lastStatusUpdate();
		expect(update?.responseBody).toBe("getaddrinfo ENOTFOUND example.com");
	});

	it("marks deliveries terminal-failed on invalid payload instead of leaving them in processing", async () => {
		const delivery = makeDelivery({ payload: "not-an-object" });
		claimPendingDeliveriesMock.mockResolvedValue([delivery]);
		getWebhookForDeliveryMock.mockResolvedValue(activeWebhook);

		const result = await processPendingDeliveries();

		expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
		const update = lastStatusUpdate();
		expect(update?.status).toBe("failed");
		expect(update?.nextRetryAt).toBeNull();
		expect(deliverWebhookMock).not.toHaveBeenCalled();
	});
});
