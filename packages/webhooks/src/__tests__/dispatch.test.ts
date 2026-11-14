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
const listOrganizationsForUserMock = vi.fn();

vi.mock("@fuutu/db", () => ({
	listActiveWebhooksByOrg: (...args: unknown[]) =>
		listActiveWebhooksByOrgMock(...args),
	listOrganizationsForUser: (...args: unknown[]) =>
		listOrganizationsForUserMock(...args),
	recordDelivery: (...args: unknown[]) => recordDeliveryMock(...args),
}));

const flags = vi.hoisted(() => ({ webhooks: true }));
vi.mock("@fuutu/config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@fuutu/config")>();
	return {
		...actual,
		config: {
			...actual.config,
			features: new Proxy(actual.config.features, {
				get: (target, prop, receiver) =>
					prop in flags
						? flags[prop as keyof typeof flags]
						: Reflect.get(target, prop, receiver),
			}),
		},
	};
});

import { dispatchEvent } from "../dispatch";
import { isWebhooksEnabled } from "../enabled";

describe("dispatchEvent", () => {
	beforeEach(() => {
		recordDeliveryMock.mockReset();
		listActiveWebhooksByOrgMock.mockReset();
		listOrganizationsForUserMock.mockReset();
	});

	it("enqueues a pending delivery for each matching active webhook", async () => {
		listActiveWebhooksByOrgMock.mockResolvedValue([
			{ id: "wh-1" },
			{ id: "wh-2" },
		]);
		recordDeliveryMock.mockResolvedValue({});

		const result = await dispatchEvent({
			event: "organization.updated",
			organizationId: "org-1",
			payload: { organizationId: "org-1" },
		});

		expect(result.enqueued).toBe(2);
		expect(listActiveWebhooksByOrgMock).toHaveBeenCalledWith(
			"org-1",
			"organization.updated",
		);
		expect(recordDeliveryMock).toHaveBeenCalledTimes(2);

		const firstCall = recordDeliveryMock.mock.calls[0]?.[0] as {
			webhookId: string;
			eventType: string;
			status: string;
			payload: Record<string, unknown>;
		};
		expect(firstCall.webhookId).toBe("wh-1");
		expect(firstCall.eventType).toBe("organization.updated");
		expect(firstCall.status).toBe("pending");
		expect(firstCall.payload).toEqual({ organizationId: "org-1" });

		const secondCall = recordDeliveryMock.mock.calls[1]?.[0] as {
			webhookId: string;
		};
		expect(secondCall.webhookId).toBe("wh-2");
	});

	it("resolves the user's organizations when only userId is given", async () => {
		listOrganizationsForUserMock.mockResolvedValue([
			{ id: "org-1" },
			{ id: "org-2" },
		]);
		listActiveWebhooksByOrgMock.mockImplementation((orgId: string) =>
			Promise.resolve([{ id: `wh-${orgId}` }]),
		);
		recordDeliveryMock.mockResolvedValue({});

		const result = await dispatchEvent({
			event: "user.updated",
			userId: "user-1",
			payload: { userId: "user-1" },
		});

		expect(listOrganizationsForUserMock).toHaveBeenCalledWith("user-1");
		expect(listActiveWebhooksByOrgMock).toHaveBeenCalledWith(
			"org-1",
			"user.updated",
		);
		expect(listActiveWebhooksByOrgMock).toHaveBeenCalledWith(
			"org-2",
			"user.updated",
		);
		expect(result.enqueued).toBe(2);
	});

	it("returns enqueued: 0 when the user belongs to no organizations", async () => {
		listOrganizationsForUserMock.mockResolvedValue([]);

		const result = await dispatchEvent({
			event: "user.updated",
			userId: "user-1",
			payload: {},
		});

		expect(result.enqueued).toBe(0);
		expect(recordDeliveryMock).not.toHaveBeenCalled();
	});

	it("returns enqueued: 0 when no webhooks match the event type", async () => {
		listActiveWebhooksByOrgMock.mockResolvedValue([]);

		const result = await dispatchEvent({
			event: "member.removed",
			organizationId: "org-1",
			payload: {},
		});

		expect(result.enqueued).toBe(0);
		expect(recordDeliveryMock).not.toHaveBeenCalled();
	});

	it("rejects when neither organizationId nor userId is provided", async () => {
		await expect(
			dispatchEvent({ event: "user.updated", payload: {} }),
		).rejects.toThrow();
	});

	it("rejects empty event", async () => {
		await expect(
			dispatchEvent({
				event: "" as "user.updated",
				organizationId: "org-1",
				payload: {},
			}),
		).rejects.toThrow();
	});

	it("rejects payloads larger than webhooksConfig.maxPayloadBytes", async () => {
		await expect(
			dispatchEvent({
				event: "user.updated",
				organizationId: "org-1",
				payload: { blob: "x".repeat(64 * 1024 + 1) },
			}),
		).rejects.toThrow(/payload/i);
		expect(recordDeliveryMock).not.toHaveBeenCalled();
	});

	it("accepts a payload at exactly maxPayloadBytes serialized", async () => {
		listActiveWebhooksByOrgMock.mockResolvedValue([]);
		// {"blob":"<N>x"} = N + 11 bytes serialized — N = 65525 hits exactly 64 KiB.
		const result = await dispatchEvent({
			event: "user.updated",
			organizationId: "org-1",
			payload: { blob: "x".repeat(64 * 1024 - 11) },
		});

		expect(result.enqueued).toBe(0);
	});

	it("rejects multi-byte payloads by UTF-8 byte size, not string length", async () => {
		// "€" is 1 code unit but 3 UTF-8 bytes: .length stays under 64 KiB
		// while the serialized payload exceeds it.
		await expect(
			dispatchEvent({
				event: "user.updated",
				organizationId: "org-1",
				payload: { blob: "€".repeat(21846) },
			}),
		).rejects.toThrow(/payload/i);
		expect(recordDeliveryMock).not.toHaveBeenCalled();
	});

	it("rejects non-JSON-serializable payloads instead of casting to JsonValue", async () => {
		await expect(
			dispatchEvent({
				event: "user.updated",
				organizationId: "org-1",
				payload: { big: BigInt(1) },
			}),
		).rejects.toThrow();

		const circular: Record<string, unknown> = {};
		circular.self = circular;
		await expect(
			dispatchEvent({
				event: "user.updated",
				organizationId: "org-1",
				payload: circular,
			}),
		).rejects.toThrow();
		expect(recordDeliveryMock).not.toHaveBeenCalled();
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

		const result = await dispatchEvent({
			event: "member.invited",
			organizationId: "org-1",
			payload: {},
		});

		expect(result.enqueued).toBe(2);
		expect(recordDeliveryMock).toHaveBeenCalledTimes(3);
	});
});

