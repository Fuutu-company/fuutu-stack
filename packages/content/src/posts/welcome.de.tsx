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
				Rate-Limiting, RBAC, i18n, MDX-Inhalte und Playwright-E2E-Tests mit —
				alles hinter Provider-Interfaces verdrahtet, so dass du jeden externen
				Service per Config-Switch austauschen kannst.
			</p>
			<h2>Was (noch) nicht drin ist</h2>
			<p>
				Background-Jobs, Real-Time-Sockets, Error-Tracking und Feature-Flags
				sind für v1.1 geplant. Die Provider-Interfaces stehen bereits — nur die
				aktiven Adapter fehlen.
			</p>
			<h2>Diesen Post ersetzen</h2>
			<p>
				Leg dein eigenes MDX unter <code>packages/content/src/posts/</code> ab.
				Der typisierte Frontmatter-Vertrag lebt in <code>@fuutu/content</code>.
			</p>
		</>
	);
}
