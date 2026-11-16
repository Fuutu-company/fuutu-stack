import { config } from "@fuutu/config";
import { i18nConfig } from "@fuutu/i18n/config";
import { PLAN_IDS, PLANS, type Plan } from "@fuutu/payments/config";
import {
	FEATURE_GROUPS,
	formatLimit,
	getLimit,
	getPricingFeaturesForPlan,
} from "@fuutu/payments/features";
import {
	buildPricingTiers,
	type PlanTranslations,
} from "@fuutu/payments/plans";
import {
	Button,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	type FeatureMatrixRow,
	type LogoItem,
	LogoItemCard,
	LogoRail,
	MacFrame,
	MediaFrame,
	MeshGradient,
	PricingCompact,
	PricingFull,
	StatsCard,
} from "@fuutu/ui";
import { Blocks, ChevronsUpDown, CreditCard, Languages } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { AuthDemo } from "./auth-demo";
import { richCode } from "./design-section";
import { DesignSubsection } from "./design-subsection";
import { PricingParts } from "./pricing-parts";

const STACK_LOGOS = [
	{ id: "nextjs", logo: "/logo/nextjs.svg", logoAlt: "Next.js" },
	{ id: "typescript", logo: "/logo/typescript.svg", logoAlt: "TypeScript" },
	{ id: "better-auth", logo: "/logo/better-auth.svg", logoAlt: "Better Auth" },
	{
		id: "prisma",
		logo: "/logo/prisma.svg",
		logoAlt: "Prisma",
		invertInDark: true,
	},
	{ id: "postgresql", logo: "/logo/postgresql.svg", logoAlt: "PostgreSQL" },
	{ id: "tailwind", logo: "/logo/tailwindcss.svg", logoAlt: "Tailwind CSS" },
	{ id: "turborepo", logo: "/logo/turborepo.svg", logoAlt: "Turborepo" },
	{ id: "hono", logo: "/logo/hono.svg", logoAlt: "Hono" },
] as const;

