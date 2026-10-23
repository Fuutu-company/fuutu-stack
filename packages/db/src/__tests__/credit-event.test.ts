import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => ({
	db: {
		creditEvent: {
			findMany: vi.fn(),
		},
	},
}));

import { db } from "../../prisma/client";
import { getCreditEventsForMeter } from "../../prisma/queries/credit-event";

describe("getCreditEventsForMeter", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("short-circuits to [] without hitting the DB when no owner is given", async () => {
		const events = await getCreditEventsForMeter({ meterKey: "ai_tokens" });

		expect(events).toEqual([]);
		expect(db.creditEvent.findMany).not.toHaveBeenCalled();
	});

	it("scopes the lookup to a single user owner", async () => {
		vi.mocked(db.creditEvent.findMany).mockResolvedValue([] as never);

		await getCreditEventsForMeter({ userId: "user-1", meterKey: "ai_tokens" });

		expect(db.creditEvent.findMany).toHaveBeenCalledWith({
			where: {
				AND: [{ OR: [{ userId: "user-1" }] }, { meterKey: "ai_tokens" }],
			},
			orderBy: { createdAt: "desc" },
			take: 50,
		});
	});

	it("scopes the lookup to a single organization owner", async () => {
		vi.mocked(db.creditEvent.findMany).mockResolvedValue([] as never);

		await getCreditEventsForMeter({
			organizationId: "org-1",
			meterKey: "ai_tokens",
		});

		expect(db.creditEvent.findMany).toHaveBeenCalledWith({
			where: {
				AND: [{ OR: [{ organizationId: "org-1" }] }, { meterKey: "ai_tokens" }],
			},
			orderBy: { createdAt: "desc" },
			take: 50,
		});
	});

	it("ORs both owners only when both are set — never emits an empty OR clause", async () => {
		vi.mocked(db.creditEvent.findMany).mockResolvedValue([] as never);

		await getCreditEventsForMeter({
			userId: "user-1",
			organizationId: "org-1",
			meterKey: "ai_tokens",
			limit: 5,
		});

		// A `{ OR: [{ userId }, { organizationId: undefined }] }` clause would
		// degenerate to `{}` and match every owner's rows — the filter array
		// must only contain entries for owners that were actually given.
		expect(db.creditEvent.findMany).toHaveBeenCalledWith({
			where: {
				AND: [
					{ OR: [{ userId: "user-1" }, { organizationId: "org-1" }] },
					{ meterKey: "ai_tokens" },
				],
			},
			orderBy: { createdAt: "desc" },
			take: 5,
		});
	});
});
