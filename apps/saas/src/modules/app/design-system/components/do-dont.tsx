import { AreaBadge, Badge, Button } from "@fuutu/ui";
import { cn } from "@fuutu/utils/cn";
import {
	Check,
	Sparkles,
	TriangleAlert,
	Users,
	X,
	XCircle,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { richCode } from "./design-section";

type Verdict = "do" | "dont";

function Panel({
	verdict,
	label,
	caption,
	children,
}: {
	verdict: Verdict;
	label: string;
	caption: ReactNode;
	children: ReactNode;
}) {
	const Icon = verdict === "do" ? Check : X;
	return (
		<div
			data-design-verdict={verdict}
			className="flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-xs"
		>
			<div
				className={cn(
					"flex items-center gap-1.5 font-semibold text-sm",
					verdict === "do" ? "text-success" : "text-destructive",
				)}
			>
				<Icon aria-hidden="true" className="size-4" />
				{label}
			</div>
			<div className="flex min-h-24 flex-1 flex-wrap content-center items-center gap-3 rounded-lg border bg-background p-4">
				{children}
			</div>
			<p className="text-muted-foreground text-sm leading-5">{caption}</p>
		</div>
	);
}

function Pair({
	title,
	doPanel,
	dontPanel,
}: {
	title: string;
	doPanel: ReactNode;
	dontPanel: ReactNode;
}) {
	return (
		<li className="space-y-3">
			<h3 className="font-semibold text-base leading-6">{title}</h3>
			<div className="grid gap-4 md:grid-cols-2">
				{doPanel}
				{dontPanel}
			</div>
		</li>
	);
}

const codeChip =
	"rounded-sm bg-muted px-1.5 py-1 font-mono text-foreground text-xs";

export async function DoDont() {
	const t = await getTranslations("designSystem.doDont");
	const doLabel = t("do");
	const dontLabel = t("dont");

	return (
		<ul className="space-y-10">
			<Pair
				title={t("pairs.roles.title")}
				doPanel={
					<Panel
						verdict="do"
						label={doLabel}
						caption={t.rich("pairs.roles.do", richCode)}
					>
						<Badge>{t("pairs.roles.doSample")}</Badge>
						<code className={codeChip}>{t("pairs.roles.doCode")}</code>
					</Panel>
				}
				dontPanel={
					<Panel
						verdict="dont"
						label={dontLabel}
						caption={t.rich("pairs.roles.dont", richCode)}
					>
						<code className={codeChip}>{t("pairs.roles.dontCode")}</code>
					</Panel>
				}
			/>

			<Pair
				title={t("pairs.primary.title")}
				doPanel={
					<Panel verdict="do" label={doLabel} caption={t("pairs.primary.do")}>
						<Button>{t("pairs.primary.save")}</Button>
						<Button variant="outline">{t("pairs.primary.cancel")}</Button>
					</Panel>
				}
				dontPanel={
					<Panel
						verdict="dont"
						label={dontLabel}
						caption={t("pairs.primary.dont")}
					>
						<Button>{t("pairs.primary.save")}</Button>
						<Button>{t("pairs.primary.publish")}</Button>
						<Button>{t("pairs.primary.invite")}</Button>
					</Panel>
				}
			/>

			<Pair
				title={t("pairs.colorAlone.title")}
				doPanel={
					<Panel
						verdict="do"
						label={doLabel}
						caption={t("pairs.colorAlone.do")}
					>
						<Badge variant="outline">
							<XCircle aria-hidden="true" className="text-destructive" />
							{t("pairs.colorAlone.label")}
						</Badge>
					</Panel>
				}
				dontPanel={
					<Panel
						verdict="dont"
						label={dontLabel}
						caption={t("pairs.colorAlone.dont")}
					>
						<span
							aria-hidden="true"
							className="size-3 rounded-full bg-destructive"
						/>
					</Panel>
				}
			/>

			<Pair
				title={t("pairs.fills.title")}
				doPanel={
					<Panel verdict="do" label={doLabel} caption={t("pairs.fills.do")}>
						<div className="flex items-start gap-2.5 rounded-lg border bg-warning px-4 py-3 text-sm text-warning-foreground">
							<TriangleAlert
								aria-hidden="true"
								className="mt-0.5 size-4 shrink-0"
							/>
							<p>{t("pairs.fills.callout")}</p>
						</div>
					</Panel>
				}
				dontPanel={
					<Panel
						verdict="dont"
						label={dontLabel}
						caption={t.rich("pairs.fills.dont", richCode)}
					>
						<code className={codeChip}>{t("pairs.fills.dontCode")}</code>
					</Panel>
				}
			/>

			<Pair
				title={t("pairs.intent.title")}
				doPanel={
					<Panel verdict="do" label={doLabel} caption={t("pairs.intent.do")}>
						<Button variant="destructive">{t("pairs.intent.delete")}</Button>
					</Panel>
				}
				dontPanel={
					<Panel
						verdict="dont"
						label={dontLabel}
						caption={t("pairs.intent.dont")}
					>
						<Button variant="destructive">{t("pairs.intent.save")}</Button>
					</Panel>
				}
			/>

			<Pair
				title={t("pairs.areaMark.title")}
				doPanel={
					<Panel verdict="do" label={doLabel} caption={t("pairs.areaMark.do")}>
						<AreaBadge area="users">
							<Users />
							{t("pairs.areaMark.members")}
						</AreaBadge>
					</Panel>
				}
				dontPanel={
					<Panel
						verdict="dont"
						label={dontLabel}
						caption={t.rich("pairs.areaMark.dont", richCode)}
					>
						<code className={codeChip}>{t("pairs.areaMark.dontCode")}</code>
					</Panel>
				}
			/>

			<Pair
				title={t("pairs.areaOpacity.title")}
				doPanel={
					<Panel
						verdict="do"
						label={doLabel}
						caption={t.rich("pairs.areaOpacity.do", richCode)}
					>
						<AreaBadge area="ai">
							<Sparkles />
							{t("pairs.areaOpacity.sample")}
						</AreaBadge>
					</Panel>
				}
				dontPanel={
					<Panel
						verdict="dont"
						label={dontLabel}
						caption={t("pairs.areaOpacity.dont")}
					>
						<code className={codeChip}>{t("pairs.areaOpacity.dontCode")}</code>
					</Panel>
				}
			/>
		</ul>
	);
}
