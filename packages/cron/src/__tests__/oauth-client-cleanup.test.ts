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
	deleteStaleUnownedOAuthClients: vi.fn(),
}));

const { deleteStaleUnownedOAuthClients } = await import("@fuutu/db");
const { oauthClientCleanupJob } = await import("../jobs/oauth-client-cleanup");
const { allJobs } = await import("../jobs");
const { cronConfig } = await import("../config");

const DAY_MS = 24 * 60 * 60 * 1000;

describe("oauthClientCleanupJob", () => {
	beforeEach(() => {
		vi.mocked(deleteStaleUnownedOAuthClients).mockReset();
	});

	it("deletes unused owner-less clients registered more than 7 days ago", async () => {
		vi.mocked(deleteStaleUnownedOAuthClients).mockResolvedValue({ count: 3 });
		const before = Date.now();

		const result = await oauthClientCleanupJob.run();

		const after = Date.now();
		expect(result).toEqual({ success: true, processed: 3, errors: [] });
		const cutoff = vi.mocked(deleteStaleUnownedOAuthClients).mock
			.calls[0]?.[0] as Date;
		expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 7 * DAY_MS);
		expect(cutoff.getTime()).toBeLessThanOrEqual(after - 7 * DAY_MS);
	});

	it("reports a failure instead of throwing", async () => {
		vi.mocked(deleteStaleUnownedOAuthClients).mockRejectedValue(
			new Error("db down"),
		);
		expect(await oauthClientCleanupJob.run()).toEqual({
			success: false,
			processed: 0,
			errors: ["db down"],
		});
	});

	it("is registered, runs daily and follows its config flag", () => {
		expect(allJobs).toContain(oauthClientCleanupJob);
		expect(oauthClientCleanupJob.schedule).toBe("30 3 * * *");
		expect(oauthClientCleanupJob.enabled).toBe(true);
		cronConfig.jobs.oauthClientCleanup = false;
		expect(oauthClientCleanupJob.enabled).toBe(false);
		cronConfig.jobs.oauthClientCleanup = true;
	});
});
