import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	db: {
		notification: { findMany: vi.fn() },
		auditLog: { findMany: vi.fn() },
	},
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

import { db } from "@fuutu/db";
import { postgresProvider } from "../providers/postgres";
import { testSearchProviderContract } from "./provider-contract.test";

vi.mocked(db.notification.findMany).mockResolvedValue([]);
vi.mocked(db.auditLog.findMany).mockResolvedValue([]);

testSearchProviderContract("postgres", () => postgresProvider, {
	searchBehavior: "resolves",
	indexBehavior: "resolves",
	returnsEmpty: true,
});

describe("PostgresProvider", () => {
	beforeEach(() => {
		vi.mocked(db.notification.findMany).mockReset();
		vi.mocked(db.auditLog.findMany).mockReset();
	});

	it("searches notifications and audit logs by default", async () => {
		vi.mocked(db.notification.findMany).mockResolvedValue([
			{
				id: "n1",
				userId: "u1",
				type: "system",
				title: "Welcome",
				body: "Hello world",
				data: null,
				createdAt: new Date(),
				readAt: null,
			},
		]);
		vi.mocked(db.auditLog.findMany).mockResolvedValue([
			{
				id: "a1",
				action: "user.login",
				userId: null,
				ip: null,
				userAgent: null,
				metadata: null,
				createdAt: new Date(),
			},
		]);

		const results = await postgresProvider.search({ text: "hello" });

		expect(db.notification.findMany).toHaveBeenCalledTimes(1);
		expect(db.auditLog.findMany).toHaveBeenCalledTimes(1);
		expect(results).toHaveLength(2);
		expect(results[0]?.collection).toBe("notifications");
		expect(results[1]?.collection).toBe("audit-logs");
	});

	it("filters by collection when specified", async () => {
		vi.mocked(db.auditLog.findMany).mockResolvedValue([
			{
				id: "a1",
				action: "user.login",
				userId: null,
				ip: null,
				userAgent: null,
				metadata: null,
				createdAt: new Date(),
			},
		]);

		const results = await postgresProvider.search({
			text: "login",
			collection: "audit-logs",
		});

		expect(db.notification.findMany).not.toHaveBeenCalled();
		expect(db.auditLog.findMany).toHaveBeenCalledTimes(1);
		expect(results).toHaveLength(1);
		expect(results[0]?.collection).toBe("audit-logs");
	});

	it("index() is a no-op that resolves", async () => {
		await expect(
			postgresProvider.index("test", [
				{ id: "1", title: "Doc", content: "Body", collection: "test" },
			]),
		).resolves.toBeUndefined();
	});
});
