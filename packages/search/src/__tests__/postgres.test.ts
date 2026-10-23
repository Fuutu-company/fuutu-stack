import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	searchNotifications: vi.fn(),
	searchAuditLogs: vi.fn(),
}));

import { searchAuditLogs, searchNotifications } from "@fuutu/db";
import { postgresProvider } from "../providers/postgres";
import { testSearchProviderContract } from "./provider-contract";

vi.mocked(searchNotifications).mockResolvedValue([]);
vi.mocked(searchAuditLogs).mockResolvedValue([]);

testSearchProviderContract("postgres", () => postgresProvider, {
	searchBehavior: "resolves",
	indexBehavior: "resolves",
	returnsEmpty: true,
});

const notificationRow = {
	id: "n1",
	userId: "u1",
	type: "system",
	title: "Welcome",
	body: "Hello world",
	data: null,
	createdAt: new Date(),
	readAt: null,
};

const auditLogRow = {
	id: "a1",
	action: "user.login",
	userId: "u1",
	organizationId: null,
	ip: null,
	userAgent: null,
	metadata: null,
	createdAt: new Date(),
};

describe("PostgresProvider", () => {
	beforeEach(() => {
		vi.mocked(searchNotifications).mockReset();
		vi.mocked(searchAuditLogs).mockReset();
	});

	it("searches notifications and audit logs by default, scoped to the user", async () => {
		vi.mocked(searchNotifications).mockResolvedValue([notificationRow]);
		vi.mocked(searchAuditLogs).mockResolvedValue([auditLogRow]);

		const results = await postgresProvider.search({
			text: "hello",
			userId: "u1",
		});

		expect(searchNotifications).toHaveBeenCalledWith(
			"hello",
			{ userId: "u1" },
			expect.objectContaining({ take: 20, skip: 0 }),
		);
		expect(searchAuditLogs).toHaveBeenCalledWith(
			"hello",
			{ userId: "u1" },
			expect.objectContaining({ take: 20, skip: 0 }),
		);
		expect(results).toHaveLength(2);
		expect(results[0]?.collection).toBe("notifications");
		expect(results[1]?.collection).toBe("audit-logs");
	});

	it("rejects unscoped searches — never returns cross-tenant rows", async () => {
		await expect(postgresProvider.search({ text: "hello" })).rejects.toThrow(
			"scope",
		);
		expect(searchNotifications).not.toHaveBeenCalled();
		expect(searchAuditLogs).not.toHaveBeenCalled();
	});

	it("requires userId to search the notifications collection", async () => {
		await expect(
			postgresProvider.search({
				text: "hello",
				collection: "notifications",
				organizationId: "org-1",
			}),
		).rejects.toThrow("userId");
		expect(searchNotifications).not.toHaveBeenCalled();
	});

	it("supports organization scope for audit logs", async () => {
		vi.mocked(searchAuditLogs).mockResolvedValue([auditLogRow]);

		const results = await postgresProvider.search({
			text: "login",
			collection: "audit-logs",
			organizationId: "org-1",
		});

		expect(searchAuditLogs).toHaveBeenCalledWith(
			"login",
			{ organizationId: "org-1" },
			expect.objectContaining({ take: 20, skip: 0 }),
		);
		expect(results).toHaveLength(1);
	});

	it("filters by collection when specified", async () => {
		vi.mocked(searchAuditLogs).mockResolvedValue([auditLogRow]);

		const results = await postgresProvider.search({
			text: "login",
			collection: "audit-logs",
			userId: "u1",
		});

		expect(searchNotifications).not.toHaveBeenCalled();
		expect(searchAuditLogs).toHaveBeenCalledTimes(1);
		expect(results).toHaveLength(1);
		expect(results[0]?.collection).toBe("audit-logs");
	});

	it("passes filters through to the db queries", async () => {
		vi.mocked(searchNotifications).mockResolvedValue([notificationRow]);
		vi.mocked(searchAuditLogs).mockResolvedValue([]);

		await postgresProvider.search({
			text: "hello",
			userId: "u1",
			filters: { type: "billing", action: "user" },
		});

		expect(searchNotifications).toHaveBeenCalledWith(
			"hello",
			{ userId: "u1" },
			expect.objectContaining({ type: "billing" }),
		);
		expect(searchAuditLogs).toHaveBeenCalledWith(
			"hello",
			{ userId: "u1" },
			expect.objectContaining({ action: "user" }),
		);
	});

	it("scores a title match higher than a body-only match", async () => {
		vi.mocked(searchNotifications).mockResolvedValue([
			notificationRow,
			{ ...notificationRow, id: "n2", title: "Other", body: "hello" },
		]);
		vi.mocked(searchAuditLogs).mockResolvedValue([]);

		const results = await postgresProvider.search({
			text: "welcome",
			collection: "notifications",
			userId: "u1",
		});

		expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
	});

	it("index() is a no-op that resolves", async () => {
		await expect(
			postgresProvider.index("test", [
				{ id: "1", title: "Doc", content: "Body", collection: "test" },
			]),
		).resolves.toBeUndefined();
	});
});
