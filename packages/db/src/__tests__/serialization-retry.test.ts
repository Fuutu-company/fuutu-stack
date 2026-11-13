import { describe, expect, it, vi } from "vitest";
import { withSerializationRetry } from "../../prisma/queries/transaction";

const conflict = () =>
	Object.assign(new Error("write conflict"), { code: "P2034" });

describe("withSerializationRetry", () => {
	it("survives four consecutive serialization conflicts", async () => {
		const fn = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(conflict())
			.mockRejectedValueOnce(conflict())
			.mockRejectedValueOnce(conflict())
			.mockRejectedValueOnce(conflict())
			.mockResolvedValue("ok");

		await expect(withSerializationRetry(fn)).resolves.toBe("ok");
		expect(fn).toHaveBeenCalledTimes(5);
	});

	it("gives up after five attempts", async () => {
		const fn = vi.fn<() => Promise<string>>().mockRejectedValue(conflict());

		await expect(withSerializationRetry(fn)).rejects.toMatchObject({
			code: "P2034",
		});
		expect(fn).toHaveBeenCalledTimes(5);
	});

	it("rethrows other errors immediately", async () => {
		const fn = vi
			.fn<() => Promise<string>>()
			.mockRejectedValue(new Error("boom"));

		await expect(withSerializationRetry(fn)).rejects.toThrow("boom");
		expect(fn).toHaveBeenCalledTimes(1);
	});
});
