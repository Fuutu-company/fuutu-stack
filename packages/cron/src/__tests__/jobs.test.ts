import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

vi.mock("@fuutu/webhooks", () => ({
	processPendingDeliveries: vi.fn(),
}));

vi.mock("@fuutu/db", () => ({
	deleteAuditLogsBefore: vi.fn(),
	getTrialingSubscriptions: vi.fn(),
	notificationExists: vi.fn().mockResolvedValue(false),
}));

vi.mock("@fuutu/i18n", () => ({
	getMessagesForLocale: vi.fn().mockResolvedValue({
		cron: {
			subscriptionReminder: {
				title: "Subscription reminder",
				body: "Your trial subscription is ending soon.",
			},
		},
	}),
}));

vi.mock("@fuutu/payments/config", () => ({
	LIMITS: {
		free: { auditLogDays: false },
		pro: { auditLogDays: 30 },
		enterprise: { auditLogDays: "unlimited" },
	},
}));

vi.mock("@fuutu/notifications", () => ({
	resolveNotificationProvider: () => ({
		id: "test",
		notify: vi.fn(),
	}),
}));

vi.mock("@fuutu/telemetry", () => ({
	pingTelemetry: vi.fn(),
}));

import {
	deleteAuditLogsBefore,
	getTrialingSubscriptions,
	notificationExists,
} from "@fuutu/db";
import { getMessagesForLocale } from "@fuutu/i18n";
import { pingTelemetry } from "@fuutu/telemetry";
import { processPendingDeliveries } from "@fuutu/webhooks";
import { auditLogCleanupJob } from "../jobs/audit-log-cleanup";
import { subscriptionReminderJob } from "../jobs/subscription-reminder";
import { telemetryPingJob } from "../jobs/telemetry-ping";
import { webhookRetryJob } from "../jobs/webhook-retry";

describe("webhookRetryJob", () => {
	beforeEach(() => {
		vi.mocked(processPendingDeliveries).mockReset();
	});

	it("returns success with processed count", async () => {
		vi.mocked(processPendingDeliveries).mockResolvedValue({
			processed: 5,
			succeeded: 4,
			failed: 1,
		});
		const result = await webhookRetryJob.run();
		expect(result.success).toBe(true);
		expect(result.processed).toBe(5);
		expect(result.errors).toEqual([]);
	});

	it("returns failure on error", async () => {
		vi.mocked(processPendingDeliveries).mockRejectedValue(new Error("db down"));
		const result = await webhookRetryJob.run();
		expect(result.success).toBe(false);
		expect(result.errors).toContain("db down");
	});
});

describe("auditLogCleanupJob", () => {
	beforeEach(() => {
		vi.mocked(deleteAuditLogsBefore).mockReset();
	});

	it("deletes old audit logs and returns count", async () => {
		vi.mocked(deleteAuditLogsBefore).mockResolvedValue({ count: 42 });
		const result = await auditLogCleanupJob.run();
		expect(result.success).toBe(true);
		expect(result.processed).toBe(42);
		expect(deleteAuditLogsBefore).toHaveBeenCalledTimes(1);
	});

	it("returns failure on error", async () => {
		vi.mocked(deleteAuditLogsBefore).mockRejectedValue(
			new Error("permission denied"),
		);
		const result = await auditLogCleanupJob.run();
		expect(result.success).toBe(false);
		expect(result.errors).toContain("permission denied");
	});
});

describe("subscriptionReminderJob", () => {
	beforeEach(() => {
		vi.mocked(getTrialingSubscriptions).mockReset();
		vi.mocked(notificationExists).mockReset();
		vi.mocked(notificationExists).mockResolvedValue(false);
		vi.mocked(getMessagesForLocale).mockClear();
	});

	it("sends notifications for trialing subscriptions", async () => {
		vi.mocked(getTrialingSubscriptions).mockResolvedValue([
			{
				id: "p1",
				userId: "u1",
				subscriptionId: "sub-1",
				user: { locale: "en" },
			},
			{
				id: "p2",
				userId: "u2",
				subscriptionId: "sub-2",
				user: { locale: "en" },
			},
		] as never);

		const result = await subscriptionReminderJob.run();
		expect(result.success).toBe(true);
		expect(result.processed).toBe(2);
	});

	it("skips purchases without userId", async () => {
		vi.mocked(getTrialingSubscriptions).mockResolvedValue([
			{ id: "p1", userId: null, subscriptionId: "sub-1", user: null },
		] as never);
		const result = await subscriptionReminderJob.run();
		expect(result.processed).toBe(0);
	});

	it("skips purchases that already have a reminder notification today (idempotency)", async () => {
		vi.mocked(getTrialingSubscriptions).mockResolvedValue([
			{
				id: "p1",
				userId: "u1",
				subscriptionId: "sub-1",
				user: { locale: "en" },
			},
		] as never);
		vi.mocked(notificationExists).mockResolvedValue(true);

		const result = await subscriptionReminderJob.run();
		expect(result.processed).toBe(0);
		expect(notificationExists).toHaveBeenCalledTimes(1);
	});

	it("loads messages for each user's locale", async () => {
		vi.mocked(getTrialingSubscriptions).mockResolvedValue([
			{
				id: "p1",
				userId: "u1",
				subscriptionId: "sub-1",
				user: { locale: "de" },
			},
			{
				id: "p2",
				userId: "u2",
				subscriptionId: "sub-2",
				user: { locale: "en" },
			},
		] as never);

		await subscriptionReminderJob.run();

		expect(getMessagesForLocale).toHaveBeenCalledWith("de");
		expect(getMessagesForLocale).toHaveBeenCalledWith("en");
	});

	it("falls back to en when user locale is null", async () => {
		vi.mocked(getTrialingSubscriptions).mockResolvedValue([
			{
				id: "p1",
				userId: "u1",
				subscriptionId: "sub-1",
				user: { locale: null },
			},
		] as never);

		await subscriptionReminderJob.run();

		expect(getMessagesForLocale).toHaveBeenCalledWith("en");
	});
});

describe("telemetryPingJob", () => {
	beforeEach(() => {
		vi.mocked(pingTelemetry).mockReset();
	});

	it("returns success when telemetry is sent", async () => {
		vi.mocked(pingTelemetry).mockResolvedValue({ sent: true, status: 200 });
		const result = await telemetryPingJob.run();
		expect(result.success).toBe(true);
		expect(result.processed).toBe(1);
	});

	it("returns failure when telemetry is not sent", async () => {
		vi.mocked(pingTelemetry).mockResolvedValue({
			sent: false,
			reason: "disabled",
		});
		const result = await telemetryPingJob.run();
		expect(result.success).toBe(false);
		expect(result.processed).toBe(0);
		expect(result.errors).toContain("telemetry not sent: disabled");
	});
});
