import { describe, expect, it, vi } from "vitest";

import {
	consoleAuditSink,
	createAuditLogger,
	getAuditSink,
	setAuditSink,
} from "../audit";
import type { AuditEvent, AuditSink } from "../types";

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
		setAuditSink(consoleAuditSink);
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
		setAuditSink(consoleAuditSink);
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
