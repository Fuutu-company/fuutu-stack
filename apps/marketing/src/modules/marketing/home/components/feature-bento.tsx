import { i18nConfig } from "@fuutu/i18n/config";
import { getShowcasePlan } from "@fuutu/payments/plans";
import { AREA_CLASSES, type Area, AreaBadge } from "@fuutu/ui";
import { cn } from "@fuutu/utils/cn";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { SectionHeading } from "./section-heading";

interface TeamMember {
	initials: string;
	name: string;
	detail: string;
	role: string;
}

/** Webhook event names shown in the "connects" tile (identifiers, not copy). */
const WEBHOOK_EVENTS = { delivered: "crm.sync", retrying: "invoice.paid" };

const MEMBER_AVATARS = [
	"bg-primary text-primary-foreground",
	"bg-area-users-foreground text-card",
	"bg-area-ai-foreground text-card",
] as const;

function Tile({
	area,
	title,
	description,
	className,
	children,
}: {
	area?: Area;
	title: ReactNode;
	description: ReactNode;
	className?: string;
	children?: ReactNode;
}) {
	return (
		<article
			data-area={area}
			className={cn(
				"flex min-h-[21rem] flex-col overflow-hidden rounded-[1.875rem] p-6 shadow-md sm:p-7",
				area
					? [AREA_CLASSES[area].fill, AREA_CLASSES[area].ink]
					: "bg-card text-card-foreground",
				className,
			)}
		>
			<h3 className="text-balance font-extrabold font-heading text-2xl leading-tight tracking-heading md:text-[1.625rem]">
				{title}
			</h3>
			<p
				className={cn(
					"mt-2 max-w-md font-medium text-[0.96875rem] leading-6",
					!area && "text-muted-foreground",
				)}
			>
				{description}
			</p>
			{children ? <div className="mt-auto pt-6">{children}</div> : null}
		</article>
	);
}

/** Small surface inside a tile (the "mini UI" panel). */
function Panel({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<div
			className={cn(
				"rounded-[1.25rem] bg-card px-4 py-3.5 text-card-foreground shadow-md",
				className,
			)}
		>
			{children}
		</div>
	);
}

function Row({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<div className={cn("flex min-w-0 items-center gap-3", className)}>
			{children}
		</div>
	);
}

function Label({ title, meta }: { title: ReactNode; meta?: ReactNode }) {
	return (
		<span className="min-w-0 font-bold text-[0.90625rem] leading-5">
			<span className="block truncate">{title}</span>
			{meta ? (
				<span className="block truncate font-medium text-muted-foreground text-xs">
					{meta}
				</span>
			) : null}
		</span>
	);
}

function NeutralPill({ children }: { children: ReactNode }) {
	return (
		<span className="ml-auto inline-flex h-6 shrink-0 items-center rounded-full bg-muted px-2.5 font-bold text-muted-foreground text-xs">
			{children}
		</span>
	);
}

function StatusDot({ tone }: { tone: "success" | "warning" }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"size-2.5 shrink-0 rounded-full",
				tone === "success" ? "bg-success" : "bg-warning",
			)}
		/>
	);
}

