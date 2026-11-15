import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppMail } from "../types";

/**
 * `appMail.legalFooter` (app-owned `src/app-mail.ts`): company details
 * under every transactional email, e.g. what § 35a GmbHG requires of a
 * German GmbH. Unset, every template renders exactly as before.
 */

const app = vi.hoisted(() => ({ appMail: {} as AppMail }));

vi.mock("../app-mail", () => ({
	get appMail() {
		return app.appMail;
	},
}));

const { renderTemplate } = await import("../templates");
const { templateRegistry } = await import("../templates");

type Name = keyof typeof templateRegistry;

const fixtures: { [K in Name]: Parameters<(typeof templateRegistry)[K]>[0] } = {
	"password-reset": { name: "Rush", resetUrl: "https://app.test/reset" },
	"magic-link": { name: "Rush", magicLinkUrl: "https://app.test/magic" },
	"email-verification": {
		name: "Rush",
		verificationUrl: "https://app.test/verify",
	},
	"email-change-verification": {
		name: "Rush",
		verificationUrl: "https://app.test/verify-email",
		newEmail: "new@test.dev",
	},
	"organization-invitation": {
		organizationName: "Acme",
		inviteUrl: "https://app.test/invite",
		inviterName: "Admin",
	},
	"new-user": { name: "Rush", appUrl: "https://app.test/dashboard" },
	notification: { name: "Rush", title: "Hi", body: "Body" },
};

const names = Object.keys(fixtures) as Name[];
const render = (name: Name, locale?: string) =>
	renderTemplate(name, { ...fixtures[name], locale } as never);

const LINES = [
	"Fuutu GmbH · Musterstraße 1 · 10115 Berlin",
	"Registergericht: Amtsgericht Berlin-Charlottenburg, HRB 123456",
	"Geschäftsführer: Erika Mustermann",
];

beforeEach(() => {
	app.appMail = {};
});

describe("appMail.legalFooter", () => {
	it.each(names)("%s: unset adds no footer to HTML or text", (name) => {
		const { html, text } = render(name);
		expect(html).not.toContain('data-legal-footer=""');
		expect(text).not.toContain("\n-- \n");
	});

	it.each(names)(
		"%s: renders every line in the HTML and the text part",
		(name) => {
			app.appMail = { legalFooter: LINES };
			const { html, text } = render(name);
			const footer = html.slice(html.indexOf('data-legal-footer=""'));
			expect(footer).toContain(
				"Fuutu GmbH · Musterstraße 1 · 10115 Berlin<br />Registergericht: Amtsgericht Berlin-Charlottenburg, HRB 123456<br />Geschäftsführer: Erika Mustermann",
			);
			expect(text.endsWith(`\n\n-- \n${LINES.join("\n")}`)).toBe(true);
		},
	);

	it("sits below the card, not inside it", () => {
		app.appMail = { legalFooter: "Fuutu GmbH" };
		const { html } = render("password-reset");
		const cardEnd = html.lastIndexOf(
			"</table>",
			html.indexOf("data-legal-footer"),
		);
		expect(cardEnd).toBeGreaterThan(-1);
		expect(html.indexOf("Fuutu GmbH")).toBeGreaterThan(cardEnd);
		expect(html.indexOf("Fuutu GmbH")).toBeLessThan(html.indexOf("</body>"));
	});

	it("accepts a single string", () => {
		app.appMail = { legalFooter: "Fuutu GmbH, HRB 123456" };
		const { text } = render("magic-link");
		expect(text.endsWith("\n\n-- \nFuutu GmbH, HRB 123456")).toBe(true);
	});

	it("resolves a per-locale footer with the recipient locale", () => {
		app.appMail = {
			legalFooter: (locale) =>
				locale === "de" ? "Geschäftsführer: E. M." : "Managing director: E. M.",
		};
		expect(render("new-user", "de").text).toContain("Geschäftsführer: E. M.");
		expect(render("new-user", "en").text).toContain("Managing director: E. M.");
	});

	it("escapes HTML in the footer lines", () => {
		app.appMail = { legalFooter: "<b>Fuutu</b> & Co" };
		const { html } = render("notification");
		expect(html).toContain("&lt;b&gt;Fuutu&lt;/b&gt; &amp; Co");
		expect(html).not.toContain("<b>Fuutu</b>");
	});

	it("drops blank lines; only blank lines means no footer", () => {
		app.appMail = { legalFooter: ["", "  "] };
		const { html, text } = render("password-reset");
		expect(html).not.toContain('data-legal-footer=""');
		expect(text).not.toContain("\n-- \n");
	});
});
