export default function ChangelogV100De() {
	return (
		<>
			<h3>Highlights</h3>
			<ul>
				<li>
					Design-System: Brand-Tokens in <code>packages/config/brand.css</code>,
					der Design-Vertrag in <code>DESIGN.md</code>, ein Live-Styleguide
					unter <code>/design</code> und ein WCAG-AA-Kontrast-Audit.
				</li>
				<li>
					App-Erweiterungspunkte: <code>app-*.ts(x)</code>-Dateien für
					Navigation, Onboarding, Slots, Marketing, Docs, Seed-Daten und
					E2E-Ausnahmen — anpassen, ohne Kit-Dateien zu ändern, Kit-Updates
					sauber mergen.
				</li>
				<li>Multi-Scope-API-Keys: ein Key kann mehrere Scopes tragen.</li>
				<li>
					Pre-Auth-Throttling: fehlgeschlagene API-Key- und MCP-Prüfungen sind
					pro Client-IP rate-limitiert.
				</li>
				<li>
					<code>pnpm test:visual:local</code>: der Visual-Report lokal, ohne
					CI-Umweg.
				</li>
				<li>
					GitHub Pages deployt über Actions — kein <code>gh-pages</code>-Branch.
				</li>
				<li>
					<code>db:*</code>-Skripte nutzen die Datenbank des Port-Slots.
				</li>
			</ul>
			<h3>Breaking Changes und Migration</h3>
			<ul>
				<li>
					Brand-Tokens sind von <code>theme.css</code> nach{" "}
					<code>brand.css</code> umgezogen; <code>theme.css</code> gehört jetzt
					dem Kit.
				</li>
				<li>
					Die Tokens <code>--brand</code>, <code>--neutral</code> und{" "}
					<code>--primary-hover</code> entfallen — nutze die semantischen
					Tokens.
				</li>
				<li>
					Fonts laden über <code>next/font</code>; das Paket <code>geist</code>{" "}
					entfällt.
				</li>
				<li>
					<code>AuthCard</code> ist einspaltig.
				</li>
				<li>
					Farb-Helfer liegen in <code>@fuutu/ui/color</code>-Subpfaden.
				</li>
				<li>
					<code>/admin</code> leitet auf <code>/admin/users</code> weiter.
				</li>
			</ul>
		</>
	);
}
