import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => ({
	db: {
		session: { deleteMany: vi.fn() },
		verification: { deleteMany: vi.fn() },
		rateLimit: { deleteMany: vi.fn() },
	},
}));

import { db } from "../../prisma/client";
import {
	deleteExpiredVerifications,
	deleteRateLimitsBefore,
	deleteSessionsExpiredBefore,
} from "../../prisma/queries/auth-retention";

describe("auth retention queries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("deleteSessionsExpiredBefore removes sessions whose expiresAt is before the cutoff", async () => {
		vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 2 });
		const cutoff = new Date("2026-01-01T00:00:00Z");
		expect(await deleteSessionsExpiredBefore(cutoff)).toEqual({ count: 2 });
		expect(db.session.deleteMany).toHaveBeenCalledWith({
			where: { expiresAt: { lt: cutoff } },
		});
	});

	it("deleteExpiredVerifications removes verifications past their expiresAt", async () => {
		vi.mocked(db.verification.deleteMany).mockResolvedValue({ count: 4 });
		const now = new Date("2026-01-01T00:00:00Z");
		expect(await deleteExpiredVerifications(now)).toEqual({ count: 4 });
		expect(db.verification.deleteMany).toHaveBeenCalledWith({
			where: { expiresAt: { lt: now } },
		});
	});

	it("deleteRateLimitsBefore compares lastRequest (epoch ms, BigInt) to the cutoff", async () => {
		vi.mocked(db.rateLimit.deleteMany).mockResolvedValue({ count: 7 });
		const cutoff = new Date("2026-01-01T00:00:00Z");
		expect(await deleteRateLimitsBefore(cutoff)).toEqual({ count: 7 });
		expect(db.rateLimit.deleteMany).toHaveBeenCalledWith({
			where: { lastRequest: { lt: BigInt(cutoff.getTime()) } },
		});
	});
});
