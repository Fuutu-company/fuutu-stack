import { describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/webhooks", () => ({
	processPendingDeliveries: vi.fn().mockResolvedValue({
		processed: 3,
		succeeded: 2,
		failed: 1,
	}),
}));

vi.mock("@fuutu/db", () => ({
	db: {
		auditLog: { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) },
		purchase: { findMany: vi.fn().mockResolvedValue([]) },
	},
}));

vi.mock("@fuutu/payments/config", () => ({
	LIMITS: {
		free: { auditLogDays: false },
		pro: { auditLogDays: 30 },
		enterprise: { auditLogDays: "unlimited" },
	},
}));

vi.mock("@fuutu/notifications", () => ({
	resolveNotificationProvider: vi.fn(() => ({
		id: "test",
		notify: vi.fn().mockResolvedValue(undefined),
	})),
}));

vi.mock("@fuutu/telemetry", () => ({
	pingTelemetry: vi.fn().mockResolvedValue({ sent: true, status: 200 }),
}));

import { listJobs, runAllJobs, runJob } from "../runner";

describe("runJob", () => {
	it("runs a known job and returns a result", async () => {
		const result = await runJob("webhook-retry");
		expect(result.success).toBe(true);
		expect(result.processed).toBe(3);
	});

	it("returns failure for unknown job name", async () => {
		const result = await runJob("nonexistent");
		expect(result.success).toBe(false);
		expect(result.errors).toContain('unknown job "nonexistent"');
	});
});

describe("runAllJobs", () => {
	it("runs all enabled jobs and returns results for each", async () => {
		const results = await runAllJobs();
		const jobNames = Object.keys(results);
		expect(jobNames).toContain("webhook-retry");
		expect(jobNames).toContain("audit-log-cleanup");
		expect(jobNames).toContain("subscription-reminder");
		expect(jobNames).toContain("telemetry-ping");
		for (const name of jobNames) {
			expect(results[name]).toHaveProperty("success");
			expect(results[name]).toHaveProperty("processed");
			expect(results[name]).toHaveProperty("errors");
		}
	});
});

describe("listJobs", () => {
	it("returns all registered jobs", () => {
		const jobs = listJobs();
		expect(jobs.length).toBe(4);
		expect(jobs.map((j) => j.name)).toEqual(
			expect.arrayContaining([
				"webhook-retry",
				"audit-log-cleanup",
				"subscription-reminder",
				"telemetry-ping",
			]),
		);
	});
});
