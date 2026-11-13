import { config } from "@fuutu/config";
import { BrandLogo } from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { FOOTER_COLUMNS } from "@/lib/site-links";
import { Link } from "@/navigation";

export function MarketingFooter() {
	const t = useTranslations();

	return (
		<footer className="border-t">
			<div className="container mx-auto px-4 py-8">
				<div className="grid gap-8 md:grid-cols-4">
					<div className="md:col-span-1">
						<div className="mb-4 flex items-center gap-2">
							<BrandLogo size="md" className="dark:invert" />
							<h3 className="font-semibold">{config.app.name}</h3>
						</div>
						<p className="text-muted-foreground text-sm">
							{t("footer.tagline")}
						</p>
					</div>
					{FOOTER_COLUMNS.map((column) => (
						<div key={column.titleKey}>
							<h4 className="mb-4 font-semibold text-sm">
								{t(`footer.${column.titleKey}`)}
							</h4>
							<ul className="space-y-2 text-sm">
								{column.links.map((link) => (
									<li key={link.href}>
										{link.external ? (
											<a
												href={link.href}
												target="_blank"
												rel="noopener noreferrer"
												className="text-muted-foreground transition-colors hover:text-foreground"
											>
												{t(link.labelKey)}
											</a>
										) : (
											<Link
												href={link.href}
												className="text-muted-foreground transition-colors hover:text-foreground"
											>
												{t(link.labelKey)}
											</Link>
										)}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
				<div className="mt-8 border-t pt-8 text-center text-muted-foreground text-sm">
					© <span data-volatile>{new Date().getFullYear()}</span>{" "}
					{config.app.name}. {t("footer.rights")}
				</div>
			</div>
		</footer>
	);
}
