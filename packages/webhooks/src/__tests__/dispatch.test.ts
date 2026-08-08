import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

const recordDeliveryMock = vi.fn();
const listActiveWebhooksByOrgMock = vi.fn();

vi.mock("@fuutu/db", () => ({
	listActiveWebhooksByOrg: (...args: unknown[]) =>
		listActiveWebhooksByOrgMock(...args),
	recordDelivery: (...args: unknown[]) => recordDeliveryMock(...args),
}));

import { dispatchEvent } from "../dispatch";

describe("dispatchEvent", () => {
	beforeEach(() => {
		recordDeliveryMock.mockReset();
		listActiveWebhooksByOrgMock.mockReset();
	});

	it("enqueues a pending delivery for each matching active webhook", async () => {
		listActiveWebhooksByOrgMock.mockResolvedValue([
			{ id: "wh-1" },
			{ id: "wh-2" },
		]);
		recordDeliveryMock.mockResolvedValue({});

		const result = await dispatchEvent(
			"contact.created",
			{ contactId: "c-1" },
			"org-1",
		);

		expect(result.enqueued).toBe(2);
		expect(listActiveWebhooksByOrgMock).toHaveBeenCalledWith(
			"org-1",
			"contact.created",
		);
		expect(recordDeliveryMock).toHaveBeenCalledTimes(2);

		const firstCall = recordDeliveryMock.mock.calls[0]?.[0] as {
			webhookId: string;
			eventType: string;
			status: string;
			payload: Record<string, unknown>;
		};
		expect(firstCall.webhookId).toBe("wh-1");
		expect(firstCall.eventType).toBe("contact.created");
		expect(firstCall.status).toBe("pending");
		expect(firstCall.payload).toEqual({ contactId: "c-1" });

		const secondCall = recordDeliveryMock.mock.calls[1]?.[0] as {
			webhookId: string;
		};
		expect(secondCall.webhookId).toBe("wh-2");
	});

	it("returns enqueued: 0 when no webhooks match the event type", async () => {
		listActiveWebhooksByOrgMock.mockResolvedValue([]);

		const result = await dispatchEvent("contact.created", {}, "org-1");

		expect(result.enqueued).toBe(0);
		expect(recordDeliveryMock).not.toHaveBeenCalled();
	});

	it("rejects empty eventType", async () => {
		await expect(dispatchEvent("", {}, "org-1")).rejects.toThrow();
	});

	it("rejects empty organizationId", async () => {
		await expect(dispatchEvent("contact.created", {}, "")).rejects.toThrow();
	});

	it("counts only successful deliveries when some recordDelivery calls reject", async () => {
		listActiveWebhooksByOrgMock.mockResolvedValue([
			{ id: "wh-1" },
			{ id: "wh-2" },
			{ id: "wh-3" },
		]);
		recordDeliveryMock.mockResolvedValueOnce({});
		recordDeliveryMock.mockRejectedValueOnce(new Error("db write failed"));
		recordDeliveryMock.mockResolvedValueOnce({});

		const result = await dispatchEvent("contact.created", {}, "org-1");

		expect(result.enqueued).toBe(2);
		expect(recordDeliveryMock).toHaveBeenCalledTimes(3);
	});
});