describe("dispatchEvent — config.features.webhooks", () => {
	beforeEach(() => {
		recordDeliveryMock.mockReset();
		listActiveWebhooksByOrgMock.mockReset();
		listOrganizationsForUserMock.mockReset();
		flags.webhooks = true;
	});

	it("dispatchEvent does nothing while webhooks is off", async () => {
		flags.webhooks = false;
		listActiveWebhooksByOrgMock.mockResolvedValue([{ id: "wh-1" }]);
		listOrganizationsForUserMock.mockResolvedValue([{ id: "org-1" }]);

		await expect(
			dispatchEvent({
				event: "organization.updated",
				organizationId: "org-1",
				payload: { organizationId: "org-1" },
			}),
		).resolves.toEqual({ enqueued: 0 });
		await expect(
			dispatchEvent({
				event: "user.updated",
				userId: "user-1",
				payload: { userId: "user-1" },
			}),
		).resolves.toEqual({ enqueued: 0 });

		expect(listActiveWebhooksByOrgMock).not.toHaveBeenCalled();
		expect(listOrganizationsForUserMock).not.toHaveBeenCalled();
		expect(recordDeliveryMock).not.toHaveBeenCalled();
	});

	it("isWebhooksEnabled follows the flag at call time", () => {
		expect(isWebhooksEnabled()).toBe(true);
		flags.webhooks = false;
		expect(isWebhooksEnabled()).toBe(false);
	});
});
