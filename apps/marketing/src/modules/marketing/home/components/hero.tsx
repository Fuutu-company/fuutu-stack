import { config } from "@fuutu/config";
import { getShowcasePlan } from "@fuutu/payments/plans";
import { type Area, Button } from "@fuutu/ui";
import { cn } from "@fuutu/utils/cn";
import { AreaCutoutIcon } from "@marketing/components/area-cutout-icon";
import {
	ArrowRight,
	BadgeCheck,
	type LucideIcon,
	PlayCircle,
	Sparkles,
	UserPlus,
	Webhook,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";
import { urls } from "@/lib/urls";
import { enterStyle } from "./enter";
import { INK_BUTTON, SOFT_BUTTON } from "./landing-styles";
import { Screen, ScreenWindow } from "./screen-window";
import { Blob } from "./section-heading";

type FloatKey = "joined" | "upgraded" | "assistant" | "webhook";

/** Activity cards around the product window; only `upgraded` stays on small screens. */
const FLOATS: {
	key: FloatKey;
	area: Area;
	icon: LucideIcon;
	className: string;
	delay: string;
}[] = [
	{
		key: "joined",
		area: "users",
		icon: UserPlus,
		className: "hidden lg:flex lg:top-[7.5rem] lg:-left-6 xl:-left-10",
		delay: "0s",
	},
	{
		key: "upgraded",
		area: "billing",
		icon: BadgeCheck,
		className:
			"mx-auto -mt-8 w-fit sm:-mt-10 lg:top-[4.5rem] lg:-right-6 lg:mt-0 xl:-right-12",
		delay: "-2s",
	},
	{
		key: "assistant",
		area: "ai",
		icon: Sparkles,
		className:
			"hidden lg:flex lg:-right-4 lg:bottom-[5.5rem] lg:max-w-72 xl:-right-8",
		delay: "-4s",
	},
	{
		key: "webhook",
		area: "api",
		icon: Webhook,
		className: "hidden lg:flex lg:bottom-[3.75rem] lg:-left-4 xl:-left-6",
		delay: "-1s",
	},
];

/** Area-colored marker behind the highlighted headline words (`.hero-marker`, globals.css). */
function highlight(chunks: ReactNode) {
	return <mark className="hero-marker">{chunks}</mark>;
}

export function Hero() {
	const t = useTranslations("home.hero");
	const tPlans = useTranslations("payments.plans");
	const showcase = getShowcasePlan();
	const appName = config.app.name;
	const screenshotAlt = t("screenshotAlt", { appName });

	const floatMeta: Record<FloatKey, string> = {
		joined: t("floats.joined.meta"),
		upgraded: showcase
			? t("floats.upgraded.meta", {
					price: showcase.plan.displayPrice,
					suffix: tPlans(`${showcase.id}.priceSuffix`),
				})
			: "",
		assistant: t("floats.assistant.meta", { credits: 1200 }),
		webhook: t("floats.webhook.meta"),
	};
	const floatTitle: Record<FloatKey, string> = {
		joined: t("floats.joined.title"),
		upgraded: showcase
			? t("floats.upgraded.title", { plan: tPlans(`${showcase.id}.name`) })
			: "",
		assistant: t("floats.assistant.title"),
		webhook: t("floats.webhook.title"),
	};

	return (
		<section
			data-slot="hero"
			className="relative isolate px-4 pt-12 sm:px-6 md:pt-20"
		>
			<Blob className="top-10 -left-32 h-[26rem] w-[32rem] bg-area-users" />
			<Blob className="top-28 -right-32 h-96 w-[29rem] bg-area-ai" />
			<Blob className="top-[35rem] left-[30%] h-[22rem] w-[32rem] bg-area-billing opacity-55" />

			<div className="mx-auto flex max-w-6xl flex-col items-center text-center">
				<h1
					className="hero-enter relative isolate max-w-5xl text-balance break-words font-extrabold font-heading text-[clamp(3rem,8vw,6.5rem)] leading-[1.02] tracking-display"
					style={enterStyle(0)}
				>
					{t.rich("title", { mark: highlight })}
				</h1>
				<p
					className="hero-enter mt-6 max-w-[39rem] text-balance text-lg text-muted-foreground leading-8 md:mt-7 md:text-xl"
					style={enterStyle(1)}
				>
					{t("description")}
				</p>
				<div
					className="hero-enter mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row md:mt-9"
					style={enterStyle(2)}
				>
					<Button size="lg" className={INK_BUTTON} asChild>
						<a href={urls.auth.signUp}>
							{t("cta.start")}
							<ArrowRight />
						</a>
					</Button>
					<Button size="lg" variant="outline" className={SOFT_BUTTON} asChild>
						<a href="#tour">
							<PlayCircle />
							{t("cta.tour")}
						</a>
					</Button>
				</div>
				<p
					className="hero-enter mt-4 font-medium text-muted-foreground text-sm"
					style={enterStyle(3)}
				>
					{t("note")}
				</p>
			</div>

			<div
				className="hero-enter relative mx-auto mt-12 max-w-[70rem] md:mt-[4.5rem]"
				style={enterStyle(4)}
			>
				<ScreenWindow>
					<Screen
						id="dashboardLight"
						alt={screenshotAlt}
						eager
						className="dark:hidden"
					/>
					<Screen
						id="dashboardDark"
						alt={screenshotAlt}
						eager
						className="hidden dark:block"
					/>
				</ScreenWindow>

				{FLOATS.filter(({ key }) => key !== "upgraded" || showcase).map(
					({ key, area, icon, className, delay }) => (
						<div
							key={key}
							data-slot="hero-float"
							className={cn(
								"hero-float relative z-10 flex items-center gap-3 rounded-[1.25rem] bg-card py-3 pr-4 pl-3 text-left font-bold text-sm shadow-2xl lg:absolute",
								className,
							)}
							style={{ "--float-delay": delay } as CSSProperties}
						>
							<AreaCutoutIcon area={area} icon={icon} />
							<span className="min-w-0">
								{floatTitle[key]}
								<span className="block font-medium text-[0.8rem] text-muted-foreground">
									{floatMeta[key]}
								</span>
							</span>
						</div>
					),
				)}
			</div>
		</section>
	);
}
