import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { PLAN_IDS, PLANS } from "../../../packages/payments/src/config";

/** English CTA label of every plan the marketing pricing page shows. */
function marketingPlanCtas(): string[] {
	const messages = JSON.parse(
		readFileSync(
			resolve(
				__dirname,
				"../../../packages/i18n/translations/en/common/payments.json",
			),
			"utf-8",
		),
	) as { payments: { plans: Record<string, { ctaLabel: string }> } };
	return PLAN_IDS.filter((id) => PLANS[id].showInMarketing).map(
		(id) => messages.payments.plans[id]?.ctaLabel ?? id,
	);
}

// Base Playwright `test` on purpose: the shared fixture pre-accepts consent,
// this spec needs the banner on screen.
test.describe("consent banner", () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test("never covers a focused plan CTA or the end of the page", async ({
		page,
	}) => {
		await page.goto("/en/pricing");
		const banner = page.getByRole("dialog", { name: /analytics/i });
		const shown = await banner
			.waitFor({ state: "visible", timeout: 5_000 })
			.then(() => true)
			.catch(() => false);
		test.skip(!shown, "Consent banner disabled in this environment");

		const overlapsBanner = (selector: string, text?: string) =>
			page.evaluate(
				({ selector, text }) => {
					const bannerEl = document.querySelector('[role="dialog"]');
					const target = [...document.querySelectorAll(selector)].find(
						(el) =>
							el.getBoundingClientRect().width > 0 &&
							(text === undefined || el.textContent?.trim() === text),
					);
					if (!bannerEl || !(target instanceof HTMLElement)) {
						throw new Error(`missing ${selector} ${text ?? ""}`);
					}
					window.scrollTo(0, 0);
					target.focus();
					const b = bannerEl.getBoundingClientRect();
					const r = target.getBoundingClientRect();
					return !(
						r.bottom <= b.top ||
						r.top >= b.bottom ||
						r.right <= b.left ||
						r.left >= b.right
					);
				},
				{ selector, text },
			);

		const ctas = marketingPlanCtas();
		expect(ctas.length).toBeGreaterThan(0);
		for (const cta of ctas) {
			expect(await overlapsBanner("main a, main button", cta), cta).toBe(false);
		}

		// Scrolled to the very end, the footer ends above the banner.
		const footerClear = await page.evaluate(() => {
			window.scrollTo(0, document.documentElement.scrollHeight);
			const footer = document.querySelector("footer")?.getBoundingClientRect();
			const b = document
				.querySelector('[role="dialog"]')
				?.getBoundingClientRect();
			return footer && b ? footer.bottom <= b.top : false;
		});
		expect(footerClear).toBe(true);
	});
});
