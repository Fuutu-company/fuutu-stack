import { buildPricingTiers } from "@fuutu/payments/plans";
import { publicProcedure } from "../../../../orpc";

/**
 * `buildPricingTiers` requires a `PlanTranslationResolver`, but the API
 * package has no next-intl / `@fuutu/i18n` dependency and runs outside the
 * Next.js request scope, so it cannot load locale-aware translations here.
 *
 * Plan copy (name, description, feature labels, CTA) is localized by the
 * consumer via next-intl — see `apps/saas/.../choose-plan.tsx`, which calls
 * `buildPricingTiers` with a real resolver. This endpoint returns plan
 * structure and pricing only; the string fields are intentionally empty and
 * must be filled by the client before rendering.
 *
 * To return localized tiers from the API instead, add `@fuutu/i18n` +
 * next-intl as a dependency and resolve the locale from the request headers
 * here, then replace this resolver with one backed by the loaded namespace.
 */
const noopTranslationResolver = () => ({
	name: "",
	description: "",
	featureLabels: {},
	ctaLabel: "",
});

export const listPlans = publicProcedure
	.route({
		method: "GET",
		path: "/payments/plans",
		tags: ["Payments"],
		summary: "List pricing plans",
		description: "Returns all available pricing tiers for the SaaS audience.",
	})
	.handler(async () => {
		const tiers = buildPricingTiers({
			audience: "saas",
			t: noopTranslationResolver,
		});
		return { items: tiers };
	});
