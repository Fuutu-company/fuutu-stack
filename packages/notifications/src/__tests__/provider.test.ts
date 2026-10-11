import { describe, expect, it, vi } from "vitest";

const { inAppSend, emailSend, noopSend, logError, logWarn } = vi.hoisted(
	() => ({
		inAppSend: vi.fn().mockResolvedValue(undefined),
		emailSend: vi.fn().mockResolvedValue(undefined),
		noopSend: vi.fn().mockResolvedValue(undefined),
		logError: vi.fn(),
		logWarn: vi.fn(),
	}),
);

vi.mock("../channels", () => ({
	inAppChannel: { channel: "in-app", send: inAppSend },
	emailChannel: { channel: "email", send: emailSend },
	noopChannel: { channel: "noop", send: noopSend },
}));

vi.mock("../config", () => ({
	notificationsConfig: { channels: ["in-app", "email"] },
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: logWarn,
		error: logError,
		debug: vi.fn(),
	}),
}));

import { resolveNotificationProvider } from "../provider";

describe("resolveNotificationProvider", () => {
	it("fans out a notification to every configured channel", async () => {
		inAppSend.mockClear();
		emailSend.mockClear();

		const provider = resolveNotificationProvider();
		await provider.notify("user-1", "billing", "Title", "Body", {
			key: "value",
		});

		expect(provider.id).toBe("multi-channel");
		expect(inAppSend).toHaveBeenCalledWith(
			"user-1",
			"billing",
			"Title",
			"Body",
			{ key: "value" },
			undefined,
		);
		expect(emailSend).toHaveBeenCalledWith(
			"user-1",
			"billing",
			"Title",
			"Body",
			{ key: "value" },
			undefined,
		);
	});

	it("rejects after attempting all channels when a channel fails", async () => {
		inAppSend.mockClear();
		emailSend.mockClear();
		logError.mockClear();
		emailSend.mockRejectedValueOnce(new Error("smtp down"));

		const provider = resolveNotificationProvider();
		await expect(provider.notify("user-1", "system", "T", "B")).rejects.toThrow(
			"email",
		);

		expect(inAppSend).toHaveBeenCalledTimes(1);
		expect(emailSend).toHaveBeenCalledTimes(1);
		expect(logError).toHaveBeenCalledWith(
			"channel delivery failed",
			expect.objectContaining({ channel: "email", userId: "user-1" }),
		);
	});

	it("aggregates failures from multiple channels into one rejection", async () => {
		inAppSend.mockClear();
		emailSend.mockClear();
		logError.mockClear();
		inAppSend.mockRejectedValueOnce(new Error("db down"));
		emailSend.mockRejectedValueOnce(new Error("smtp down"));

		const provider = resolveNotificationProvider();
		const failure = await provider
			.notify("user-1", "system", "T", "B")
			.catch((err: unknown) => err);

		expect(failure).toBeInstanceOf(AggregateError);
		expect((failure as AggregateError).message).toContain("in-app");
		expect((failure as AggregateError).message).toContain("email");
		expect((failure as AggregateError).errors).toHaveLength(2);
		expect(logError).toHaveBeenCalledTimes(2);
	});

	it("resolves when no channels are configured", async () => {
		vi.doMock("../config", () => ({
			notificationsConfig: { channels: [] },
		}));
		vi.resetModules();
		const { resolveNotificationProvider: resolve } = await import(
			"../provider"
		);
		const provider = resolve();
		await expect(
			provider.notify("user-1", "system", "T", "B"),
		).resolves.toBeUndefined();
		vi.resetModules();
	});
});
