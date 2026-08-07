import { describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	createNotification: vi.fn().mockResolvedValue(undefined),
}));

import { createNotification } from "@fuutu/db";
import { inAppChannel } from "../channels/in-app";
import { testNotificationProviderContract } from "./provider-contract.test";

testNotificationProviderContract(
	"in-app",
	() => ({
		id: "in-app-test",
		notify: (userId, type, title, body, data) =>
			inAppChannel.send(userId, type, title, body, data),
	}),
	{
		notifyBehavior: "resolves",
	},
);

describe("InAppChannel", () => {
	it("calls createNotification with the correct payload", async () => {
		await inAppChannel.send(
			"user-1",
			"billing",
			"Invoice ready",
			"Your invoice is ready",
			{ invoiceId: "inv-1" },
		);

		expect(createNotification).toHaveBeenCalledWith({
			id: undefined,
			userId: "user-1",
			type: "billing",
			title: "Invoice ready",
			body: "Your invoice is ready",
			data: { invoiceId: "inv-1" },
		});
	});

	it("passes null data when no data is provided", async () => {
		await inAppChannel.send("user-2", "system", "Hello", "World");

		expect(createNotification).toHaveBeenCalledWith({
			id: undefined,
			userId: "user-2",
			type: "system",
			title: "Hello",
			body: "World",
			data: undefined,
		});
	});

	it("passes deterministic id via options", async () => {
		await inAppChannel.send(
			"user-3",
			"billing",
			"Reminder",
			"Body",
			{ subscriptionId: "sub-1" },
			{ id: "p1-2025-01-15" },
		);

		expect(createNotification).toHaveBeenCalledWith({
			id: "p1-2025-01-15",
			userId: "user-3",
			type: "billing",
			title: "Reminder",
			body: "Body",
			data: { subscriptionId: "sub-1" },
		});
	});
});
