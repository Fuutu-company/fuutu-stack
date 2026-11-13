export default function ChangelogV010() {
	return (
		<ul>
			<li>
				Monorepo split into <code>apps/marketing</code> and{" "}
				<code>apps/saas</code>.
			</li>
			<li>
				Auth: email/password, magic-link, OAuth, 2FA, passkeys, organizations.
			</li>
			<li>
				Provider interfaces for payments (Creem), mail (Plunk), storage (S3),
				analytics (Umami).
			</li>
			<li>RBAC, audit logging, rate limiting, secure cookies, CSRF.</li>
			<li>Marketing content: blog, changelog, legal placeholders, sitemap.</li>
		</ul>
	);
}
