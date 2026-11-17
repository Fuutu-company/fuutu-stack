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
				<li>
					<code>appMarketing.sitemapExclude</code> drops entries from{" "}
					<code>/sitemap.xml</code> per path and locale — kit pages, legal
					pages, blog posts and app routes — together with their hreflang
					alternates. Page metadata overrides take <code>robots</code>, and{" "}
					<code>metadata.blogPost</code> covers every{" "}
					<code>/blog/&lt;slug&gt;</code> post.
				</li>
				<li>
					<code>appSlots.headerActions</code> renders app UI in the desktop top
					bar, right before the notification bell — rendered by the server
					layout, so it may be a server component.
				</li>
				<li>
					<code>authConfig.organizations.organizationLimit</code> caps how many
					organizations a user may belong to and still create another one
					(unset: no cap). <code>organizations.create</code> answers{" "}
					<code>FORBIDDEN</code> at the cap instead of a 500.
				</li>
				<li>
					Community help moved into the app: README, contributing guide and
					issue templates point to <code>app.fuutustack.com</code> (Support).
				</li>
				<li>
					The consent banner has two modes. Providers that track without consent
					(Umami) get a notice — anonymous, cookieless analytics already run —
					with "OK" and "Opt out"; the opt-out is remembered and also stops an
					already-loaded script. Providers that need consent, and{" "}
					<code>NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT=true</code>, keep Accept /
					Decline. A "Privacy settings" link reopens the banner: in the
					marketing footer, the SaaS user menu and auth pages, and the docs
					sidebar and home page. The Umami script loads with{" "}
					<code>data-do-not-track="true"</code>.
				</li>
				<li>
					<code>appMail.legalFooter</code> (
					<code>packages/mail/src/app-mail.ts</code>) adds company details —
					e.g. what § 35a GmbHG requires — under every transactional email, in
					the HTML and the plain-text part. A string, a list of lines or a
					function of the recipient locale; unset, the emails are unchanged.
				</li>
				<li>
					<code>authConfig.session</code> documents the session lifetime for
					your privacy policy: 30 days, extended at most once a day, a 5-minute
					session cookie cache.
				</li>
				<li>
					<code>appDocs.Home</code> replaces the docs home content inside the
					kit home layout (nav, search, theme and language stay the kit's).
				</li>
				<li>
					Plain icons: icons are drawn as plain strokes in a text role or an
					area ink, never on a round or filled chip (DESIGN.md Iconography). The{" "}
					<code>icon-chip-guard</code> keeps chips out and lists real avatars,
					counters and controls with their reason.
				</li>
				<li>
					<code>SecretRevealDialog</code> (<code>@fuutu/ui</code>) shows a key
					or secret exactly once: in full and wrapped, selectable, and an
					outside click does not close it. A failed copy selects the secret and
					shows a hint instead of throwing. New API keys and webhook signing
					secrets use it.
				</li>
				<li>
					Create an API key from anywhere with <code>CreateApiKeyButton</code>{" "}
					(create dialog, then the reveal): <code>presetScopes</code>,{" "}
					<code>triggerLabel</code>, <code>triggerVariant</code> and a{" "}
					<code>createdHint</code> under the key. The create dialog starts fresh
					on every open. <code>ApiKeyList</code> takes{" "}
					<code>variant="section"</code>, <code>scope</code> (lists only keys
					with that scope and presets new ones), <code>manageHref</code> and{" "}
					<code>createdHint</code>; <code>ApiKeyStatusBadge</code> is exported.{" "}
					<code>apiKeys.list</code> accepts a <code>scope</code> filter.
				</li>
				<li>
					<code>AppOrgSettingsNavItem.replaces</code> puts an app item in place
					of a kit org-settings item (e.g. one "Keys" page instead of "API
					keys") without rewording kit text; the kit route keeps working.
				</li>
				<li>
					System admin area under <code>/admin</code>: users and organizations
					(search, detail pages, support actions with a reason), impersonation
					with a time limit and banner, a filterable audit log and a read-only
					system status page. Every action runs through the audited{" "}
					<code>admin.*</code> oRPC procedures; irreversible ones (ban, set
					role, delete, impersonate) write their audit row before they run and
					an <code>_failed</code> row when they then fail. New config:{" "}
					<code>authConfig.admin.impersonationMinutes</code> (default 60),{" "}
					<code>authConfig.organizations.invitationExpiresIn</code> (default 48
					h) and <code>authConfig.admin.exposeAuthEndpoints</code> (default{" "}
					<code>false</code>).
				</li>
				<li>
					Security hardening from a full review of auth, admin, API, payments,
					storage, headers and CI: closed Better Auth organization and admin
					endpoints, verified-email and fresh-session gates for API keys,
					passkeys, 2FA, MCP consent and email change, a reversed refund and
					dispute path, pinned webhook delivery, per-object image-proxy checks,
					a request body limit and hardened response headers. All auth security
					policies are wired through one module,{" "}
					<code>packages/auth/src/security/index.ts</code>, which lists each
					policy, its paths and its config knob.
				</li>
				<li>
					Payments: the billing portal opens for the payer only, Stripe
					activates only on paid checkouts, full refunds and disputes are
					reversed on every provider (early ones are retried), trials run once
					per user and organization, organization checkouts bill at least the
					member count (daily <code>seat-reconcile</code> job), and the same
					plan cannot be bought twice. New extension point{" "}
					<code>registerSeatGate</code>; <code>createCheckoutLink</code> also
					returns the provider's <code>checkoutId</code>.
				</li>
				<li>
					<code>apiConfig.apiKeyMaxLifetimeDays</code> caps the lifetime of API
					keys (unset: no cap); <code>requireScopes()</code> in{" "}
					<code>@fuutu/mcp</code> restricts MCP tools to OAuth scopes.
				</li>
				<li>
					Architecture guards are split: <code>arch/*</code> in{" "}
					<code>@fuutu/test-utils</code> are kit invariants and run in every{" "}
					<code>pnpm test</code>; <code>arch/kit-source/*</code> guard the kit's
					own demo files and CI layout and run only in the kit repository (
					<code>pnpm -F @fuutu/test-utils test:kit-source</code>), so you can
					change your UI and CI without red tests.
				</li>
			</ul>
			<h3>Changes</h3>
			<ul>
				<li>
					<code>LICENSE.md</code> is the Fuutu Business License 1.3: prices are
					no longer part of the license (only the published pricing page), and
					contributions follow the terms in <code>CONTRIBUTING.md</code> (MIT-0
					and a Developer Certificate of Origin sign-off).
				</li>
				<li>
					Telemetry sends only the five fields LICENSE.md §7 lists:{" "}
					<code>kitName</code>, <code>kitVersion</code>,{" "}
					<code>licenseKeyHash</code>, <code>appUrl</code> and the new{" "}
					<code>kind</code> (<code>build</code> or <code>runtime</code>).{" "}
					<code>nodeVersion</code>, <code>platform</code>, <code>features</code>{" "}
					and <code>sentAt</code> are gone. Pings come only from CI or
					production builds and from production runtimes — never from a dev
					server or a plain local build.
				</li>
				<li>
					<code>config.features.legalPages</code> (new, default on) links the
					marketing imprint and privacy pages from the saas auth pages and user
					menu, the docs sidebar and the consent banner.
				</li>
				<li>
					<code>APP_PUBLIC_PREFIXES</code> in <code>proxy-public.ts</code> also
					takes <code>{'{ exact: "/path" }'}</code> for a single public path; a
					string entry still matches by prefix.
				</li>
				<li>
					Port slots: <code>pnpm ports release [path]</code> frees a project's
					slot and <code>pnpm ports prune</code> lists (and with{" "}
					<code>--yes</code> drops) slots whose folder is gone, each offering to
					drop the slot's local database and buckets.{" "}
					<code>pnpm dev:session reset</code> restarts the apps with an empty
					Turbopack dev cache.
				</li>
				<li>
					Payment providers report typed failures (
					<code>ProviderRequestError</code> with <code>kind</code>{" "}
					<code>not_found</code>, <code>invalid_state</code>,{" "}
					<code>rejected</code> or <code>unavailable</code>); the API passes the
					kind on and the billing views show a matching message.
				</li>
			</ul>
			<h3>Fixes</h3>
			<ul>
				<li>
					While impersonating, billing actions and API-key creation are disabled
					up front with the reason, and every refusal says "Not available while
					you're signed in as this user (impersonation)" instead of a generic
					error. <code>denyImpersonation</code> errors carry{" "}
					<code>data.code: "IMPERSONATION_FORBIDDEN"</code>, like Better Auth's
					guard.
				</li>
				<li>
					Another organization's pages answer 404 to non-members before the app
					shell renders — no "Something went wrong", no org name.
				</li>
				<li>
					Onboarding resumes at the step reached after a reload, and in forced
					organizations mode skips the organization step once the user belongs
					to one — one sign-up no longer creates several organizations.
				</li>
				<li>
					<code>/auth/verify-email-change</code> reports success only when the
					session carries the new email; <code>/auth/reset-password</code>{" "}
					checks the token first and offers a new link when it is missing,
					unknown or expired.
				</li>
				<li>Org breadcrumbs show the organization's name, not its slug.</li>
				<li>
					The admin user page's Billing tab lists the user's organizations with
					their plan and purchases, next to personal purchases.
				</li>
				<li>
					<code>/robots.txt</code> is public as an exact path, not as a prefix.
				</li>
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
				<li>
					The marketing layout no longer clips the shadow and focus ring of the
					last card on a page (<code>main</code> uses{" "}
					<code>overflow-x-clip</code>).
				</li>
				<li>
					Dialogs fit the screen: a 16 px inset on phones, a maximum height with
					scrolling, gaps between stacked footer buttons, and the content column
					no longer grows past the dialog (a long API key pushed "I've copied
					it" outside).
				</li>
				<li>
					The API key lists show every key: they load 100 per page with a "Load
					more" button instead of silently stopping at 50.
				</li>
				<li>
					The <code>versioning</code> scope description says what it is for:
					letting a release workflow compute the next app version.
				</li>
				<li>
					Withdrawing consent stops an analytics script that is already loaded:
					through the provider's <code>installConsentGate</code>, or, for a
					provider without one, by reloading the page. Self-hosted Umami needs
					v2.18.0 or later for the opt-out to stop auto-tracking (
					<code>data-before-send</code>).
				</li>
			</ul>
			<h3>Breaking changes and migration</h3>
			<ul>
				<li>
					Telemetry payload and gating: a receiver or proxy that expected{" "}
					<code>nodeVersion</code>, <code>platform</code>, <code>features</code>{" "}
					or <code>sentAt</code> gets <code>kind</code> instead. Local builds
					and dev servers no longer ping; set <code>CI</code> or{" "}
					<code>NODE_ENV=production</code> for a build that should (Docker
					builds count as production). <code>FUUTU_TELEMETRY_DISABLED=1</code>{" "}
					still turns it off for non-production instances only (LICENSE.md §7).
				</li>
				<li>
					<code>requireOrgMembership</code> answers 404 (<code>notFound()</code>
					) for an unknown org or a non-member instead of redirecting to{" "}
					<code>/organizations</code>.
				</li>
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
				<li>
					Custom consent UIs built on <code>useConsent()</code>: show the banner
					while <code>open</code> is true (it covers the reopen and the new
					notice answer <code>"acknowledged"</code>) instead of checking{" "}
					<code>status === "unknown"</code>.
				</li>
				<li>
					<code>AreaIcon</code> draws the icon in the area ink without a fill or
					radius (sizes: 16 px <code>sm</code>, 20 px <code>md</code>). The
					marketing <code>AreaCutoutIcon</code> is removed; the hero cards use{" "}
					<code>AreaIcon</code>. Update your visual baselines.
				</li>
				<li>
					Security: org members can no longer revoke or delete other people's
					org API keys, an admin's included.{" "}
					<code>PERMISSIONS.API_KEY.DELETE</code> moved from the member to the
					admin tier of <code>ORG_POLICY</code>; a member still revokes the keys
					they created. <code>apiKeys.list</code> items carry{" "}
					<code>canRevoke</code>, and the list shows Revoke only there.
				</li>
				<li>
					<code>DialogContent</code> defaults to{" "}
					<code>max-w-[calc(100%-2rem)] sm:max-w-lg</code>. Override the width
					with <code>sm:max-w-*</code>; a bare <code>max-w-*</code> drops the
					phone inset. Update your visual baselines.
				</li>
				<li>
					<code>adminProcedure</code> is{" "}
					<code>systemAdminProcedure(PERMISSIONS.VIEW_ADMIN)</code>: it re-reads
					the caller's role and ban from the database on every call and rejects
					API keys and impersonation sessions with 403, whatever their scopes.
				</li>
				<li>
					Better Auth's admin endpoints (<code>/api/auth/admin/*</code>,{" "}
					<code>authClient.admin.*</code>) answer 404 and are no longer listed
					in <code>/api/docs</code>. Call the <code>admin.*</code> procedures
					instead (e.g. <code>admin.users.ban</code>,{" "}
					<code>admin.users.setRole</code>, <code>admin.users.impersonate</code>
					). To keep the old endpoints, set{" "}
					<code>authConfig.admin.exposeAuthEndpoints: true</code> — they then
					bypass the reason, audit row and guards of the procedures.
				</li>
				<li>
					Impersonation sessions are rejected by the payments, API-key, webhook
					and organization mutations (<code>denyImpersonation</code>) and by{" "}
					<code>users.updateProfile</code>; Better Auth's account, 2FA, passkey,
					organization, <code>/update-user</code> and session-revoke endpoints
					answer 403 (<code>IMPERSONATION_FORBIDDEN</code>). A test fails when a
					new mutation in these modules forgets the guard. The onboarding name
					step is closed while impersonating and points support to the admin
					user page.
				</li>
				<li>
					An impersonation ends after{" "}
					<code>authConfig.admin.impersonationMinutes</code>, counted from its
					start: the session is deleted, the expiry is audited (
					<code>admin.user.impersonate_expired</code>) and the admin is signed
					out.
				</li>
				<li>
					An impersonation also ends as soon as the impersonating admin is
					demoted, banned or deleted: the session is deleted, the end is audited
					once (<code>admin.user.impersonate_ended_lost_access</code>) and the
					browser is signed out, so restoring the role does not revive it — not
					even from the cookie-cached session.
				</li>
				<li>
					A temporary ban ends at <code>banExpires</code>: the server guards,
					the API and the admin badges treat an expired ban as lifted (
					<code>isBanActive</code> from <code>@fuutu/auth/types</code>).
				</li>
				<li>
					The admin sidebar group lists Users, Organizations, Audit logs and
					System, in that order. An app item with{" "}
					<code>after: "adminUsers"</code> now sits before Organizations.
				</li>
				<li>
					<strong>Deployment:</strong> <code>TRUST_PROXY_HEADERS</code> is
					required in production (<code>0</code> or <code>1</code>). Behind a
					proxy that writes <code>X-Forwarded-For</code> (Coolify, Traefik) set{" "}
					<code>1</code>; behind a CDN also set{" "}
					<code>TRUSTED_CLIENT_IP_HEADER</code> (e.g.{" "}
					<code>cf-connecting-ip</code>). The compose files require it
					explicitly.
				</li>
				<li>
					<strong>Deployment:</strong> production refuses the{" "}
					<code>BETTER_AUTH_SECRET</code> value that used to be in{" "}
					<code>.env.example</code> (public git history), any secret shorter
					than 32 characters and a non-https <code>BETTER_AUTH_URL</code>.
					Rotate the secret if a deployment ever used the old value.
				</li>
				<li>
					<strong>Deployment:</strong> credentialed CORS is opt-in (
					<code>CORS_CREDENTIALS=1</code>; <code>CORS_ORIGIN</code> is trusted
					only with it), and the compose files publish their ports on{" "}
					<code>127.0.0.1</code> only. Seeding the docker host{" "}
					<code>postgres</code> needs <code>FUUTU_ALLOW_SEED=1</code>.
				</li>
				<li>
					Better Auth organization mutations (
					<code>authClient.organization.create</code>, <code>update</code>,{" "}
					<code>delete</code>, <code>inviteMember</code>,{" "}
					<code>updateMemberRole</code>, <code>removeMember</code>,{" "}
					<code>cancelInvitation</code>, <code>listInvitations</code>) are
					closed over HTTP; use the oRPC procedures. To keep them, set{" "}
					<code>authConfig.organizations.exposeAuthEndpoints: true</code>.
					Listing invitations needs <code>INVITE_MEMBER</code>.
				</li>
				<li>
					The admin "Mark email verified" action is replaced by an audited "Send
					verification email" (<code>admin.users.sendVerificationEmail</code>
					); <code>admin.users.update</code> accepts only{" "}
					<code>emailVerified: false</code>.
				</li>
				<li>
					API-key creation, passkey registration, 2FA enablement, MCP OAuth
					consent and an email change need a verified email. API keys, passkeys,
					an email change and the deletion of a passwordless account also need a
					fresh session (<code>authConfig.session.freshSessionMaxAge</code>, 15
					minutes).
				</li>
				<li>
					<code>/delete-user</code> needs the password, or a fresh session for
					accounts without one; it refuses sole owners and aborts when a
					subscription cancel fails.
				</li>
				<li>
					An email change is confirmed on the current address and the old
					address gets a notice. A password reset revokes sessions, OAuth tokens
					and API keys (audit-logged).
				</li>
				<li>
					MCP <code>whoami</code> needs the <code>profile</code> and{" "}
					<code>email</code> scopes on OAuth tokens; API-key principals are
					unaffected.
				</li>
				<li>
					Webhook create, update and delete are admin-tier and session-only;
					stored receiver response bodies are never returned.
				</li>
				<li>
					<code>createCheckoutLink</code> returns{" "}
					<code>{"{ url, checkoutId? }"}</code> instead of a string; a same-plan
					checkout on a subscription scheduled to cancel answers{" "}
					<code>resume_instead</code>.
				</li>
			</ul>
		</>
	);
}
