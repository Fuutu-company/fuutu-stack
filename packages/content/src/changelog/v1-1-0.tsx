export default function ChangelogV110() {
	return (
		<>
			<h3>Highlights</h3>
			<ul>
				<li>
					Marketing extension points: <code>app-marketing.tsx</code> (home
					sections — insert, replace or remove by key — pricing cards, page
					metadata, sitemap and robots overrides, a site-wide layout slot),{" "}
					<code>app-site-links.ts</code> (nav items, dropdowns, header brand,
					footer columns, removals) and <code>app-urls.ts</code>.
				</li>
				<li>
					Docs extension points: <code>app-docs-source.ts</code> (content dir,
					frontmatter, code themes) and more <code>appDocs</code> hooks — source
					link, Markdown for the llms routes, title template, OG image, sitemap,
					robots and layout slots.
				</li>
				<li>
					Seed and E2E extension points:{" "}
					<code>packages/db/prisma/app-seed.ts</code> runs after the kit seed;{" "}
					<code>tests/app-excluded.ts</code> skips kit E2E tests without editing{" "}
					<code>playwright.config.ts</code>.
				</li>
				<li>
					The kit no longer hard-codes demo plan ids — <code>getSeatPlan</code>,{" "}
					<code>getFreePlanId</code> and <code>getShowcasePlan</code> read your
					plan catalog.
				</li>
				<li>
					AI chat is metered on the <code>ai_tokens</code> credit meter (the
					conversation's organization, else the user): checked before the
					provider is called, consumed once per reply — partial replies included
					— at an estimated 4 characters per token. A blocked meter answers 402;{" "}
					<code>ai_tokens</code> allows overage, so it keeps going and records
					the overage.
				</li>
				<li>
					Org conversations require current membership: an ex-member can no
					longer read, continue or delete an org conversation they own, nor
					spend the org's credits.
				</li>
				<li>
					"Copy Markdown" on API reference pages includes method, path,
					parameters and the referenced schemas.
				</li>
				<li>
					The SaaS app's <code>/robots.txt</code> disallows crawling instead of
					redirecting to sign-in.
				</li>
				<li>
					Trials once per owner: <code>Plan.trialOnce</code>,{" "}
					<code>Plan.noTrialPriceIdEnvVars</code> (products without the trial,
					for Creem), <code>registerTrialEligibilityPolicy</code> and{" "}
					<code>skipTrial</code> on <code>payments.checkout.create</code>.
					Checkout guards see the decision as <code>ctx.trial</code>; a checkout
					that must skip a product-level trial without a no-trial product
					answers <code>trial_unavailable</code>.
				</li>
				<li>
					Cancel at the period end and resume:{" "}
					<code>payments.subscription.cancel</code> takes{" "}
					<code>atPeriodEnd</code>, <code>payments.subscription.resume</code>{" "}
					undoes it (Creem, Stripe, Polar). Seat changes take a per-call{" "}
					<code>proration</code> (<code>"charge-immediately"</code> or{" "}
					<code>"none"</code>) on Creem and Stripe.
				</li>
				<li>
					<code>config.features.webhooks</code> switches outgoing webhooks off:
					the org settings page and its sidebar item, the{" "}
					<code>webhooks.*</code> API, the retry job, event dispatch and the
					dashboard count. Incoming payment webhooks are not affected.
				</li>
				<li>
					<code>appContent.legal</code> replaces kit legal documents per slug
					and locale or publishes new <code>/legal/&lt;slug&gt;</code> pages.
				</li>
			</ul>
			<h3>Fixes</h3>
			<ul>
				<li>
					With i18n disabled, the marketing sitemap no longer lists{" "}
					<code>/de</code> URLs and docs pages emit no hreflang links.
				</li>
				<li>
					The contrast audit checks the primary hover color on every surface.
				</li>
				<li>
					The consent banner adds no blank scroll room on pages that fit the
					viewport.
				</li>
				<li>Biome checks files inside git worktrees.</li>
				<li>
					<code>pnpm test:visual:update</code> updates every visual spec,
					selected by title.
				</li>
			</ul>
			<h3>Breaking changes and migration</h3>
			<ul>
				<li>
					<code>POST /api/chat/messages/stream</code> and{" "}
					<code>POST /api/ai/chat</code> answer with an event stream (
					<code>text/event-stream</code>) instead of raw <code>text/plain</code>
					: one <code>message</code> event per text chunk (JSON string data),
					then a final <code>done</code> event; a failure mid-stream arrives as
					an <code>error</code> event. <code>/api/docs</code> describes it.
				</li>
				<li>
					<code>/settings/billing</code> answers 404 while billing is attached
					to organizations (the kit default) — billing lives on{" "}
					<code>/organizations/&lt;slug&gt;/settings/billing</code>.{" "}
					<code>assertCheckoutAllowed</code> returns <code>{"{ trial }"}</code>,
					and <code>CheckoutGuardContext</code> carries <code>trial</code> and{" "}
					<code>skipTrial</code>.
				</li>
				<li>
					On Creem, <code>payments.subscription.cancel</code> without{" "}
					<code>atPeriodEnd</code> now cancels immediately instead of using the
					store's default cancellation mode.
				</li>
			</ul>
		</>
	);
}
