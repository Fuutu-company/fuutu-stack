import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { listRecentActivityProcedure } from "../modules/activity/procedures/list-recent-activity";

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

vi.mock("@fuutu/db", () => ({
	listAuditLogs: vi.fn(),
}));

const { listAuditLogs } = await import("@fuutu/db");

const authenticatedContext = makeSession<Context>(makeUser());
const unauthenticatedContext = makeSession<Context>(null);

const activityFixture = [
	{
		id: "log-1",
		userId: "user-1",
		action: "user.login",
		createdAt: new Date("2024-06-01T12:00:00Z"),
		user: { id: "user-1", email: "test@fuutu.local", name: "Test User" },
	},
	{
		id: "log-2",
		userId: "user-1",
		action: "profile.update",
		createdAt: new Date("2024-06-01T11:00:00Z"),
		user: { id: "user-1", email: "test@fuutu.local", name: "Test User" },
	},
];

describe("activity.recent", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the last 10 audit-log entries for the current user", async () => {
		vi.mocked(listAuditLogs).mockResolvedValue(activityFixture as never);

		const result = await call(listRecentActivityProcedure, undefined, {
			context: authenticatedContext,
		});

		expect(listAuditLogs).toHaveBeenCalledWith({
			userId: "user-1",
			take: 10,
			skip: 0,
		});
		expect(result).toEqual({ items: activityFixture });
	});

	it("returns an empty array when there is no activity", async () => {
		vi.mocked(listAuditLogs).mockResolvedValue([] as never);

		const result = await call(listRecentActivityProcedure, undefined, {
			context: authenticatedContext,
		});

		expect(result).toEqual({ items: [] });
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(listRecentActivityProcedure, undefined, {
				context: unauthenticatedContext,
			}),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});
