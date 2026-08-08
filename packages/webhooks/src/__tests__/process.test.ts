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

import { processPendingDeliveries } from "../process";

describe("processPendingDeliveries", () => {
	beforeEach(() => {
		recoverStaleDeliveriesMock.mockReset();
		claimPendingDeliveriesMock.mockReset();
		getWebhookForDeliveryMock.mockReset();
		updateDeliveryStatusMock.mockReset();
	});

	it("calls recoverStaleDeliveries before claiming pending deliveries", async () => {
		recoverStaleDeliveriesMock.mockResolvedValue({ count: 0 });
		claimPendingDeliveriesMock.mockResolvedValue([]);

		await processPendingDeliveries();

		expect(recoverStaleDeliveriesMock).toHaveBeenCalledTimes(1);
		expect(recoverStaleDeliveriesMock).toHaveBeenCalledWith(5 * 60 * 1000);
		expect(claimPendingDeliveriesMock).toHaveBeenCalledTimes(1);
	});

	it("still claims deliveries when recoverStaleDeliveries finds none", async () => {
		recoverStaleDeliveriesMock.mockResolvedValue({ count: 0 });
		claimPendingDeliveriesMock.mockResolvedValue([]);

		const result = await processPendingDeliveries();

		expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
		expect(claimPendingDeliveriesMock).toHaveBeenCalledTimes(1);
	});
});
