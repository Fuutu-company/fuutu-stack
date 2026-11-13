import { ThemeToggle } from "@app/components/theme-toggle";
import { AreaBackdrop, Card, PageHeader } from "@fuutu/ui";
import { getTranslations } from "next-intl/server";
import { DESIGN_SECTIONS } from "../sections";
import { DesignNav } from "./design-nav";
import { richCode } from "./design-section";

/** The three ways to change the design, in the order a buyer tries them. */
const STEPS = ["edit", "paste", "skill"] as const;

export async function DesignHeader() {
	const t = await getTranslations("designSystem");

	return (
		<>
			<section aria-label={t("title")} className="space-y-8">
				<div className="space-y-3">
					<p className="font-medium text-primary text-sm">{t("eyebrow")}</p>
					<PageHeader
						title={t("title")}
						description={t("intro")}
						actions={
							<div className="flex items-center gap-1 rounded-full bg-card py-1 pr-1 pl-4 shadow-xs ring-1 ring-foreground/5">
								<span className="text-muted-foreground text-sm">
									{t("mode")}
								</span>
								<ThemeToggle />
							</div>
						}
					/>
				</div>

				<Card className="gap-0 overflow-hidden py-0 md:grid md:grid-cols-2">
					<div className="relative isolate flex flex-col gap-3 p-6 md:p-8">
						<h2 className="font-bold font-heading text-lg tracking-heading">
							{t("about.title")}
						</h2>
						<p className="text-sm leading-6">
							{t.rich("about.body", richCode)}
						</p>
						<p className="text-muted-foreground text-sm leading-6">
							{t.rich("about.contract", richCode)}
						</p>
						<AreaBackdrop className="opacity-60" />
					</div>
					<div className="space-y-4 bg-muted/60 p-6 md:p-8">
						<h2 className="font-bold font-heading text-lg tracking-heading">
							{t("about.howTitle")}
						</h2>
						<ol className="space-y-4">
							{STEPS.map((step, index) => (
								<li key={step} className="flex gap-3">
									<span
										aria-hidden="true"
										className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-xs tabular-nums"
									>
										{index + 1}
									</span>
									<div className="min-w-0 space-y-0.5">
										<h3 className="font-bold text-sm">
											{t(`about.steps.${step}.title`)}
										</h3>
										<p className="break-words text-muted-foreground text-sm leading-6">
											{t.rich(`about.steps.${step}.description`, richCode)}
										</p>
									</div>
								</li>
							))}
						</ol>
					</div>
				</Card>
			</section>

			<DesignNav
				label={t("nav.label")}
				items={DESIGN_SECTIONS.map(({ id, key }) => ({
					id,
					title: t(`sections.${key}.title`),
				}))}
			/>
		</>
	);
}
