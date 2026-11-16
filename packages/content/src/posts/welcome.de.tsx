export default function WelcomePostDe() {
	return (
		<>
			<p>
				Willkommen — und danke, dass du Fuutu ausprobierst. Dieser erste Post
				ist bewusst kurz: Er existiert, damit die Blog-Route, die Sitemap und
				der OG-Image-Generator etwas Echtes zum Rendern haben, bevor du deine
				eigenen Inhalte schreibst.
			</p>
			<h2>Was drin ist</h2>
			<p>
				Das Kit bringt Auth, Payments, Mail, Storage, Audit-Logging,
				Rate-Limiting, RBAC, i18n, dateibasierte Inhaltssammlungen und
				Playwright-E2E-Tests mit — alles hinter Provider-Interfaces verdrahtet,
				so dass du jeden externen Service per Config-Switch austauschen kannst.
				Background-Jobs laufen über den eingebauten Cron-Runner (
				<code>@fuutu/cron</code>, ausgelöst über <code>/api/cron</code>), und
				Fehler lassen sich über <code>@fuutu/logs</code> an Sentry oder Axiom
				weiterleiten.
			</p>
			<h2>Was nicht drin ist</h2>
			<p>
				Real-Time-Sockets und ein Feature-Flag-Service gehören nicht zum Kit —
				ergänze sie hinter einem eigenen Provider-Interface, wenn dein Produkt
				sie braucht.
			</p>
			<h2>Diesen Post ersetzen</h2>
			<p>
				Leg dein eigenes <code>.tsx</code>-Modul in{" "}
				<code>packages/content/src/posts/</code> ab, registriere es in{" "}
				<code>src/index.tsx</code> und füge Locale-Begleitmodule als{" "}
				<code>&lt;slug&gt;.&lt;locale&gt;.tsx</code> hinzu. Der typisierte
				Frontmatter-Vertrag lebt in <code>@fuutu/content</code>.
			</p>
		</>
	);
}