export async function Patterns() {
	const t = await getTranslations("designSystem.patterns");
	const payments = await getTranslations("payments");
	const format = await getFormatter();

	const resolvePlan = (id: keyof typeof PLANS): PlanTranslations => ({
		name: payments(`plans.${id}.name`),
		description: payments(`plans.${id}.description`),
		priceSuffix: payments(`plans.${id}.priceSuffix`),
		yearlyPriceSuffix: payments(`plans.${id}.yearlyPriceSuffix`),
		featureLabels: payments.raw(`plans.${id}.featureLabels`) as Record<
			string,
			string
		>,
		ctaLabel: payments(`plans.${id}.ctaLabel`),
	});

	const tiers = buildPricingTiers({
		audience: "saas",
		t: resolvePlan,
		hrefFor: () => "/choose-plan",
	});

	const rawFeatures = payments.raw("features") as Record<
		string,
		Record<string, string> | string
	>;
	const featureLabel = (id: string): string => {
		const [prefix = "", ...rest] = id.split("_");
		const section = rawFeatures[prefix];
		return typeof section === "object" ? (section[rest.join("_")] ?? id) : id;
	};
	const tooltips = rawFeatures.tooltips as Record<string, string>;
	const groups = rawFeatures.groups as Record<string, string>;
	// Matrix rows: every feature of the contact-sales (custom) plan — the
	// top of the catalog — else of the last plan.
	const matrixPlanId =
		PLAN_IDS.find((id) => (PLANS[id] as Plan).billingType === "custom") ??
		PLAN_IDS.at(-1);
	const matrixFeatures = matrixPlanId
		? getPricingFeaturesForPlan(matrixPlanId)
		: [];
	const featureMatrix: FeatureMatrixRow[] = matrixFeatures.map((feature) => ({
		id: feature.id,
		label: featureLabel(feature.id),
		group: feature.group,
		tooltip: tooltips[feature.id],
		values: Object.fromEntries(
			tiers.map((tier) => {
				if (!tier.featureIds.includes(feature.id)) return [tier.id, false];
				return [
					tier.id,
					feature.limitKey
						? formatLimit(
								getLimit(tier.id as keyof typeof PLANS, feature.limitKey),
							)
						: true,
				];
			}),
		),
	}));
	const featureGroupLabels = Object.fromEntries(
		FEATURE_GROUPS.map((group) => [group, groups[group] ?? group]),
	);

	const logos: LogoItem[] = STACK_LOGOS.map((item) => ({
		...item,
		name: t(`logos.items.${item.id}.name`),
		description: t(`logos.items.${item.id}.description`),
		detail: t(`logos.items.${item.id}.detail`),
	}));

	return (
		<div className="space-y-14">
			<DesignSubsection
				title={t("stats.title")}
				description={t("stats.description")}
			>
				<div className="grid gap-4 md:grid-cols-3">
					<StatsCard
						title={t("stats.locales.title")}
						value={format.number(Object.keys(i18nConfig.locales).length)}
						description={t("stats.locales.description")}
						icon={Languages}
					/>
					<StatsCard
						title={t("stats.plans.title")}
						value={format.number(Object.keys(PLANS).length)}
						description={t("stats.plans.description")}
						icon={CreditCard}
					/>
					<StatsCard
						title={t("stats.domains.title")}
						value={format.number(config.app.swappableDomains.length)}
						description={t("stats.domains.description")}
						icon={Blocks}
					/>
				</div>
			</DesignSubsection>

			<DesignSubsection
				title={t("pricing.title")}
				description={t.rich("pricing.description", richCode)}
			>
				<PricingCompact
					tiers={tiers}
					popularLabel={payments("choosePlan.popular")}
					monthlyLabel={payments("choosePlan.monthly")}
					yearlyLabel={payments("choosePlan.yearly")}
					yearlyBadge={payments("choosePlan.yearlyBadge")}
				/>
				<div className="mt-8 space-y-6">
					<PricingParts />
					<Collapsible className="space-y-4">
						<CollapsibleTrigger asChild>
							<Button variant="outline">
								{t("pricing.fullToggle")}
								<ChevronsUpDown />
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<PricingFull
								tiers={tiers}
								featureMatrix={featureMatrix}
								featureGroupLabels={featureGroupLabels}
								popularLabel={payments("choosePlan.popular")}
								monthlyLabel={payments("choosePlan.monthly")}
								yearlyLabel={payments("choosePlan.yearly")}
								yearlyBadge={payments("choosePlan.yearlyBadge")}
							/>
						</CollapsibleContent>
					</Collapsible>
				</div>
			</DesignSubsection>

			<DesignSubsection
				title={t("auth.title")}
				description={t("auth.description")}
			>
				<AuthDemo />
			</DesignSubsection>

			<DesignSubsection
				title={t("media.title")}
				description={t("media.description")}
			>
				<div className="grid gap-8 md:grid-cols-2">
					<figure className="space-y-3">
						<MediaFrame
							imageSrc="/og-image.png"
							imageAlt={t("media.imageAlt")}
						/>
						<figcaption className="text-muted-foreground text-xs">
							{t("media.plain")}
						</figcaption>
					</figure>
					<figure className="space-y-3">
						<MacFrame imageSrc="/og-image.png" imageAlt={t("media.imageAlt")} />
						<figcaption className="text-muted-foreground text-xs">
							{t("media.chrome")}
						</figcaption>
					</figure>
				</div>
			</DesignSubsection>

			<DesignSubsection
				title={t("logos.title")}
				description={t("logos.description")}
			>
				<div className="rounded-xl border bg-card p-6 shadow-xs">
					<LogoRail items={logos} />
				</div>
				<div className="flex items-center gap-4">
					{logos[0] ? <LogoItemCard item={logos[0]} /> : null}
					<p className="text-muted-foreground text-xs">{t("logos.single")}</p>
				</div>
			</DesignSubsection>

			<DesignSubsection
				title={t("mesh.title")}
				description={t.rich("mesh.description", richCode)}
			>
				<div className="grid gap-4 md:grid-cols-3">
					<figure className="space-y-3">
						<div className="relative h-44 overflow-hidden rounded-xl border bg-background">
							<MeshGradient className="absolute inset-0" />
						</div>
						<figcaption className="space-y-0.5">
							<code className="font-mono text-foreground text-xs">
								{t("mesh.component.title")}
							</code>
							<p className="text-muted-foreground text-xs">
								{t("mesh.component.caption")}
							</p>
						</figcaption>
					</figure>
					<figure data-testid="mesh-area-demo" className="space-y-3">
						<div className="relative h-44 overflow-hidden rounded-xl border bg-background">
							<MeshGradient
								className="absolute inset-0"
								color1="var(--area-users)"
								color2="var(--area-ai)"
							/>
						</div>
						<figcaption className="space-y-0.5">
							<code className="break-all font-mono text-foreground text-xs">
								{t("mesh.areas.title")}
							</code>
							<p className="text-muted-foreground text-xs">
								{t("mesh.areas.caption")}
							</p>
						</figcaption>
					</figure>
					<figure className="space-y-3">
						<div className="mesh-gradient relative h-44 rounded-xl border bg-background">
							<div className="mg-layer-1" />
							<div className="mg-layer-2" />
							<div className="mg-layer-3" />
						</div>
						<figcaption className="space-y-0.5">
							<code className="font-mono text-foreground text-xs">
								{t("mesh.utility.title")}
							</code>
							<p className="text-muted-foreground text-xs">
								{t("mesh.utility.caption")}
							</p>
						</figcaption>
					</figure>
				</div>
			</DesignSubsection>
		</div>
	);
}
