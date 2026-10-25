import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	searchNotifications: vi.fn(),
	searchAuditLogs: vi.fn(),
}));

import { searchAuditLogs, searchNotifications } from "@fuutu/db";
import { searchConfig } from "../config";
import { postgresProvider } from "../providers/postgres";
import { testSearchProviderContract } from "./provider-contract";

beforeEach(() => {
	vi.mocked(searchNotifications).mockResolvedValue([]);
	vi.mocked(searchAuditLogs).mockResolvedValue([]);
});

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
		// Sorted by score desc — the audit-log hit (1) outranks the
		// body-only notification match (0.5).
		expect(results[0]?.collection).toBe("audit-logs");
		expect(results[1]?.collection).toBe("notifications");
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

	it("paginates globally — an offset past a full page surfaces later hits", async () => {
		// 20 title-matching notifications fill page 1 entirely; the single
		// audit-log hit must land on page 2 instead of being re-skipped.
		const notifications = Array.from({ length: 20 }, (_, i) => ({
			...notificationRow,
			id: `n${i + 1}`,
			title: `Hello ${i + 1}`,
		}));
		vi.mocked(searchNotifications).mockResolvedValue(notifications);
		vi.mocked(searchAuditLogs).mockResolvedValue([auditLogRow]);

		const page1 = await postgresProvider.search({
			text: "hello",
			userId: "u1",
		});
		const page2 = await postgresProvider.search({
			text: "hello",
			userId: "u1",
			offset: 20,
		});

		expect(page1).toHaveLength(20);
		expect(page1.every((r) => r.collection === "notifications")).toBe(true);
		expect(searchNotifications).toHaveBeenLastCalledWith(
			"hello",
			{ userId: "u1" },
			expect.objectContaining({ take: 40, skip: 0 }),
		);
		expect(searchAuditLogs).toHaveBeenLastCalledWith(
			"hello",
			{ userId: "u1" },
			expect.objectContaining({ take: 40, skip: 0 }),
		);
		expect(page2).toHaveLength(1);
		expect(page2[0]?.collection).toBe("audit-logs");
	});

	it("scopes org-only queries to audit logs without touching notifications", async () => {
		vi.mocked(searchAuditLogs).mockResolvedValue([auditLogRow]);

		const results = await postgresProvider.search({
			text: "login",
			organizationId: "org-1",
		});

		expect(searchNotifications).not.toHaveBeenCalled();
		expect(results.map((r) => r.collection)).toEqual(["audit-logs"]);
	});

	it("throws for an unknown collection instead of silently returning nothing", async () => {
		await expect(
			postgresProvider.search({
				text: "hello",
				collection: "bogus",
				userId: "u1",
			}),
		).rejects.toThrow('Unknown collection "bogus"');
		expect(searchNotifications).not.toHaveBeenCalled();
		expect(searchAuditLogs).not.toHaveBeenCalled();
	});

	it("throws for an empty-string collection instead of treating it as all", async () => {
		await expect(
			postgresProvider.search({
				text: "hello",
				collection: "",
				userId: "u1",
			}),
		).rejects.toThrow("Unknown collection");
		expect(searchNotifications).not.toHaveBeenCalled();
		expect(searchAuditLogs).not.toHaveBeenCalled();
	});

	it("rejects empty search text", async () => {
		await expect(
			postgresProvider.search({ text: "   ", userId: "u1" }),
		).rejects.toThrow("non-empty");
		expect(searchNotifications).not.toHaveBeenCalled();
		expect(searchAuditLogs).not.toHaveBeenCalled();
	});

	it("trims the search text before it reaches the db", async () => {
		vi.mocked(searchNotifications).mockResolvedValue([]);
		vi.mocked(searchAuditLogs).mockResolvedValue([]);

		await postgresProvider.search({ text: "  hello  ", userId: "u1" });

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
	});

	it("rejects a limit below 1", async () => {
		await expect(
			postgresProvider.search({ text: "x", userId: "u1", limit: 0 }),
		).rejects.toThrow("limit");
		expect(searchNotifications).not.toHaveBeenCalled();
		expect(searchAuditLogs).not.toHaveBeenCalled();
	});

	it("accepts a limit equal to the configured max", async () => {
		vi.mocked(searchNotifications).mockResolvedValue([]);
		vi.mocked(searchAuditLogs).mockResolvedValue([]);

		await postgresProvider.search({
			text: "x",
			userId: "u1",
			limit: searchConfig.maxLimit,
		});

		expect(searchNotifications).toHaveBeenCalledWith(
			"x",
			{ userId: "u1" },
			expect.objectContaining({ take: searchConfig.maxLimit, skip: 0 }),
		);
	});

	it("rejects a limit above the configured max", async () => {
		await expect(
			postgresProvider.search({
				text: "x",
				userId: "u1",
				limit: (searchConfig.maxLimit ?? 50) + 1,
			}),
		).rejects.toThrow("limit");
		expect(searchNotifications).not.toHaveBeenCalled();
		expect(searchAuditLogs).not.toHaveBeenCalled();
	});

	it("rejects a non-integer limit", async () => {
		await expect(
			postgresProvider.search({ text: "x", userId: "u1", limit: 1.5 }),
		).rejects.toThrow("limit");
		expect(searchNotifications).not.toHaveBeenCalled();
		expect(searchAuditLogs).not.toHaveBeenCalled();
	});

	it("rejects a negative offset", async () => {
		await expect(
			postgresProvider.search({ text: "x", userId: "u1", offset: -1 }),
		).rejects.toThrow("offset");
		expect(searchNotifications).not.toHaveBeenCalled();
		expect(searchAuditLogs).not.toHaveBeenCalled();
	});

	it("rejects a non-integer offset", async () => {
		await expect(
			postgresProvider.search({ text: "x", userId: "u1", offset: 1.5 }),
		).rejects.toThrow("offset");
		expect(searchNotifications).not.toHaveBeenCalled();
		expect(searchAuditLogs).not.toHaveBeenCalled();
	});

	it("rejects an offset above the configured max", async () => {
		await expect(
			postgresProvider.search({
				text: "x",
				userId: "u1",
				offset: (searchConfig.maxOffset ?? 10_000) + 1,
			}),
		).rejects.toThrow("offset");
		expect(searchNotifications).not.toHaveBeenCalled();
		expect(searchAuditLogs).not.toHaveBeenCalled();
	});

	it("index() is a no-op that resolves", async () => {
		await expect(
			postgresProvider.index("test", [
				{ id: "1", title: "Doc", content: "Body", collection: "test" },
			]),
		).resolves.toBeUndefined();
	});
});
