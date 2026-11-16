import { Link } from "@/navigation";

const LINK_CLASS =
	"font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline";

interface NotFoundLinksProps {
	/** Accessible name of the link list. */
	label: string;
	/** Resolved links (`appMarketing.notFoundLinks`, labels translated). */
	links: readonly { href: string; label: string; external?: boolean }[];
	/**
	 * In-app href → URL for plain anchors (root 404, outside the intl
	 * provider). Unset: locale-aware `Link`.
	 */
	hrefFor?: (href: string) => string;
}

/** Section links under the 404 home button; nothing without app links. */
export function NotFoundLinks({ label, links, hrefFor }: NotFoundLinksProps) {
	if (links.length === 0) return null;
	return (
		<nav aria-label={label} className="mt-6">
			<ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
				{links.map((link) => (
					<li key={link.href}>
						{link.external ? (
							<a
								href={link.href}
								target="_blank"
								rel="noopener noreferrer"
								className={LINK_CLASS}
							>
								{link.label}
							</a>
						) : hrefFor ? (
							<a href={hrefFor(link.href)} className={LINK_CLASS}>
								{link.label}
							</a>
						) : (
							<Link href={link.href} className={LINK_CLASS}>
								{link.label}
							</Link>
						)}
					</li>
				))}
			</ul>
		</nav>
	);
}
