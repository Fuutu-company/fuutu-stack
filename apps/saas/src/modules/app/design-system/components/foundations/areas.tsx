import {
	AREAS,
	type Area,
	AreaBackdrop,
	AreaBadge,
	AreaIcon,
	AreaTile,
	Button,
	PageHeader,
} from "@fuutu/ui";
import {
	CreditCard,
	type LucideIcon,
	Sparkles,
	UserPlus,
	Users,
	Webhook,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { richCode } from "../design-section";
import { DesignSubsection } from "../design-subsection";

const AREA_ICONS: Record<Area, LucideIcon> = {
	users: Users,
	billing: CreditCard,
	ai: Sparkles,
	api: Webhook,
};

export async function Areas() {
	const t = await getTranslations("designSystem.foundations.areas");

	return (
		<DesignSubsection
			title={t("title")}
			description={t.rich("description", richCode)}
		>
			<div className="space-y-6">
				<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
					{AREAS.map((area) => {
						const Icon = AREA_ICONS[area];
						return (
							<li key={area} data-testid="area-swatch" data-area={area}>
								<AreaTile
									area={area}
									title={t(`items.${area}.covers`)}
									value={area}
									icon={<Icon />}
									description={
										<span className="flex flex-col gap-0.5 font-mono text-[11px]">
											<code className="break-all">{`--area-${area}`}</code>
											<code className="break-all">{`--area-${area}-foreground`}</code>
										</span>
									}
								/>
							</li>
						);
					})}
				</ul>

				<div className="grid gap-6 lg:grid-cols-2">
					<div className="space-y-3">
						<h4 className="font-semibold text-sm">{t("markers")}</h4>
						<ul className="flex flex-wrap items-center gap-3">
							{AREAS.map((area) => {
								const Icon = AREA_ICONS[area];
								return (
									<li key={area} className="flex items-center gap-2">
										<AreaIcon area={area} size="sm">
											<Icon />
										</AreaIcon>
										<AreaIcon area={area}>
											<Icon />
										</AreaIcon>
										<AreaBadge area={area}>{t(`items.${area}.name`)}</AreaBadge>
									</li>
								);
							})}
						</ul>
					</div>

					<div className="space-y-3">
						<h4 className="font-semibold text-sm">{t("header.label")}</h4>
						{/* A picture of the pattern: its h1 and button stay out of the page outline and tab order. */}
						<div
							aria-hidden="true"
							inert
							className="relative isolate overflow-hidden rounded-2xl p-6 shadow-sm ring-1 ring-foreground/5"
						>
							<AreaBackdrop />
							<PageHeader
								area="users"
								icon={<Users />}
								title={t("header.title")}
								description={t("header.description")}
								actions={
									<Button size="sm">
										<UserPlus aria-hidden="true" />
										{t("header.action")}
									</Button>
								}
							/>
						</div>
					</div>
				</div>
			</div>
		</DesignSubsection>
	);
}
