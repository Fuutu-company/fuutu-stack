import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { notificationsRouter } from "../modules/notifications/router";

vi.mock("@fuutu/db", () => ({
	listNotifications: vi.fn(),
	countNotifications: vi.fn(),
	getUnreadCount: vi.fn(),
	markRead: vi.fn(),
	markAllRead: vi.fn(),
}));

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

const {
	listNotifications,
	countNotifications,
	getUnreadCount,
	markRead,
	markAllRead,
} = await import("@fuutu/db");

const authenticatedContext = makeSession<Context>(makeUser());
const unauthenticatedContext = makeSession<Context>(null);

describe("notifications.list", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns paginated notifications for the current user", async () => {
		vi.mocked(listNotifications).mockResolvedValue([
			{
				id: "n-1",
				type: "billing",
				title: "Invoice paid",
				body: "Your invoice was paid",
			},
		] as never);
		vi.mocked(countNotifications).mockResolvedValue(1);

		const result = await call(
			notificationsRouter.list,
			{ page: 1, limit: 10 },
			{ context: authenticatedContext },
		);

		expect(listNotifications).toHaveBeenCalledWith("user-1", {
			take: 10,
			skip: 0,
		});
		expect(countNotifications).toHaveBeenCalledWith("user-1");
		expect(result).toEqual({
			items: [
				{
					id: "n-1",
					type: "billing",
					title: "Invoice paid",
					body: "Your invoice was paid",
				},
			],
			page: 1,
			limit: 10,
			total: 1,
			totalPages: 1,
		});
	});

	it("uses default pagination when no params provided", async () => {
		vi.mocked(listNotifications).mockResolvedValue([] as never);
		vi.mocked(countNotifications).mockResolvedValue(0);

		const result = await call(
			notificationsRouter.list,
			{},
			{ context: authenticatedContext },
		);

		expect(listNotifications).toHaveBeenCalledWith("user-1", {
			take: 50,
			skip: 0,
		});
		expect(result).toEqual({
			items: [],
			page: 1,
			limit: 50,
			total: 0,
			totalPages: 1,
		});
	});

	it("computes correct skip for page 3", async () => {
		vi.mocked(listNotifications).mockResolvedValue([] as never);
		vi.mocked(countNotifications).mockResolvedValue(0);

		await call(
			notificationsRouter.list,
			{ page: 3, limit: 20 },
			{ context: authenticatedContext },
		);

		expect(listNotifications).toHaveBeenCalledWith("user-1", {
			take: 20,
			skip: 40,
		});
	});

	it("rejects limit exceeding 100", async () => {
		await expect(
			call(
				notificationsRouter.list,
				{ limit: 101 },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toBeDefined();
	});

	it("rejects page below 1", async () => {
		await expect(
			call(
				notificationsRouter.list,
				{ page: 0 },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toBeDefined();
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(notificationsRouter.list, {}, { context: unauthenticatedContext }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("notifications.unreadCount", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the unread count for the current user", async () => {
		vi.mocked(getUnreadCount).mockResolvedValue(5);

		const result = await call(notificationsRouter.unreadCount, undefined, {
			context: authenticatedContext,
		});

		expect(getUnreadCount).toHaveBeenCalledWith("user-1");
		expect(result).toEqual({ count: 5 });
	});

	it("returns zero when no unread notifications", async () => {
		vi.mocked(getUnreadCount).mockResolvedValue(0);

		const result = await call(notificationsRouter.unreadCount, undefined, {
			context: authenticatedContext,
		});

		expect(result).toEqual({ count: 0 });
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(notificationsRouter.unreadCount, undefined, {
				context: unauthenticatedContext,
			}),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("notifications.markRead", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("marks a notification as read", async () => {
		vi.mocked(markRead).mockResolvedValue({
			id: "n-1",
			readAt: new Date(),
		} as never);

		const result = await call(
			notificationsRouter.markRead,
			{ id: "n-1" },
			{ context: authenticatedContext },
		);

		expect(markRead).toHaveBeenCalledWith("n-1", "user-1");
		expect(result).toEqual({ success: true });
	});

	it("throws NOT_FOUND when notification does not exist or not owned", async () => {
		vi.mocked(markRead).mockResolvedValue(null as never);

		await expect(
			call(
				notificationsRouter.markRead,
				{ id: "n-404" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("rejects empty id", async () => {
		await expect(
			call(
				notificationsRouter.markRead,
				{ id: "" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toBeDefined();
	});
});

describe("notifications.markAllRead", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("marks all notifications as read for the current user", async () => {
		vi.mocked(markAllRead).mockResolvedValue({ count: 3 } as never);

		const result = await call(notificationsRouter.markAllRead, undefined, {
			context: authenticatedContext,
		});

		expect(markAllRead).toHaveBeenCalledWith("user-1");
		expect(result).toEqual({ success: true, count: 3 });
	});

	it("returns count of zero when no unread notifications", async () => {
		vi.mocked(markAllRead).mockResolvedValue({ count: 0 } as never);

		const result = await call(notificationsRouter.markAllRead, undefined, {
			context: authenticatedContext,
		});

		expect(result).toEqual({ success: true, count: 0 });
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(notificationsRouter.markAllRead, undefined, {
				context: unauthenticatedContext,
			}),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});
