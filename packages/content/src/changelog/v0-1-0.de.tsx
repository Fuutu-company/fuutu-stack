export default function ChangelogV010De() {
	return (
		<ul>
			<li>
				Monorepo-Split in <code>apps/marketing</code> und <code>apps/saas</code>
				.
			</li>
			<li>
				Auth: E-Mail/Passwort, Magic-Link, OAuth, 2FA, Passkeys, Organizations.
			</li>
			<li>
				Provider-Interfaces für Payments (Polar), Mail (Plunk), Storage (S3),
				Analytics (Umami).
			</li>
			<li>RBAC, Audit-Logging, Rate-Limiting, sichere Cookies, CSRF.</li>
			<li>Marketing-Content: Blog, Changelog, Legal-Platzhalter, Sitemap.</li>
		</ul>
	);
}
