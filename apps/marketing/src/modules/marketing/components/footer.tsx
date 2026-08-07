import { BrandLogo } from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";

const DOCS_URL = "https://stack.fuutu.com/docs";

const COLUMNS = [
	{
		titleKey: "product",
		links: [
			{ href: "/#features", labelKey: "features" },
			{ href: "/pricing", labelKey: "pricing" },
			{ href: "/changelog", labelKey: "changelog" },
		],
	},
	{
		titleKey: "resources",
		links: [
			{ href: DOCS_URL, labelKey: "docs", external: true },
			{ href: "/blog", labelKey: "blog" },
		],
	},
	{
		titleKey: "companyAndLegal",
		links: [
			{ href: "/contact", labelKey: "contact" },
			{ href: "/legal/privacy", labelKey: "privacy" },
			{ href: "/legal/terms", labelKey: "terms" },
			{ href: "/legal/imprint", labelKey: "imprint" },
		],
	},
] as const;

const NAV_LABEL_KEYS = new Set([
	"features",
	"pricing",
	"docs",
	"blog",
	"changelog",
]);

export function MarketingFooter() {
	const t = useTranslations();

	const labelFor = (key: string) =>
		NAV_LABEL_KEYS.has(key) ? t(`nav.${key}`) : t(`footer.${key}`);

	return (
		<footer className="border-t">
			<div className="container mx-auto px-4 py-8">
				<div className="grid gap-8 md:grid-cols-4">
					<div className="md:col-span-1">
						<div className="mb-4 flex items-center gap-2">
							<BrandLogo size="md" className="dark:invert" />
							<h3 className="font-semibold">{t("app.brand")}</h3>
						</div>
						<p className="text-muted-foreground text-sm">
							{t("footer.tagline")}
						</p>
					</div>
					{COLUMNS.map((column) => (
						<div key={column.titleKey}>
							<h4 className="mb-4 font-semibold text-sm">
								{t(`footer.${column.titleKey}`)}
							</h4>
							<ul className="space-y-2 text-sm">
								{column.links.map((link) => (
									<li key={link.href}>
										{"external" in link && link.external ? (
											<a
												href={link.href}
												target="_blank"
												rel="noopener noreferrer"
												className="text-muted-foreground transition-colors hover:text-foreground"
											>
												{labelFor(link.labelKey)}
											</a>
										) : (
											<Link
												href={link.href}
												className="text-muted-foreground transition-colors hover:text-foreground"
											>
												{labelFor(link.labelKey)}
											</Link>
										)}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
				<div className="mt-8 border-t pt-8 text-center text-muted-foreground text-sm">
					© {new Date().getFullYear()} {t("app.brand")}. {t("footer.rights")}
				</div>
			</div>
		</footer>
	);
}