export function FeatureBento() {
	const t = useTranslations("home.features");
	const tPayments = useTranslations("payments");
	const showcase = getShowcasePlan();
	const locale = useLocale();
	const members = t.raw("team.members") as TeamMember[];
	const locales = Object.entries(i18nConfig.locales) as [
		string,
		{ label: string },
	][];

	return (
		<section id="features" className="scroll-mt-28 px-4 pt-24 sm:px-6 md:pt-32">
			<div className="mx-auto max-w-6xl">
				<SectionHeading title={t("title")} description={t("description")} />

				<div className="mt-12 grid gap-4 md:mt-14 md:grid-cols-2 md:gap-[1.125rem] lg:grid-cols-6">
					<Tile
						area="users"
						title={t("team.title")}
						description={t("team.description")}
						className="lg:col-span-3"
					>
						<Panel className="grid gap-2.5">
							{members.map((member, index) => (
								<Row key={member.name}>
									<span
										aria-hidden="true"
										className={cn(
											"flex size-[2.125rem] shrink-0 items-center justify-center rounded-full font-extrabold text-[0.8125rem]",
											MEMBER_AVATARS[index % MEMBER_AVATARS.length],
										)}
									>
										{member.initials}
									</span>
									<Label title={member.name} meta={member.detail} />
									{index === 0 ? (
										<AreaBadge area="users" className="ml-auto">
											{member.role}
										</AreaBadge>
									) : (
										<NeutralPill>{member.role}</NeutralPill>
									)}
								</Row>
							))}
						</Panel>
					</Tile>

					<Tile
						area="billing"
						title={t("billing.title")}
						description={t("billing.description")}
						className="lg:col-span-3"
					>
						<Panel>
							<Row className="justify-between">
								<span className="inline-flex rounded-full bg-muted p-1 font-bold text-[0.78125rem]">
									<span className="rounded-full px-3 py-1.5 text-muted-foreground">
										{tPayments("choosePlan.monthly")}
									</span>
									<span className="rounded-full bg-card px-3 py-1.5 shadow-md">
										{tPayments("choosePlan.yearly")}
									</span>
								</span>
								{showcase ? (
									<AreaBadge area="billing">
										{tPayments(`plans.${showcase.id}.name`)}
									</AreaBadge>
								) : null}
							</Row>
							{showcase ? (
								<p className="mt-3.5 flex flex-wrap items-baseline gap-x-1.5 font-extrabold font-heading text-[2.75rem] leading-none tracking-display">
									{showcase.plan.yearlyDisplayPrice ??
										showcase.plan.displayPrice}
									{showcase.plan.seatBased ? (
										<span className="font-sans font-semibold text-[0.9375rem] text-muted-foreground tracking-normal">
											{t("billing.perSeat")}
										</span>
									) : null}
								</p>
							) : null}
							<Row className="mt-3">
								<Label title={t("billing.invoice")} />
								<AreaBadge area="billing" className="ml-auto">
									{t("billing.paid")}
								</AreaBadge>
							</Row>
						</Panel>
					</Tile>

					<Tile
						area="ai"
						title={t("ai.title")}
						description={t("ai.description")}
						className="lg:col-span-2"
					>
						<div className="grid gap-2.5 text-sm">
							<p className="ml-auto max-w-[85%] rounded-[1.125rem] rounded-br-md bg-primary px-3.5 py-2.5 font-semibold text-primary-foreground">
								{t("ai.prompt")}
							</p>
							<p className="max-w-[85%] rounded-[1.125rem] rounded-bl-md bg-card px-3.5 py-2.5 font-semibold text-card-foreground shadow-md">
								{t("ai.reply")}
							</p>
							<span
								aria-hidden="true"
								className="mt-1 block h-2.5 overflow-hidden rounded-full bg-card/60"
							>
								<span className="block h-full w-[64%] rounded-full bg-area-ai-foreground" />
							</span>
						</div>
					</Tile>

					<Tile
						title={t("security.title")}
						description={t("security.description")}
						className="lg:col-span-2"
					>
						<Panel className="grid gap-2.5">
							<Row>
								<StatusDot tone="success" />
								<Label
									title={t("security.passkey")}
									meta={t("security.passkeyMeta")}
								/>
							</Row>
							<Row>
								<StatusDot tone="success" />
								<Label
									title={t("security.twoFactor")}
									meta={t("security.twoFactorMeta")}
								/>
							</Row>
						</Panel>
					</Tile>

					<Tile
						area="api"
						title={t("connect.title")}
						description={t("connect.description")}
						className="md:col-span-2 lg:col-span-2"
					>
						<Panel className="grid gap-2.5">
							<Row>
								<StatusDot tone="success" />
								<Label
									title={WEBHOOK_EVENTS.delivered}
									meta={t("connect.delivered")}
								/>
								<AreaBadge area="api" className="ml-auto">
									{t("connect.live")}
								</AreaBadge>
							</Row>
							<Row>
								<StatusDot tone="warning" />
								<Label
									title={WEBHOOK_EVENTS.retrying}
									meta={t("connect.retrying")}
								/>
							</Row>
						</Panel>
					</Tile>

					<article className="grid items-center gap-6 rounded-[1.875rem] bg-card p-6 text-card-foreground shadow-md sm:p-7 md:col-span-2 md:grid-cols-[1.3fr_1fr] md:gap-8 lg:col-span-6">
						<div>
							<h3 className="text-balance font-extrabold font-heading text-2xl leading-tight tracking-heading md:text-[1.625rem]">
								{t("languages.title")}
							</h3>
							<p className="mt-2 max-w-lg font-medium text-[0.96875rem] text-muted-foreground leading-6">
								{t("languages.description")}
							</p>
						</div>
						<ul aria-label={t("languages.listLabel")} className="flex gap-2">
							{locales.map(([code, { label }]) => (
								<li
									key={code}
									className={cn(
										"flex-1 rounded-2xl py-3.5 text-center font-extrabold font-heading text-[1.375rem] uppercase shadow-md",
										code === locale
											? "bg-primary text-primary-foreground"
											: "bg-card text-card-foreground",
									)}
								>
									<abbr title={label} className="no-underline">
										{code}
									</abbr>
								</li>
							))}
							<li className="flex flex-1 items-center justify-center rounded-2xl bg-muted py-3.5 text-muted-foreground">
								<Plus aria-hidden="true" className="size-6" strokeWidth={2.5} />
								<span className="sr-only">{t("languages.more")}</span>
							</li>
						</ul>
					</article>
				</div>
			</div>
		</section>
	);
}
