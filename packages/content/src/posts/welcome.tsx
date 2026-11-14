import type { PostFrontmatter } from "../index";

export const frontmatter: PostFrontmatter = {
	title: "Welcome to Fuutu",
	description:
		"A short introduction to the Fuutu Stack — what's inside, what isn't, and how to ship in days instead of months.",
	publishedAt: "2026-04-26",
	authors: ["Fuutu Team"],
	tags: ["announcements"],
};

export default function WelcomePost() {
	return (
		<>
			<p>
				Welcome — and thanks for taking Fuutu for a spin. This first post is
				deliberately short: it exists so the blog route, sitemap, and OG-image
				generator have something real to render before you write your own
				content.
			</p>
			<h2>What's inside</h2>
			<p>
				The kit ships with auth, payments, mail, storage, audit logging,
				rate-limiting, RBAC, i18n, file-based content collections and Playwright
				E2E tests — all wired against provider interfaces so you can swap any
				external service with a single config change. Background jobs run on the
				built-in cron runner (<code>@fuutu/cron</code>, triggered through{" "}
				<code>/api/cron</code>), and errors can drain to Sentry or Axiom through{" "}
				<code>@fuutu/logs</code>.
			</p>
			<h2>What's not inside</h2>
			<p>
				Real-time sockets and a feature-flag service are not part of the kit —
				add them behind your own provider interface when your product needs
				them.
			</p>
			<h2>Replace this post</h2>
			<p>
				Drop your own <code>.tsx</code> module into{" "}
				<code>packages/content/src/posts/</code>, register it in{" "}
				<code>src/index.tsx</code>, and add locale companions as{" "}
				<code>&lt;slug&gt;.&lt;locale&gt;.tsx</code>. The typed frontmatter
				contract lives in <code>@fuutu/content</code>.
			</p>
		</>
	);
}
