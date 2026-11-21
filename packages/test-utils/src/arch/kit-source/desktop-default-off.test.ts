import { describe, expect, it } from "vitest";
import { config } from "../../../../config/index";

/**
 * The kit ships the desktop app switched off (owner decision 2026-11-21,
 * kit scope: optional module, default off). Buyers turn it on in their
 * repo — so this guard runs in the kit repository only.
 */
describe("desktop module default", () => {
	it("config.features.desktop ships as false", () => {
		expect(config.features.desktop).toBe(false);
	});
});
