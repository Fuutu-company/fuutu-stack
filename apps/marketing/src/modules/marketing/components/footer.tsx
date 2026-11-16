import { config } from "@fuutu/config";
import { AREA_CLASSES, AREAS, BrandLogo } from "@fuutu/ui";
import { cn } from "@fuutu/utils/cn";
import { useTranslations } from "next-intl";
import {
	FOOTER_ACTIONS,
	FOOTER_AREA_LINE,
	FOOTER_COLUMNS,
	FOOTER_TAGLINE_KEY,
} from "@/lib/site-links";
import { Link } from "@/navigation";
import { FOOTER_LINK_CLASS, FooterActionItem } from "./footer-action";

const LINK_CLASS = FOOTER_LINK_CLASS;

/** The four product areas as a 2×2 mark — the kit's signature in one glyph. */
function AreaMark() {
	return (
		<span aria-hidden="true" className="grid grid-cols-2 gap-[3px]">
			{AREAS.map((area) => (
				<span
					key={area}
					className={cn("size-2.5 rounded-[3px]", AREA_CLASSES[area].dot)}
				/>
			))}
		</span>
	);
}

const AreaLineMark =
	FOOTER_AREA_LINE &&
	(FOOTER_AREA_LINE.Mark === undefined ? AreaMark : FOOTER_AREA_LINE.Mark);

export function MarketingFooter() {
	const t = useTranslations();

	return (
		<footer className="mt-24 md:mt-32">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="grid gap-10 border-border border-t py-14 sm:grid-cols-2 md:grid-cols-4">
					<div className="flex flex-col gap-4">
						<div className="flex items-center gap-2.5">
							<BrandLogo size="md" className="dark:invert" />
							<p className="font-extrabold font-heading text-base tracking-heading">
								{config.app.name}
							</p>
						</div>
						<p className="max-w-xs text-muted-foreground text-sm leading-6">
							{t(FOOTER_TAGLINE_KEY)}
						</p>
					</div>
					{FOOTER_COLUMNS.map((column) => (
						<div key={column.titleKey}>
							<h2 className="mb-4 font-bold font-heading text-sm">
								{t(`footer.${column.titleKey}`)}
							</h2>
							<ul className="space-y-2.5 text-sm">
								{column.links.map((link) => (
									<li key={link.href}>
										{link.external ? (
											<a
												href={link.href}
												target="_blank"
												rel="noopener noreferrer"
												className={LINK_CLASS}
											>
												{t(link.labelKey)}
											</a>
										) : (
											<Link href={link.href} className={LINK_CLASS}>
												{t(link.labelKey)}
											</Link>
										)}
									</li>
								))}
								{FOOTER_ACTIONS.filter(
									(action) => action.column === column.titleKey,
								).map((action) => (
									<FooterActionItem
										key={action.key}
										action={action}
										label={t(action.labelKey)}
									/>
								))}
							</ul>
						</div>
					))}
				</div>
				<div className="flex flex-col items-start justify-between gap-4 border-border border-t py-8 text-muted-foreground text-sm sm:flex-row sm:items-center">
					<p>
						© <span data-volatile>{new Date().getFullYear()}</span>{" "}
						{config.app.name}. {t("footer.rights")}
					</p>
					{FOOTER_AREA_LINE && (
						<p className="flex items-center gap-2.5">
							{AreaLineMark && <AreaLineMark />}
							{t(FOOTER_AREA_LINE.textKey)}
						</p>
					)}
				</div>
			</div>
		</footer>
	);
}
