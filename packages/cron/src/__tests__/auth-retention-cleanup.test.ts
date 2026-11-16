import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

vi.mock("@fuutu/db", () => ({
	deleteSessionsExpiredBefore: vi.fn(),
	deleteExpiredVerifications: vi.fn(),
	deleteRateLimitsBefore: vi.fn(),
}));

const {
	deleteSessionsExpiredBefore,
	deleteExpiredVerifications,
	deleteRateLimitsBefore,
} = await import("@fuutu/db");
const { authRetentionCleanupJob } = await import(
	"../jobs/auth-retention-cleanup"
);
const { allJobs } = await import("../jobs");
const { cronConfig } = await import("../config");

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe("authRetentionCleanupJob", () => {
	beforeEach(() => {
		vi.mocked(deleteSessionsExpiredBefore).mockReset();
		vi.mocked(deleteExpiredVerifications).mockReset();
		vi.mocked(deleteRateLimitsBefore).mockReset();
		vi.mocked(deleteSessionsExpiredBefore).mockResolvedValue({ count: 0 });
		vi.mocked(deleteExpiredVerifications).mockResolvedValue({ count: 0 });
		vi.mocked(deleteRateLimitsBefore).mockResolvedValue({ count: 0 });
	});

	it("deletes sessions expired >7 days ago, expired verifications and rate limits >24h old", async () => {
		vi.mocked(deleteSessionsExpiredBefore).mockResolvedValue({ count: 3 });
		vi.mocked(deleteExpiredVerifications).mockResolvedValue({ count: 2 });
		vi.mocked(deleteRateLimitsBefore).mockResolvedValue({ count: 5 });
		const before = Date.now();

		const result = await authRetentionCleanupJob.run();

		const after = Date.now();
		expect(result).toEqual({ success: true, processed: 10, errors: [] });
		const sessionCutoff = vi.mocked(deleteSessionsExpiredBefore).mock
			.calls[0]?.[0] as Date;
		expect(sessionCutoff.getTime()).toBeGreaterThanOrEqual(before - 7 * DAY_MS);
		expect(sessionCutoff.getTime()).toBeLessThanOrEqual(after - 7 * DAY_MS);
		const verificationNow = vi.mocked(deleteExpiredVerifications).mock
			.calls[0]?.[0] as Date;
		expect(verificationNow.getTime()).toBeGreaterThanOrEqual(before);
		expect(verificationNow.getTime()).toBeLessThanOrEqual(after);
		const rateCutoff = vi.mocked(deleteRateLimitsBefore).mock
			.calls[0]?.[0] as Date;
		expect(rateCutoff.getTime()).toBeGreaterThanOrEqual(before - 24 * HOUR_MS);
		expect(rateCutoff.getTime()).toBeLessThanOrEqual(after - 24 * HOUR_MS);
	});

	it("reports a failure instead of throwing", async () => {
		vi.mocked(deleteSessionsExpiredBefore).mockRejectedValue(
			new Error("db down"),
		);
		expect(await authRetentionCleanupJob.run()).toEqual({
			success: false,
			processed: 0,
			errors: ["db down"],
		});
	});

	it("is registered, runs daily and follows its config flag", () => {
		expect(allJobs).toContain(authRetentionCleanupJob);
		expect(authRetentionCleanupJob.schedule).toBe("45 3 * * *");
		expect(authRetentionCleanupJob.enabled).toBe(true);
		cronConfig.jobs.authRetentionCleanup = false;
		expect(authRetentionCleanupJob.enabled).toBe(false);
		cronConfig.jobs.authRetentionCleanup = true;
	});
});
