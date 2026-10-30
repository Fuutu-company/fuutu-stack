import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLog = vi.hoisted(() => ({
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => mockLog,
}));

vi.mock("@fuutu/webhooks", () => ({
	processPendingDeliveries: vi.fn(),
}));

vi.mock("@fuutu/db", () => ({
	deleteAuditLogsBefore: vi.fn(),
	getTrialingSubscriptions: vi.fn(),
	isUniqueViolation: (err: unknown) =>
		err instanceof Error && "code" in err && err.code === "P2002",
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

const mockLimits = vi.hoisted(() => ({
	free: { auditLogDays: false as number | false | "unlimited" },
	pro: { auditLogDays: 30 as number | false | "unlimited" },
	enterprise: { auditLogDays: "unlimited" as number | false | "unlimited" },
}));

const mockNotify = vi.hoisted(() => vi.fn());

vi.mock("@fuutu/payments/config", () => ({
	LIMITS: mockLimits,
}));

vi.mock("@fuutu/notifications", () => ({
	resolveNotificationProvider: () => ({
		id: "test",
		notify: mockNotify,
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
		mockLimits.free.auditLogDays = false;
		mockLimits.pro.auditLogDays = 30;
		mockLimits.enterprise.auditLogDays = "unlimited";
	});

	it("does not delete anything when any plan advertises unlimited retention", async () => {
		// audit_log rows are not tenant-scoped, so per-plan retention cannot
		// be applied — deleting at a finite cutoff would break the
		// "unlimited" plan's promise.
		const result = await auditLogCleanupJob.run();
		expect(result.success).toBe(true);
		expect(result.processed).toBe(0);
		expect(result.skipped).toBe(true);
		expect(deleteAuditLogsBefore).not.toHaveBeenCalled();
	});

	it("deletes logs older than the max finite retention when no plan is unlimited", async () => {
		mockLimits.enterprise.auditLogDays = 90;
		vi.mocked(deleteAuditLogsBefore).mockResolvedValue({ count: 42 });
		const before = Date.now();
		const result = await auditLogCleanupJob.run();
		const after = Date.now();
		expect(result.success).toBe(true);
		expect(result.processed).toBe(42);
		expect(deleteAuditLogsBefore).toHaveBeenCalledTimes(1);
		const cutoff = vi.mocked(deleteAuditLogsBefore).mock.calls[0]?.[0];
		if (!(cutoff instanceof Date)) {
			throw new Error("expected deleteAuditLogsBefore to receive a Date");
		}
		const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
		expect(cutoff.getTime()).toBeGreaterThanOrEqual(
			before - ninetyDaysMs - 1_000,
		);
		expect(cutoff.getTime()).toBeLessThanOrEqual(after - ninetyDaysMs);
	});

	it("does nothing when all plans have auditLogDays false", async () => {
		// `false` means "feature disabled on this plan", not "zero-day
		// retention" — no plan promises audit logs, but nothing mandates
		// purging existing rows either, so the job skips (fail-safe).
		mockLimits.pro.auditLogDays = false;
		mockLimits.enterprise.auditLogDays = false;
		const result = await auditLogCleanupJob.run();
		expect(result.success).toBe(true);
		expect(result.processed).toBe(0);
		expect(result.skipped).toBe(true);
		expect(deleteAuditLogsBefore).not.toHaveBeenCalled();
	});

	it("returns failure on error", async () => {
		mockLimits.enterprise.auditLogDays = 90;
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
		mockNotify.mockReset();
		mockNotify.mockResolvedValue(undefined);
		mockLog.warn.mockClear();
	});

	it("requests only trials ending within the reminder window", async () => {
		vi.mocked(getTrialingSubscriptions).mockResolvedValue([]);
		const before = Date.now();
		await subscriptionReminderJob.run();
		const after = Date.now();
		expect(getTrialingSubscriptions).toHaveBeenCalledTimes(1);
		const [now, windowEnd] =
			vi.mocked(getTrialingSubscriptions).mock.calls[0] ?? [];
		if (!(now instanceof Date) || !(windowEnd instanceof Date)) {
			throw new Error("expected getTrialingSubscriptions to receive Dates");
		}
		// "Your trial subscription is ending soon" → 3-day lead window.
		expect(windowEnd.getTime() - now.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
		expect(now.getTime()).toBeGreaterThanOrEqual(before);
		expect(now.getTime()).toBeLessThanOrEqual(after);
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

	it("skips purchases with neither userId nor organizationId", async () => {
		vi.mocked(getTrialingSubscriptions).mockResolvedValue([
			{
				id: "p1",
				userId: null,
				organizationId: null,
				subscriptionId: "sub-1",
				user: null,
				organization: null,
			},
		] as never);
		const result = await subscriptionReminderJob.run();
		expect(result.processed).toBe(0);
		expect(mockNotify).not.toHaveBeenCalled();
	});

	it("notifies org owners for organization-owned trialing subscriptions", async () => {
		vi.mocked(getTrialingSubscriptions).mockResolvedValue([
			{
				id: "p1",
				userId: null,
				organizationId: "org-1",
				subscriptionId: "sub-1",
				user: null,
				organization: {
					members: [
						{ role: "owner", user: { id: "ou1", locale: "en" } },
						{ role: "owner", user: { id: "ou2", locale: "de" } },
					],
				},
			},
		] as never);
		const result = await subscriptionReminderJob.run();
		expect(result.success).toBe(true);
		expect(result.processed).toBe(2);
		expect(mockNotify).toHaveBeenCalledWith(
			"ou1",
			"billing",
			expect.any(String),
			expect.any(String),
			expect.anything(),
			{ id: expect.stringContaining("p1-ou1-") },
		);
		expect(mockNotify).toHaveBeenCalledWith(
			"ou2",
			"billing",
			expect.any(String),
			expect.any(String),
			expect.anything(),
			{ id: expect.stringContaining("p1-ou2-") },
		);
		// Each owner receives the reminder in their own locale.
		expect(getMessagesForLocale).toHaveBeenCalledWith("en");
		expect(getMessagesForLocale).toHaveBeenCalledWith("de");
	});

	it("notifies only members whose comma-separated roles exactly include 'owner'", async () => {
		// member.role is a comma-separated Better-Auth role string —
		// a substring match would wrongly include "co-owner".
		vi.mocked(getTrialingSubscriptions).mockResolvedValue([
			{
				id: "p1",
				userId: null,
				organizationId: "org-1",
				subscriptionId: "sub-1",
				user: null,
				organization: {
					members: [
						{ role: "co-owner", user: { id: "m-co", locale: "en" } },
						{ role: "member", user: { id: "m-mem", locale: "en" } },
						{ role: "admin", user: { id: "m-adm", locale: "en" } },
						{ role: "owner", user: { id: "m-own", locale: "en" } },
						{ role: "admin,owner", user: { id: "m-aown", locale: "en" } },
					],
				},
			},
		] as never);
		const result = await subscriptionReminderJob.run();
		expect(result.success).toBe(true);
		expect(result.processed).toBe(2);
		expect(mockNotify).toHaveBeenCalledTimes(2);
		expect(mockNotify).toHaveBeenCalledWith(
			"m-own",
			"billing",
			expect.any(String),
			expect.any(String),
			expect.anything(),
			expect.anything(),
		);
		expect(mockNotify).toHaveBeenCalledWith(
			"m-aown",
			"billing",
			expect.any(String),
			expect.any(String),
			expect.anything(),
			expect.anything(),
		);
	});

	it("logs a warning when an org-owned purchase has no owner members", async () => {
		vi.mocked(getTrialingSubscriptions).mockResolvedValue([
			{
				id: "p1",
				userId: null,
				organizationId: "org-1",
				subscriptionId: "sub-1",
				user: null,
				organization: {
					members: [{ role: "member", user: { id: "m1", locale: "en" } }],
				},
			},
		] as never);
		const result = await subscriptionReminderJob.run();
		expect(result.success).toBe(true);
		expect(result.processed).toBe(0);
		expect(mockNotify).not.toHaveBeenCalled();
		expect(mockLog.warn).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ purchaseId: "p1" }),
		);
	});

	it("treats a notification created by a concurrent run as already sent", async () => {
		vi.mocked(getTrialingSubscriptions).mockResolvedValue([
			{
				id: "p1",
				userId: "u1",
				organizationId: null,
				subscriptionId: "sub-1",
				user: { locale: "en" },
				organization: null,
			},
		] as never);
		// Concurrent runner won: its row landed between our pre-check and
		// our send, so our in-app insert hits a unique violation on the
		// deterministic ID (surfaced through the provider's AggregateError).
		const uniqueViolation = Object.assign(
			new Error("Unique constraint failed on the fields: (`id`)"),
			{ code: "P2002" },
		);
		mockNotify.mockRejectedValue(
			new AggregateError(
				[uniqueViolation],
				"notification delivery failed on channel(s): in-app",
			),
		);
		const result = await subscriptionReminderJob.run();
		expect(result.success).toBe(true);
		expect(result.processed).toBe(0);
		expect(result.errors).toEqual([]);
	});

	it("records an error when our own send fails after creating the in-app row", async () => {
		vi.mocked(getTrialingSubscriptions).mockResolvedValue([
			{
				id: "p1",
				userId: "u1",
				subscriptionId: "sub-1",
				user: { locale: "en" },
			},
		] as never);
		// Our provider created the in-app row, then the email channel
		// rejected. A post-failure existence check sees OUR row, so the
		// job must distinguish on the error, not on row existence.
		mockNotify.mockRejectedValue(
			new AggregateError(
				[new Error("plunk api error")],
				"notification delivery failed on channel(s): email",
			),
		);
		// Pre-check: nothing sent yet. After our failed send the in-app
		// row WE created exists — must not be mistaken for a lost race.
		vi.mocked(notificationExists)
			.mockResolvedValueOnce(false)
			.mockResolvedValue(true);
		const result = await subscriptionReminderJob.run();
		expect(result.success).toBe(false);
		expect(result.processed).toBe(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain("plunk api error");
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

	it("records a skip (not an error) when telemetry is disabled via opt-out", async () => {
		vi.mocked(pingTelemetry).mockResolvedValue({
			sent: false,
			reason: "disabled",
		});
		const result = await telemetryPingJob.run();
		expect(result.success).toBe(true);
		expect(result.processed).toBe(0);
		expect(result.skipped).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("returns failure when the ping fails (e.g. network error)", async () => {
		vi.mocked(pingTelemetry).mockResolvedValue({
			sent: false,
			reason: "network error",
		});
		const result = await telemetryPingJob.run();
		expect(result.success).toBe(false);
		expect(result.processed).toBe(0);
		expect(result.errors).toContain("telemetry not sent: network error");
	});
});
