import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => ({
	db: { $queryRaw: vi.fn() },
}));

import { db } from "../../prisma/client";
import { pingDatabase } from "../../prisma/queries/health";

beforeEach(() => vi.clearAllMocks());

describe("pingDatabase", () => {
	it("reports a reachable database with a non-negative latency", async () => {
		vi.mocked(db.$queryRaw).mockResolvedValue([{ ok: 1 }]);
		const result = await pingDatabase();
		expect(result.ok).toBe(true);
		expect(result.latencyMs).toBeGreaterThanOrEqual(0);
	});

	it("reports an unreachable database instead of throwing", async () => {
		vi.mocked(db.$queryRaw).mockRejectedValue(new Error("connection refused"));
		const result = await pingDatabase();
		expect(result.ok).toBe(false);
		expect(JSON.stringify(result)).not.toContain("connection refused");
	});
});
