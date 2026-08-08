import type { ChangelogFrontmatter } from "../index";

export const frontmatter: ChangelogFrontmatter = {
	title: "Initial public release",
	publishedAt: "2026-04-26",
	version: "1.0.0",
	description:
		"First public release of the Fuutu Stack — monorepo split, provider interfaces, marketing site and SaaS app.",
};

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
				Provider interfaces for payments (Polar), mail (Plunk), storage (S3),
				analytics (Umami).
			</li>
			<li>RBAC, audit logging, rate limiting, secure cookies, CSRF.</li>
			<li>Marketing content: blog, changelog, legal placeholders, sitemap.</li>
		</ul>
	);
}
