import { afterEach, describe, expect, it, vi } from "vitest";

import {
	consoleAuditSink,
	createAuditLogger,
	getAuditSink,
	setAuditSink,
} from "../audit";
import type { AuditEvent, AuditSink } from "../types";

// Restore the default sink after every test — tests that swap it must not
// leak into each other.
afterEach(() => {
	setAuditSink(consoleAuditSink);
});

describe("consoleAuditSink", () => {
	it("records an event via console.info", async () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const event: AuditEvent = {
			action: "auth.sign_in",
			userId: "u1",
			ip: "127.0.0.1",
		};
		await consoleAuditSink.record(event);
		expect(infoSpy).toHaveBeenCalledWith(
			"[audit]",
			"auth.sign_in",
			expect.objectContaining({
				userId: "u1",
				ip: "127.0.0.1",
			}),
		);
		infoSpy.mockRestore();
	});

	it("handles null userId and missing metadata", async () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		await consoleAuditSink.record({ action: "anon.ping" });
		expect(infoSpy).toHaveBeenCalledWith(
			"[audit]",
			"anon.ping",
			expect.objectContaining({
				userId: null,
				ip: null,
			}),
		);
		infoSpy.mockRestore();
	});

	it("filters sensitive metadata keys from the console output", async () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		await consoleAuditSink.record({
			action: "auth.sign_in",
			metadata: {
				method: "password",
				apiKey: "sk_live_123",
				sessionId: "sess_1",
				cookie: "c=1",
			},
		});
		const mirror = infoSpy.mock.calls[0]?.[2] as Record<string, unknown>;
		const metadata = mirror.metadata as Record<string, unknown>;
		expect(metadata.method).toBe("password");
		expect(metadata).not.toHaveProperty("apiKey");
		expect(metadata).not.toHaveProperty("sessionId");
		expect(metadata).not.toHaveProperty("cookie");
		infoSpy.mockRestore();
	});
});

