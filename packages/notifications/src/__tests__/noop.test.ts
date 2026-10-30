import { describe, expect, it } from "vitest";
import { noopChannel } from "../channels/noop";
import { testNotificationProviderContract } from "./provider-contract";

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
		expect(noopChannel.channel).toBe("noop");
		await expect(
			noopChannel.send("user-1", "system", "Test", "Body"),
		).resolves.toBeUndefined();
	});
});
