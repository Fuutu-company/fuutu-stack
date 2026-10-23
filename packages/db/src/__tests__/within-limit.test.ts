import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => ({
	db: {
		$transaction: vi.fn(),
		apiKey: { count: vi.fn(), create: vi.fn() },
		webhook: { count: vi.fn(), create: vi.fn() },
	},
}));

import { db } from "../../prisma/client";
import { createApiKeyWithinLimit } from "../../prisma/queries/api-key";
import { createWebhookWithinLimit } from "../../prisma/queries/webhook";

function makeP2034(): Error {
	return Object.assign(new Error("serialization failure"), {
		code: "P2034",
	});
}

function makeWriteConflict(): Error {
	return Object.assign(new Error("DriverAdapterError"), {
		cause: { kind: "TransactionWriteConflict", originalCode: "40001" },
	});
}

function apiKeyTx(count: number) {
	return {
		apiKey: {
			count: vi.fn().mockResolvedValue(count),
			create: vi
				.fn()
				.mockResolvedValue({ id: "key-1", prefix: "futu_sk_abc..." }),
		},
	};
}

function webhookTx(count: number) {
	return {
		webhook: {
			count: vi.fn().mockResolvedValue(count),
			create: vi.fn().mockResolvedValue({
				id: "wh-1",
				organizationId: "org-1",
				url: "https://example.com/hook",
				events: ["invoice.paid"],
				isActive: true,
			}),
		},
	};
}

async function runTx(tx: unknown) {
	vi.mocked(db.$transaction).mockImplementation(
		async (callback) => (await callback(tx as never)) as never,
	);
}

describe("createApiKeyWithinLimit", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates the key inside a Serializable transaction when under the limit", async () => {
		const tx = apiKeyTx(1);
		await runTx(tx);

		const result = await createApiKeyWithinLimit({
			userId: "user-1",
			name: "My Key",
			max: 2,
		});

		expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
			isolationLevel: "Serializable",
		});
		expect(tx.apiKey.count).toHaveBeenCalledWith({
			where: { userId: "user-1", revokedAt: null },
		});
		expect(tx.apiKey.create).toHaveBeenCalledOnce();
		expect(result).toMatchObject({ id: "key-1" });
		expect(result?.key).toMatch(/^futu_sk_/);
	});

	it("counts org keys for org-scoped creates", async () => {
		const tx = apiKeyTx(0);
		await runTx(tx);

		await createApiKeyWithinLimit({
			userId: "user-1",
			name: "Org Key",
			organizationId: "org-1",
			max: 2,
		});

		expect(tx.apiKey.count).toHaveBeenCalledWith({
			where: { organizationId: "org-1", revokedAt: null },
		});
	});

	it("returns null without inserting when the limit is reached", async () => {
		const tx = apiKeyTx(2);
		await runTx(tx);

		const result = await createApiKeyWithinLimit({
			userId: "user-1",
			name: "Nope",
			max: 2,
		});

		expect(result).toBeNull();
		expect(tx.apiKey.create).not.toHaveBeenCalled();
	});

	it("skips the check when max is null (unlimited)", async () => {
		const tx = apiKeyTx(9999);
		await runTx(tx);

		const result = await createApiKeyWithinLimit({
			userId: "user-1",
			name: "Key",
			max: null,
		});

		expect(result).not.toBeNull();
		expect(tx.apiKey.create).toHaveBeenCalledOnce();
	});

	it("retries the transaction on P2034 serialization conflicts", async () => {
		const txFail = apiKeyTx(0);
		txFail.apiKey.create.mockRejectedValueOnce(makeP2034());
		const txOk = apiKeyTx(1);

		vi.mocked(db.$transaction)
			.mockImplementationOnce(
				async (callback) => (await callback(txFail as never)) as never,
			)
			.mockImplementationOnce(
				async (callback) => (await callback(txOk as never)) as never,
			);

		const result = await createApiKeyWithinLimit({
			userId: "user-1",
			name: "Key",
			max: 2,
		});

		expect(result).not.toBeNull();
		expect(db.$transaction).toHaveBeenCalledTimes(2);
	});

	it("retries on driver-adapter TransactionWriteConflict errors", async () => {
		const txFail = apiKeyTx(0);
		txFail.apiKey.create.mockRejectedValueOnce(makeWriteConflict());
		const txOk = apiKeyTx(1);

		vi.mocked(db.$transaction)
			.mockImplementationOnce(
				async (callback) => (await callback(txFail as never)) as never,
			)
			.mockImplementationOnce(
				async (callback) => (await callback(txOk as never)) as never,
			);

		const result = await createApiKeyWithinLimit({
			userId: "user-1",
			name: "Key",
			max: 2,
		});

		expect(result).not.toBeNull();
		expect(db.$transaction).toHaveBeenCalledTimes(2);
	});

	it("propagates non-P2034 errors without retrying", async () => {
		const tx = apiKeyTx(0);
		tx.apiKey.create.mockRejectedValue(new Error("boom"));
		await runTx(tx);

		await expect(
			createApiKeyWithinLimit({ userId: "user-1", name: "Key", max: 2 }),
		).rejects.toThrow("boom");
		expect(db.$transaction).toHaveBeenCalledTimes(1);
	});

	it("gives up after 3 attempts on repeated P2034 conflicts", async () => {
		const tx = apiKeyTx(0);
		tx.apiKey.create.mockRejectedValue(makeP2034());
		await runTx(tx);

		await expect(
			createApiKeyWithinLimit({ userId: "user-1", name: "Key", max: 2 }),
		).rejects.toThrow("serialization failure");
		expect(db.$transaction).toHaveBeenCalledTimes(3);
	});
});

describe("createWebhookWithinLimit", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns null without inserting when the limit is reached", async () => {
		const tx = webhookTx(10);
		await runTx(tx);

		const result = await createWebhookWithinLimit({
			organizationId: "org-1",
			url: "https://example.com/hook",
			events: ["invoice.paid"],
			max: 10,
		});

		expect(result).toBeNull();
		expect(tx.webhook.create).not.toHaveBeenCalled();
	});

	it("creates the webhook with a fresh secret when under the limit", async () => {
		const tx = webhookTx(3);
		await runTx(tx);

		const result = await createWebhookWithinLimit({
			organizationId: "org-1",
			url: "https://example.com/hook",
			events: ["invoice.paid"],
			max: 10,
		});

		expect(tx.webhook.count).toHaveBeenCalledWith({
			where: { organizationId: "org-1" },
		});
		expect(tx.webhook.create).toHaveBeenCalledOnce();
		expect(result).toMatchObject({ id: "wh-1" });
		expect(result?.secret).toBeTruthy();
	});
});
