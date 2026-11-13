import { cn } from "@fuutu/utils/cn";
import { getTranslations } from "next-intl/server";
import { TYPE_ROLES } from "../../tokens";
import { richCode } from "../design-section";
import { DesignSubsection } from "../design-subsection";

export async function Typography() {
	const t = await getTranslations("designSystem.foundations.type");

	return (
		<DesignSubsection
			title={t("title")}
			description={t.rich("description", richCode)}
		>
			<ul className="divide-y overflow-hidden rounded-2xl bg-card text-card-foreground shadow-sm ring-1 ring-foreground/5">
				{TYPE_ROLES.map(({ key, spec, className }) => (
					<li
						key={key}
						data-type-role={key}
						className="grid gap-x-8 gap-y-2 p-5 md:grid-cols-[13rem_minmax(0,1fr)] md:items-baseline"
					>
						<div className="space-y-1">
							<p className="font-semibold text-sm">{t(`roles.${key}.name`)}</p>
							<code className="block break-words font-mono text-muted-foreground text-xs leading-4">
								{spec}
							</code>
							<p className="text-muted-foreground text-xs leading-4">
								{t(`roles.${key}.use`)}
							</p>
						</div>
						<p className={cn("min-w-0 text-balance", className)}>
							{t(`roles.${key}.sample`)}
						</p>
					</li>
				))}
			</ul>
		</DesignSubsection>
	);
}
