import type { Locale } from "@fuutu/i18n";
import { describe, expect, it } from "vitest";
import { getMailStrings } from "../i18n";
import { renderTemplate } from "../templates";
import { escapeAttr, escapeHtml } from "../templates/layout";
import type { TemplateName, TemplatePayloads } from "../types";

const fixtures: { [K in TemplateName]: TemplatePayloads[K] } = {
	"password-reset": {
		name: "Rush",
		resetUrl: "https://app.test/reset?token=abc123",
	},
	"magic-link": {
		name: "Rush",
		magicLinkUrl: "https://app.test/magic?token=xyz",
	},
	"email-verification": {
		name: "Rush",
		verificationUrl: "https://app.test/verify?token=v1",
	},
	"email-change-verification": {
		name: "Rush",
		verificationUrl: "https://app.test/verify-email?token=v2",
		newEmail: "new@test.dev",
	},
	"organization-invitation": {
		organizationName: "Acme",
		inviteUrl: "https://app.test/invite?token=inv",
		inviterName: "Admin",
	},
	"new-user": {
		name: "Rush",
		appUrl: "https://app.test/dashboard",
	},
	notification: {
		name: "Rush",
		title: "Plan upgraded",
		body: "Your workspace is now on the Pro plan.",
		appUrl: "https://app.test/settings/billing",
	},
};

const templateNames = Object.keys(fixtures) as TemplateName[];

describe("renderTemplate", () => {
	it.each(templateNames)(
		"renders %s in en and de with subject/html/text",
		(name) => {
			for (const locale of ["en", "de"] as const) {
				const rendered = renderTemplate(name, {
					...fixtures[name],
					locale,
				});
				expect(rendered.subject).toBeTruthy();
				expect(rendered.text).toBeTruthy();
				expect(rendered.html).toContain("<!doctype html>");
				expect(rendered.html).toContain(`lang="${locale}"`);
				// guard against missing interpolation leaking into output
				expect(rendered.html).not.toContain("undefined");
				expect(rendered.text).not.toContain("undefined");
			}
		},
	);

	it("escapes a <script> payload in the notification template", () => {
		const xss = '<script>alert("xss")</script>';
		const rendered = renderTemplate("notification", {
			name: xss,
			title: xss,
			body: xss,
		});
		expect(rendered.html).not.toContain("<script>alert");
		expect(rendered.html).toContain("&lt;script&gt;");
	});

	it("escapes a <script> payload in user-controlled name fields", () => {
		const rendered = renderTemplate("password-reset", {
			name: '<script>alert("xss")</script>',
			resetUrl: "https://app.test/reset?token=abc123",
		});
		expect(rendered.html).not.toContain("<script>alert");
		expect(rendered.html).toContain("&lt;script&gt;");
	});

	it("escapes quotes in URLs so attributes cannot be broken out of", () => {
		const rendered = renderTemplate("password-reset", {
			resetUrl: 'https://app.test/reset?x=" onmouseover="alert(1)',
		});
		expect(rendered.html).not.toContain('" onmouseover="');
		expect(rendered.html).toContain("&quot;");
	});
});

describe("escapeHtml", () => {
	it("escapes &, <, > and double quotes", () => {
		expect(escapeHtml(`<a href="x">&`)).toBe(
			"&lt;a href=&quot;x&quot;&gt;&amp;",
		);
	});

	it("does not escape single quotes (use escapeAttr for attributes)", () => {
		expect(escapeHtml("it's")).toBe("it's");
	});
});

describe("escapeAttr", () => {
	it("additionally escapes single quotes", () => {
		expect(escapeAttr("it's <b>")).toBe("it&#39;s &lt;b&gt;");
	});
});

describe("getMailStrings", () => {
	it("defaults to the en bundle when no locale is given", () => {
		expect(getMailStrings().signature).toBe("— The Fuutu team");
		expect(getMailStrings("en").signature).toBe("— The Fuutu team");
	});

	it("returns the de bundle for de", () => {
		expect(getMailStrings("de").signature).toBe("— Dein Fuutu-Team");
	});

	it("resolves a BCP-47 parent before falling back to en", () => {
		// "de-AT" is not a configured Locale — cast simulates a locale the
		// app adds to i18nConfig before the mail bundle ships it.
		expect(getMailStrings("de-AT" as Locale).signature).toBe(
			"— Dein Fuutu-Team",
		);
		// "fr-CA" has no bundle and its parent "fr" is not configured → en.
		expect(getMailStrings("fr-CA" as Locale).signature).toBe(
			"— The Fuutu team",
		);
	});
});
