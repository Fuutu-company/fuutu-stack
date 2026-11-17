import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

const mockReconcile = vi.fn();
vi.mock("@fuutu/payments", () => ({
	reconcileOrganizationSeats: mockReconcile,
}));

vi.mock("@fuutu/payments/config", () => ({
	LIMITS: {},
	paymentsConfig: { seatSync: "members" },
}));

const { seatReconcileJob } = await import("../jobs/seat-reconcile");
const { allJobs } = await import("../jobs");
const { cronConfig } = await import("../config");

describe("seatReconcileJob", () => {
	beforeEach(() => {
		mockReconcile.mockReset();
	});

	it("re-syncs seats and reports how many it fixed", async () => {
		mockReconcile.mockResolvedValue({ checked: 4, synced: 2, failed: 0 });

		expect(await seatReconcileJob.run()).toEqual({
			success: true,
			processed: 2,
			errors: [],
		});
	});

	it("fails the run when an organization could not be synced", async () => {
		mockReconcile.mockResolvedValue({ checked: 3, synced: 1, failed: 2 });

		expect(await seatReconcileJob.run()).toEqual({
			success: false,
			processed: 1,
			errors: ["2 organization seat sync(s) failed"],
		});
	});

	it("reports a failure instead of throwing", async () => {
		mockReconcile.mockRejectedValue(new Error("db down"));

		expect(await seatReconcileJob.run()).toEqual({
			success: false,
			processed: 0,
			errors: ["db down"],
		});
	});

	it("is registered, runs daily and follows its config flag", () => {
		expect(allJobs).toContain(seatReconcileJob);
		expect(seatReconcileJob.schedule).toBe("15 4 * * *");
		expect(seatReconcileJob.enabled).toBe(true);
		cronConfig.jobs.seatReconcile = false;
		expect(seatReconcileJob.enabled).toBe(false);
		cronConfig.jobs.seatReconcile = true;
	});
});
