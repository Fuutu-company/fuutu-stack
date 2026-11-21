import { describe, expect, it } from "vitest";
import { importLocale } from "../../lib/messages";

describe("desktop namespace", () => {
	it("loads common + the nested desktop bundle for the desktop app", async () => {
		const messages = (await importLocale("de", "desktop")) as Record<
			string,
			unknown
		>;
		const desktop = messages.desktop as {
			shell: { nav: { settings: string } };
		};
		expect(desktop.shell.nav.settings).toBe("Einstellungen");
		expect(messages).toHaveProperty("common");
		// The web apps' namespaces stay out of the desktop bundle.
		expect(messages).not.toHaveProperty("dashboard");
	});

	it("keeps desktop nested when all namespaces load", async () => {
		const messages = (await importLocale("en")) as Record<string, unknown>;
		expect(messages.desktop).toHaveProperty("settings.title", "Settings");
		expect(messages).not.toHaveProperty("shell");
	});
});
