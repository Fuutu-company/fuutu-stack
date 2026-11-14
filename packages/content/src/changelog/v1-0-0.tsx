export default function ChangelogV100() {
	return (
		<>
			<h3>Highlights</h3>
			<ul>
				<li>
					Design system: brand tokens in <code>packages/config/brand.css</code>,
					the design contract in <code>DESIGN.md</code>, a live style guide at{" "}
					<code>/design</code> and a WCAG AA contrast audit.
				</li>
				<li>
					App extension points: <code>app-*.ts(x)</code> files for navigation,
					onboarding, slots, marketing, docs, seed data and E2E exclusions —
					customise without editing kit files, merge kit updates cleanly.
				</li>
				<li>Multi-scope API keys: one key can carry several scopes.</li>
				<li>
					Pre-auth throttling: failed API-key and MCP credential checks are
					rate-limited per client IP.
				</li>
				<li>
					<code>pnpm test:visual:local</code>: the visual report on disk, no CI
					round-trip.
				</li>
				<li>
					GitHub Pages deploys through Actions — no <code>gh-pages</code>{" "}
					branch.
				</li>
				<li>
					<code>db:*</code> scripts use the port slot's database.
				</li>
			</ul>
			<h3>Breaking changes and migration</h3>
			<ul>
				<li>
					Brand tokens moved from <code>theme.css</code> to{" "}
					<code>brand.css</code>; <code>theme.css</code> is kit-owned now.
				</li>
				<li>
					Removed the <code>--brand</code>, <code>--neutral</code> and{" "}
					<code>--primary-hover</code> tokens — use the semantic tokens.
				</li>
				<li>
					Fonts load through <code>next/font</code>; the <code>geist</code>{" "}
					package is gone.
				</li>
				<li>
					<code>AuthCard</code> is single-column.
				</li>
				<li>
					Color helpers moved to <code>@fuutu/ui/color</code> subpaths.
				</li>
				<li>
					<code>/admin</code> redirects to <code>/admin/users</code>.
				</li>
			</ul>
		</>
	);
}
