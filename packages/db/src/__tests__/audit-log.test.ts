import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => ({
	db: {
		auditLog: {
			create: vi.fn(),
			findMany: vi.fn(),
			count: vi.fn(),
		},
		member: {
			findMany: vi.fn(),
		},
	},
}));

import { db } from "../../prisma/client";
import {
	countAuditLogsByOrg,
	createAuditLog,
	findAuditLogsByOrg,
	listAuditLogDates,
	searchAuditLogs,
} from "../../prisma/queries/audit-log";
import { prismaAuditSink } from "../../prisma/sinks/audit";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createAuditLog", () => {
	it("passes organizationId through to the create", async () => {
		await createAuditLog({
			userId: "u1",
			organizationId: "org1",
			action: "organization.invite",
		});

		expect(db.auditLog.create).toHaveBeenCalledWith({
			data: expect.objectContaining({ organizationId: "org1" }),
		});
	});
});

describe("findAuditLogsByOrg", () => {
	it("filters on organizationId without resolving members", async () => {
		vi.mocked(db.auditLog.findMany).mockResolvedValueOnce([] as never);

		await findAuditLogsByOrg("org1", { take: 20, skip: 40 });

		expect(db.member.findMany).not.toHaveBeenCalled();
		expect(db.auditLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { organizationId: "org1" },
				take: 20,
				skip: 40,
			}),
		);
	});

	it("applies the action prefix convention for bare domains", async () => {
		vi.mocked(db.auditLog.findMany).mockResolvedValueOnce([] as never);

		await findAuditLogsByOrg("org1", { action: "member" });

		expect(db.auditLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					organizationId: "org1",
					action: { startsWith: "member." },
				},
			}),
		);
	});
});

describe("countAuditLogsByOrg", () => {
	it("counts rows scoped by organizationId", async () => {
		vi.mocked(db.auditLog.count).mockResolvedValueOnce(7 as never);

		const total = await countAuditLogsByOrg("org1");

		expect(total).toBe(7);
		expect(db.member.findMany).not.toHaveBeenCalled();
		expect(db.auditLog.count).toHaveBeenCalledWith({
			where: { organizationId: "org1" },
		});
	});
});

describe("searchAuditLogs", () => {
	it("scopes organization searches to organizationId, case-insensitive", async () => {
		vi.mocked(db.auditLog.findMany).mockResolvedValueOnce([] as never);

		await searchAuditLogs("Invite", { organizationId: "org1" });

		expect(db.member.findMany).not.toHaveBeenCalled();
		expect(db.auditLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					organizationId: "org1",
					action: { contains: "Invite", mode: "insensitive" },
				},
			}),
		);
	});

	it("scopes user searches to userId", async () => {
		vi.mocked(db.auditLog.findMany).mockResolvedValueOnce([] as never);

		await searchAuditLogs("sign", { userId: "u1" }, { action: "auth" });

		expect(db.auditLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					userId: "u1",
					action: {
						contains: "sign",
						startsWith: "auth.",
						mode: "insensitive",
					},
				},
			}),
		);
	});
});

describe("listAuditLogDates", () => {
	const since = new Date("2026-10-15T00:00:00Z");

	it("selects only action + createdAt for an org since the cutoff", async () => {
		vi.mocked(db.auditLog.findMany).mockResolvedValueOnce([] as never);

		await listAuditLogDates({ organizationId: "org1", since });

		expect(db.auditLog.findMany).toHaveBeenCalledWith({
			where: { organizationId: "org1", createdAt: { gte: since } },
			select: { action: true, createdAt: true },
			orderBy: [{ createdAt: "desc" }, { id: "asc" }],
			take: 5000,
		});
	});

	it("scopes to userId and honours take", async () => {
		vi.mocked(db.auditLog.findMany).mockResolvedValueOnce([] as never);

		await listAuditLogDates({ userId: "u1", since, take: 10 });

		expect(db.auditLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: "u1", createdAt: { gte: since } },
				take: 10,
			}),
		);
	});

	it("refuses to run without an owner (no cross-tenant series)", () => {
		expect(() =>
			listAuditLogDates({ since } as unknown as Parameters<
				typeof listAuditLogDates
			>[0]),
		).toThrow(/userId or organizationId/);
		expect(db.auditLog.findMany).not.toHaveBeenCalled();
	});
});

describe("prismaAuditSink", () => {
	it("persists organizationId from the audit event", async () => {
		await prismaAuditSink.record({
			action: "organization.invite",
			userId: "u1",
			organizationId: "org1",
		});

		expect(db.auditLog.create).toHaveBeenCalledWith({
			data: expect.objectContaining({ organizationId: "org1" }),
		});
	});
});
