import { describe, expect, it } from "vitest";
import { renderTemplate } from "../templates";
import { MAIL_COLORS } from "../templates/colors";
import { renderButton, renderLayout } from "../templates/layout";
import type { TemplateName, TemplatePayloads } from "../types";

const fixtures: { [K in TemplateName]: TemplatePayloads[K] } = {
	"password-reset": { name: "Rush", resetUrl: "https://app.test/reset?t=1" },
	"magic-link": { name: "Rush", magicLinkUrl: "https://app.test/magic?t=1" },
	"email-verification": {
		name: "Rush",
		verificationUrl: "https://app.test/verify?t=1",
	},
	"email-change-verification": {
		name: "Rush",
		verificationUrl: "https://app.test/verify-email?t=1",
		newEmail: "new@test.dev",
	},
	"organization-invitation": {
		organizationName: "Acme",
		inviteUrl: "https://app.test/invite?t=1",
		inviterName: "Admin",
	},
	"new-user": { name: "Rush", appUrl: "https://app.test/dashboard" },
	notification: {
		name: "Rush",
		title: "Plan upgraded",
		body: "Your workspace is now on the Pro plan.",
		appUrl: "https://app.test/settings/billing",
	},
};

const HEX = /(?<![&\w])#[0-9a-fA-F]{3,8}\b/g;

describe("MAIL_COLORS", () => {
	it("is the light Tactile palette", () => {
		expect(MAIL_COLORS).toEqual({
			page: "#f0f4f7",
			card: "#ffffff",
			border: "#d9dfe3",
			text: "#151b24",
			muted: "#545b66",
			button: "#181f2e",
			buttonText: "#f7f8fc",
		});
	});

	it.each(Object.keys(fixtures) as TemplateName[])(
		"%s contains no hex color outside MAIL_COLORS values",
		(name) => {
			const allowed = new Set(
				Object.values(MAIL_COLORS).map((c) => c.toLowerCase()),
			);
			const { html } = renderTemplate(name, fixtures[name]);
			const found = (html.match(HEX) ?? []).map((c) => c.toLowerCase());
			expect(found.length).toBeGreaterThan(0);
			expect(found.filter((c) => !allowed.has(c))).toEqual([]);
		},
	);

	it("renders the button with MAIL_COLORS.button", () => {
		const html = renderButton("https://app.test", "Go");
		expect(html).toContain(`background:${MAIL_COLORS.button}`);
		expect(html).toContain(`color:${MAIL_COLORS.buttonText}`);
		expect(html).toContain("border-radius:999px");
	});

	it("frames the card with the page and card colors and a 20px radius", () => {
		const html = renderLayout("<p>x</p>");
		expect(html).toContain(`background:${MAIL_COLORS.page}`);
		expect(html).toContain(`background:${MAIL_COLORS.card}`);
		expect(html).toContain("border-radius:20px");
	});
});
