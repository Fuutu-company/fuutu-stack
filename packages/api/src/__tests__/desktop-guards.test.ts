import { describe, expect, it } from "vitest";
import { assertDesktopCaller } from "../modules/desktop/guards";

describe("assertDesktopCaller", () => {
	it("refuses API keys, also org-pinned ones", () => {
		expect(() =>
			assertDesktopCaller({
				apiKey: { id: "k1", organizationId: "org-1" },
				desktop: null,
			} as never),
		).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
	});

	it("accepts the desktop token and the browser session", () => {
		expect(() =>
			assertDesktopCaller({
				apiKey: { id: "oauth:jti", organizationId: null },
				desktop: { clientId: "c", tokenId: "jti", organizationId: null },
			} as never),
		).not.toThrow();
		expect(() =>
			assertDesktopCaller({ apiKey: null, desktop: null } as never),
		).not.toThrow();
	});
});
