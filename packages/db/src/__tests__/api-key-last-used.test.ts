import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => ({
	db: {
		apiKey: { findUnique: vi.fn(), update: vi.fn() },
	},
}));

const { db } = await import("../../prisma/client");
const { verifyApiKey } = await import("../../prisma/queries/api-key");

const NOW = new Date("2026-06-01T12:00:00Z");
const SECOND = 1000;

function key(lastUsedAt: Date | null) {
	return {
		id: "key-1",
		revokedAt: null,
		expiresAt: null,
		lastUsedAt,
	};
}

// One UPDATE per authenticated request turned every API call into a
// write; `lastUsedAt` is shown to the minute, so once a minute is enough.
describe("verifyApiKey lastUsedAt", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("records the first use", async () => {
		vi.mocked(db.apiKey.findUnique).mockResolvedValue(key(null) as never);
		await verifyApiKey("futu_sk_test");
		expect(db.apiKey.update).toHaveBeenCalledWith({
			where: { id: "key-1" },
			data: { lastUsedAt: NOW },
		});
	});

	it("skips the write within a minute of the last one", async () => {
		vi.mocked(db.apiKey.findUnique).mockResolvedValue(
			key(new Date(NOW.getTime() - 59 * SECOND)) as never,
		);
		expect(await verifyApiKey("futu_sk_test")).toMatchObject({ id: "key-1" });
		expect(db.apiKey.update).not.toHaveBeenCalled();
	});

	it("writes again once a minute has passed", async () => {
		vi.mocked(db.apiKey.findUnique).mockResolvedValue(
			key(new Date(NOW.getTime() - 60 * SECOND)) as never,
		);
		await verifyApiKey("futu_sk_test");
		expect(db.apiKey.update).toHaveBeenCalledOnce();
	});
});
