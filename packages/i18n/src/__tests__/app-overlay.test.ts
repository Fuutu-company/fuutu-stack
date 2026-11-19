import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMessagesForLocale } from "../../lib/messages";
import kitEn from "../../translations/en/index";

vi.mock("../../config", () => ({
	i18nConfig: {
		enabled: true,
		locales: {
			en: {
				currency: "USD",
				label: "English",
				dateFormat: "MM/DD/YYYY",
				direction: "ltr",
			},
			de: {
				currency: "EUR",
				label: "Deutsch",
				dateFormat: "DD.MM.YYYY",
				direction: "ltr",
				fallbackLocale: "en",
			},
		},
		defaultLocale: "en",
		defaultCurrency: "USD",
		localeCookieName: "NEXT_LOCALE",
	},
}));

const overlays = vi.hoisted(() => ({
	en: {} as Record<string, Record<string, unknown>>,
	de: {} as Record<string, Record<string, unknown>>,
}));

vi.mock("../../translations/en/app/index", () => ({
	get appTranslations() {
		return overlays.en;
	},
}));
vi.mock("../../translations/de/app/index", () => ({
	get appTranslations() {
		return overlays.de;
	},
}));

const asRecord = (value: unknown) => value as Record<string, unknown>;

describe("app translation overlay", () => {
	beforeEach(() => {
		overlays.en = {};
		overlays.de = {};
	});

	it("an empty overlay leaves the kit messages untouched", async () => {
		const messages = await getMessagesForLocale("en");
		expect(messages).toEqual(JSON.parse(JSON.stringify(kitEn)));
	});

	it("adds app keys to the requested namespace", async () => {
		overlays.en = { saas: { myAppPage: { title: "Mine" } } };
		const messages = await getMessagesForLocale("en", "saas");
		expect(asRecord(messages).myAppPage).toEqual({ title: "Mine" });
		expect(messages.auth.signIn).toBe("Sign In");
	});

	it("adds common app keys to every app", async () => {
		overlays.en = { common: { sharedKey: "shared" } };
		for (const app of ["marketing", "saas", "docs"] as const) {
			const messages = await getMessagesForLocale("en", app);
			expect(asRecord(messages).sharedKey).toBe("shared");
		}
	});

	it("keeps overlay sections of other apps out", async () => {
		overlays.en = { marketing: { marketingOnly: "m" } };
		const messages = await getMessagesForLocale("en", "saas");
		expect(asRecord(messages).marketingOnly).toBeUndefined();
	});

	it("app values override kit values and keep sibling kit keys", async () => {
		overlays.en = { saas: { auth: { signIn: "Log me in" } } };
		const messages = await getMessagesForLocale("en", "saas");
		expect(messages.auth.signIn).toBe("Log me in");
		expect(messages.auth.signUp).toBeDefined();
		expect(messages.auth.signUp).toBe(kitEn.auth.signUp);
	});

	it("replaces arrays instead of concatenating them", async () => {
		overlays.en = {
			marketing: {
				home: { features: { team: { members: [{ role: "Only one" }] } } },
			},
		};
		const messages = await getMessagesForLocale("en", "marketing");
		expect(messages.home.features.team.members).toEqual([{ role: "Only one" }]);
	});

	it("nests docs overlay under docs when loading without an app", async () => {
		overlays.en = { docs: { nav: { appLink: "Mine" } } };
		const messages = await getMessagesForLocale("en");
		expect(messages.docs.nav).toMatchObject({ appLink: "Mine" });
		expect(asRecord(messages.nav).appLink).toBeUndefined();
	});

	it("flows an en app key into a locale that lacks it", async () => {
		overlays.en = { saas: { myAppPage: { title: "Mine" } } };
		const messages = await getMessagesForLocale("de", "saas");
		expect(asRecord(messages).myAppPage).toEqual({ title: "Mine" });
		expect(messages.auth.signIn).toBe("Anmelden");
	});

	it("a de overlay wins over the en overlay and over kit de values", async () => {
		overlays.en = { saas: { myAppPage: { title: "Mine" } } };
		overlays.de = {
			saas: { myAppPage: { title: "Meins" }, auth: { signIn: "Rein" } },
		};
		const messages = await getMessagesForLocale("de", "saas");
		expect(asRecord(messages).myAppPage).toEqual({ title: "Meins" });
		expect(messages.auth.signIn).toBe("Rein");
	});
});