describe("createAuditLogger", () => {
	it("returns an AuditLogger with a record method", () => {
		const audit = createAuditLogger({ scope: "auth" });
		expect(typeof audit.record).toBe("function");
	});

	it("persists via active sink and mirrors to console", async () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const mockSink: AuditSink = {
			record: vi.fn().mockResolvedValue(undefined),
		};
		setAuditSink(mockSink);

		const audit = createAuditLogger({ scope: "auth" });
		await audit.record({
			action: "auth.sign_in",
			userId: "u123",
			ip: "1.2.3.4",
			metadata: { method: "password" },
		});

		// Sink was called
		expect(mockSink.record).toHaveBeenCalledWith({
			action: "auth.sign_in",
			userId: "u123",
			ip: "1.2.3.4",
			metadata: { method: "password" },
		});

		// console.info mirror was called
		expect(infoSpy).toHaveBeenCalledWith(
			"[auth] audit: auth.sign_in",
			expect.objectContaining({
				userId: "u123",
				ip: "1.2.3.4",
				method: "password",
			}),
		);

		infoSpy.mockRestore();
	});

	it("surfaces sink failures as error logs (never throws)", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const failingSink: AuditSink = {
			record: vi.fn().mockRejectedValue(new Error("DB down")),
		};
		setAuditSink(failingSink);

		const audit = createAuditLogger({ scope: "auth" });
		await expect(
			audit.record({ action: "test.action", userId: "u1" }),
		).resolves.toBeUndefined();

		expect(errorSpy).toHaveBeenCalledWith(
			"[auth] audit sink failure",
			expect.objectContaining({
				action: "test.action",
				error: "DB down",
			}),
		);

		errorSpy.mockRestore();
	});

	it("still resolves when both the sink and the evlog reporting throw", async () => {
		const { log: evlogLog } = await import("evlog");
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const evlogSpy = vi.spyOn(evlogLog, "error").mockImplementation(() => {
			throw new Error("evlog broken");
		});
		const failingSink: AuditSink = {
			record: vi.fn().mockRejectedValue(new Error("DB down")),
		};
		setAuditSink(failingSink);

		const audit = createAuditLogger({ scope: "auth" });
		// The never-throw contract holds even when the reporting path breaks.
		await expect(
			audit.record({ action: "test.action", userId: "u1" }),
		).resolves.toBeUndefined();

		// console.error is the fallback for the drains-broken case — it must
		// still run when evlog itself throws.
		expect(errorSpy).toHaveBeenCalledWith(
			"[auth] audit sink failure",
			expect.objectContaining({ action: "test.action", error: "DB down" }),
		);

		evlogSpy.mockRestore();
		errorSpy.mockRestore();
		infoSpy.mockRestore();
	});

	it("still resolves when console.error also throws", async () => {
		const { log: evlogLog } = await import("evlog");
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			throw new Error("console broken");
		});
		const evlogSpy = vi.spyOn(evlogLog, "error").mockImplementation(() => {
			throw new Error("evlog broken");
		});
		const failingSink: AuditSink = {
			record: vi.fn().mockRejectedValue(new Error("DB down")),
		};
		setAuditSink(failingSink);

		const audit = createAuditLogger({ scope: "auth" });
		await expect(
			audit.record({ action: "test.action", userId: "u1" }),
		).resolves.toBeUndefined();

		evlogSpy.mockRestore();
		errorSpy.mockRestore();
		infoSpy.mockRestore();
	});

	it("also reports sink failures through evlog so drains see them", async () => {
		const { log: evlogLog } = await import("evlog");
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const evlogSpy = vi.spyOn(evlogLog, "error").mockImplementation(() => {});
		const failingSink: AuditSink = {
			record: vi.fn().mockRejectedValue(new Error("DB down")),
		};
		setAuditSink(failingSink);

		const audit = createAuditLogger({ scope: "auth" });
		await audit.record({ action: "test.action", userId: "u1" });

		expect(evlogSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				tag: "auth",
				action: "test.action",
				error: "DB down",
			}),
		);
		expect(errorSpy).toHaveBeenCalled();

		evlogSpy.mockRestore();
		errorSpy.mockRestore();
	});

	it("lets canonical fields win over colliding metadata keys", async () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const mockSink: AuditSink = {
			record: vi.fn().mockResolvedValue(undefined),
		};
		setAuditSink(mockSink);

		const audit = createAuditLogger({ scope: "auth" });
		await audit.record({
			action: "auth.sign_in",
			userId: "u123",
			metadata: { userId: "spoofed", ip: "9.9.9.9" },
		});

		expect(infoSpy).toHaveBeenCalledWith(
			"[auth] audit: auth.sign_in",
			expect.objectContaining({ userId: "u123", ip: null }),
		);

		infoSpy.mockRestore();
	});

	it("drops obviously sensitive metadata keys from the console mirror", async () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const mockSink: AuditSink = {
			record: vi.fn().mockResolvedValue(undefined),
		};
		setAuditSink(mockSink);

		const audit = createAuditLogger({ scope: "auth" });
		await audit.record({
			action: "auth.sign_in",
			userId: "u1",
			metadata: { method: "password", resetToken: "secret-value" },
		});

		const mirror = infoSpy.mock.calls.find(([msg]) =>
			String(msg).includes("audit:"),
		)?.[1] as Record<string, unknown>;
		expect(mirror.method).toBe("password");
		expect(mirror).not.toHaveProperty("resetToken");

		// The sink row keeps the full event.
		expect(mockSink.record).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: { method: "password", resetToken: "secret-value" },
			}),
		);

		infoSpy.mockRestore();
	});

	it("drops api-key/session/cookie/private metadata keys from the console mirror", async () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const mockSink: AuditSink = {
			record: vi.fn().mockResolvedValue(undefined),
		};
		setAuditSink(mockSink);

		const audit = createAuditLogger({ scope: "auth" });
		await audit.record({
			action: "auth.sign_in",
			userId: "u1",
			metadata: {
				method: "oauth",
				api_key: "k1",
				apiKey: "k2",
				credential: "c",
				sessionToken: "s",
				cookie: "c=1",
				privateKey: "p",
			},
		});

		const mirror = infoSpy.mock.calls.find(([msg]) =>
			String(msg).includes("audit:"),
		)?.[1] as Record<string, unknown>;
		expect(mirror.method).toBe("oauth");
		for (const key of [
			"api_key",
			"apiKey",
			"credential",
			"sessionToken",
			"cookie",
			"privateKey",
		]) {
			expect(mirror).not.toHaveProperty(key);
		}

		infoSpy.mockRestore();
	});
});

describe("setAuditSink / getAuditSink", () => {
	it("swaps the active sink", () => {
		const original = getAuditSink();
		const custom: AuditSink = { record: vi.fn() };
		setAuditSink(custom);
		expect(getAuditSink()).toBe(custom);
		setAuditSink(original);
	});
});
