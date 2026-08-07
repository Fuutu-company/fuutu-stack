import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { listAuditLogsProcedure } from "../modules/admin/procedures/list-audit-logs";

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

vi.mock("@fuutu/db", () => ({
	listAuditLogs: vi.fn(),
	countAuditLogs: vi.fn(),
}));

const { listAuditLogs, countAuditLogs } = await import("@fuutu/db");

const adminContext = makeSession<Context>(makeUser({ role: "admin" }));
const memberContext = makeSession<Context>(
	makeUser({ id: "member-1", role: "user" }),
);
const unauthenticatedContext = makeSession<Context>(null);

const auditLogFixture = [
	{
		id: "log-1",
		userId: "user-1",
		action: "user.login",
		createdAt: new Date("2024-06-01T12:00:00Z"),
		user: { id: "user-1", email: "user@fuutu.local", name: "User One" },
	},
];

describe("admin.auditLogs.list", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns paginated audit logs for an admin user", async () => {
		vi.mocked(listAuditLogs).mockResolvedValue(auditLogFixture as never);
		vi.mocked(countAuditLogs).mockResolvedValue(1);

		const result = await call(
			listAuditLogsProcedure,
			{},
			{ context: adminContext },
		);

		expect(listAuditLogs).toHaveBeenCalledWith({
			userId: undefined,
			action: undefined,
			take: 50,
			skip: 0,
		});
		expect(countAuditLogs).toHaveBeenCalledWith({
			userId: undefined,
			action: undefined,
		});
		expect(result).toEqual({
			items: auditLogFixture,
			page: 1,
			pageSize: 50,
			total: 1,
			totalPages: 1,
		});
	});

	it("applies userId and action filters", async () => {
		vi.mocked(listAuditLogs).mockResolvedValue([] as never);
		vi.mocked(countAuditLogs).mockResolvedValue(0);

		await call(
			listAuditLogsProcedure,
			{
				userId: "550e8400-e29b-41d4-a716-446655440000",
				action: "user.login",
				page: 2,
				pageSize: 10,
			},
			{ context: adminContext },
		);

		expect(listAuditLogs).toHaveBeenCalledWith({
			userId: "550e8400-e29b-41d4-a716-446655440000",
			action: "user.login",
			take: 10,
			skip: 10,
		});
		expect(countAuditLogs).toHaveBeenCalledWith({
			userId: "550e8400-e29b-41d4-a716-446655440000",
			action: "user.login",
		});
	});

	it("computes totalPages across multiple pages", async () => {
		vi.mocked(listAuditLogs).mockResolvedValue(auditLogFixture as never);
		vi.mocked(countAuditLogs).mockResolvedValue(120);

		const result = await call(
			listAuditLogsProcedure,
			{ page: 1, pageSize: 50 },
			{ context: adminContext },
		);

		expect(result.totalPages).toBe(3);
	});

	it("rejects invalid userId (not a UUID)", async () => {
		await expect(
			call(
				listAuditLogsProcedure,
				{ userId: "not-a-uuid" },
				{ context: adminContext },
			),
		).rejects.toBeDefined();
	});

	it("rejects pageSize exceeding 200", async () => {
		await expect(
			call(
				listAuditLogsProcedure,
				{ pageSize: 201 },
				{ context: adminContext },
			),
		).rejects.toBeDefined();
	});

	it("rejects page below 1", async () => {
		await expect(
			call(listAuditLogsProcedure, { page: 0 }, { context: adminContext }),
		).rejects.toBeDefined();
	});

	it("throws FORBIDDEN for a non-admin member", async () => {
		await expect(
			call(listAuditLogsProcedure, {}, { context: memberContext }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(listAuditLogsProcedure, {}, { context: unauthenticatedContext }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});
