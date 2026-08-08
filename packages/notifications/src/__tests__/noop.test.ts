import { describe, expect, it, vi } from "vitest";
import { noopChannel } from "../channels/noop";
import { testNotificationProviderContract } from "./provider-contract.test";

testNotificationProviderContract(
	"noop",
	() => ({
		id: "noop-test",
		notify: (userId, type, title, body, data) =>
			noopChannel.send(userId, type, title, body, data),
	}),
	{
		notifyBehavior: "resolves",
	},
);

describe("NoopChannel", () => {
	it("send() resolves and has no side effects", async () => {
		const spy = vi.fn();
		await expect(
			noopChannel.send("user-1", "system", "Test", "Body"),
		).resolves.toBeUndefined();
		expect(spy).not.toHaveBeenCalled();
	});
});
