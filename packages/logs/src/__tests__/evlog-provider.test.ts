import { describe, expect, it } from "vitest";
import { evlogProvider } from "../providers/evlog";

describe("evlogProvider", () => {
	it("should call log without throwing", () => {
		expect(() =>
			evlogProvider.log("info", "test message", { scope: "test" }),
		).not.toThrow();
	});
	it("should handle all log levels", () => {
		expect(() =>
			evlogProvider.log("debug", "debug msg", { scope: "test" }),
		).not.toThrow();
		expect(() =>
			evlogProvider.log("warn", "warn msg", { scope: "test" }),
		).not.toThrow();
		expect(() =>
			evlogProvider.log("error", "error msg", { scope: "test" }),
		).not.toThrow();
	});
	it("should handle meta context", () => {
		expect(() =>
			evlogProvider.log("info", "msg", {
				scope: "test",
				meta: { userId: "123" },
			}),
		).not.toThrow();
	});
	it("should handle no scope", () => {
		expect(() => evlogProvider.log("info", "no scope msg", {})).not.toThrow();
	});
});
