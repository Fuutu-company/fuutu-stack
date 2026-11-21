import { describe, expect, it } from "vitest";
import { deriveDesktopIdentity, slugify } from "../identity";

describe("deriveDesktopIdentity", () => {
	it("derives every name from the app name", () => {
		const id = deriveDesktopIdentity("Acme Notes", {
			bundleId: undefined,
			scheme: undefined,
		});
		expect(id).toMatchObject({
			productName: "Acme Notes",
			slug: "acme-notes",
			bundleId: "app.acme-notes.desktop",
			scheme: "acmenotes",
			oauthClientId: "acme-notes-desktop",
			keychainService: "app.acme-notes.desktop",
		});
		expect(id.userAgent("1.2.3")).toBe("acme-notes-desktop/1.2.3");
	});

	it("hard-codes no kit name (LICENSE.md §8)", () => {
		const id = deriveDesktopIdentity("Noor", {
			bundleId: undefined,
			scheme: undefined,
		});
		const all = JSON.stringify({ ...id, ua: id.userAgent("1.0.0") });
		expect(all.toLowerCase()).not.toContain("fuutu");
	});

	it("honours explicit overrides", () => {
		const id = deriveDesktopIdentity("Acme", {
			bundleId: "com.acme.notes",
			scheme: "acme-notes",
		});
		expect(id.bundleId).toBe("com.acme.notes");
		expect(id.keychainService).toBe("com.acme.notes");
		expect(id.scheme).toBe("acme-notes");
	});

	it("slugifies accents and symbols", () => {
		expect(slugify("Café Ölmühle!")).toBe("cafe-olmuhle");
		expect(slugify("!!!")).toBe("app");
	});
});
