import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => ({
	db: {
		auditLog: { findMany: vi.fn() },
		invoice: { findMany: vi.fn() },
		apiKey: { findMany: vi.fn(), count: vi.fn() },
	},
}));

import { db } from "../../prisma/client";
import { countApiKeys, listApiKeys } from "../../prisma/queries/api-key";
import {
	listAuditLogDates,
	listAuditLogs,
} from "../../prisma/queries/audit-log";
import { listInvoicesByUser } from "../../prisma/queries/invoice";

// Owner-scope options used by the dashboard: an org member's own rows in
// one org (org + user), and personal-only rows (organizationId = null).
// The defaults stay unchanged for the existing endpoints.

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(db.auditLog.findMany).mockResolvedValue([] as never);
	vi.mocked(db.invoice.findMany).mockResolvedValue([] as never);
	vi.mocked(db.apiKey.findMany).mockResolvedValue([] as never);
	vi.mocked(db.apiKey.count).mockResolvedValue(0 as never);
});

const since = new Date("2026-10-15T00:00:00Z");

describe("listAuditLogs", () => {
	it("filters by organizationId and userId together", async () => {
		await listAuditLogs({ userId: "u1", organizationId: "org1", take: 8 });

		expect(db.auditLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: "u1", organizationId: "org1" },
				take: 8,
			}),
		);
	});

	it("keeps the user-only filter by default", async () => {
		await listAuditLogs({ userId: "u1" });

		expect(db.auditLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { userId: "u1" } }),
		);
	});
});

describe("listAuditLogDates", () => {
	it("filters by organizationId and userId together", async () => {
		await listAuditLogDates({ organizationId: "org1", userId: "u1", since });

		expect(db.auditLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					organizationId: "org1",
					userId: "u1",
					createdAt: { gte: since },
				},
			}),
		);
	});
});

describe("personal-only owner filters", () => {
	it("listInvoicesByUser excludes org invoices with personalOnly", async () => {
		await listInvoicesByUser("u1", { take: 5, personalOnly: true });

		expect(db.invoice.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: "u1", organizationId: null },
				take: 5,
			}),
		);
	});

	it("listInvoicesByUser keeps org invoices by default", async () => {
		await listInvoicesByUser("u1");

		expect(db.invoice.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { userId: "u1" } }),
		);
	});

	it("listApiKeys excludes org keys with personalOnly", async () => {
		await listApiKeys("u1", { take: 5, personalOnly: true });

		expect(db.apiKey.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: "u1", revokedAt: null, organizationId: null },
			}),
		);
	});

	it("listApiKeys keeps org keys by default", async () => {
		await listApiKeys("u1");

		expect(db.apiKey.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { userId: "u1", revokedAt: null } }),
		);
	});

	it("countApiKeys excludes org keys with personalOnly", async () => {
		await countApiKeys("u1", { personalOnly: true });

		expect(db.apiKey.count).toHaveBeenCalledWith({
			where: { userId: "u1", revokedAt: null, organizationId: null },
		});
	});

	it("countApiKeys keeps org keys by default", async () => {
		await countApiKeys("u1");

		expect(db.apiKey.count).toHaveBeenCalledWith({
			where: { userId: "u1", revokedAt: null },
		});
	});
});
