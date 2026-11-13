import { cn } from "@fuutu/utils/cn";
import { getFormatter, getTranslations } from "next-intl/server";
import {
	ELEVATION_LEVELS,
	ICON_SET,
	RADIUS_STEPS,
	SPACING_STEPS,
} from "../../tokens";
import { richCode } from "../design-section";
import { DesignSubsection } from "../design-subsection";

export async function Scales() {
	const t = await getTranslations("designSystem.foundations");
	const format = await getFormatter();

	return (
		<div className="space-y-10">
			<div className="grid gap-10 lg:grid-cols-2">
				<DesignSubsection
					title={t("spacing.title")}
					description={t.rich("spacing.description", richCode)}
				>
					<ul className="space-y-2.5">
						{SPACING_STEPS.map(({ unit, note }) => (
							<li key={unit} className="flex items-center gap-4">
								<code className="w-20 shrink-0 font-mono text-muted-foreground text-xs tabular-nums">
									{t("spacing.step", {
										unit: format.number(unit),
										px: format.number(unit * 4),
									})}
								</code>
								<div
									aria-hidden="true"
									className="h-3 shrink-0 rounded-sm bg-primary"
									style={{ width: `calc(var(--spacing) * ${unit})` }}
								/>
								{note ? (
									<span className="min-w-0 text-muted-foreground text-xs">
										{t(`spacing.notes.${unit}`)}
									</span>
								) : null}
							</li>
						))}
					</ul>
				</DesignSubsection>

				<DesignSubsection
					title={t("radius.title")}
					description={t.rich("radius.description", richCode)}
				>
					<ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
						{RADIUS_STEPS.map(({ key, className }) => (
							<li key={key} data-testid="radius-step" className="space-y-2">
								<div
									aria-hidden="true"
									className={cn(
										"h-16 border-2 border-primary bg-primary/10",
										className,
									)}
								/>
								<div className="space-y-0.5">
									<code className="block font-mono text-foreground text-xs">
										{className}
									</code>
									<span className="block text-muted-foreground text-xs leading-4">
										{t(`radius.roles.${key}`)}
									</span>
								</div>
							</li>
						))}
					</ul>
				</DesignSubsection>
			</div>

			<DesignSubsection
				title={t("elevation.title")}
				description={t.rich("elevation.description", richCode)}
			>
				<ul className="grid grid-cols-2 gap-4 rounded-2xl bg-muted p-4 sm:grid-cols-4 lg:grid-cols-7 lg:p-6">
					{ELEVATION_LEVELS.map(({ key, className }) => (
						<li key={key} data-testid="elevation-level" className="space-y-3">
							<div
								aria-hidden="true"
								className={cn("h-20 rounded-2xl bg-card", className)}
							/>
							<div className="space-y-0.5">
								<code className="block font-mono text-foreground text-xs">
									{t(`elevation.levels.${key}.name`)}
								</code>
								<span className="block text-muted-foreground text-xs leading-4">
									{t(`elevation.levels.${key}.use`)}
								</span>
							</div>
						</li>
					))}
				</ul>
			</DesignSubsection>

			<DesignSubsection
				title={t("icons.title")}
				description={t.rich("icons.description", richCode)}
			>
				<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
					{ICON_SET.map(({ name, icon: Icon }) => (
						<li
							key={name}
							className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-card-foreground"
						>
							<Icon aria-hidden="true" className="size-5 shrink-0" />
							<code className="min-w-0 truncate font-mono text-muted-foreground text-xs">
								{name}
							</code>
						</li>
					))}
				</ul>
			</DesignSubsection>
		</div>
	);
}
