import { AREA_CLASSES, type Area, Button } from "@fuutu/ui";
import { cn } from "@fuutu/utils/cn";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { PILL_BUTTON } from "./landing-styles";
import { Blob } from "./section-heading";

const FACTS: { key: "twoFactor" | "roles" | "audit" | "api"; area: Area }[] = [
	{ key: "twoFactor", area: "users" },
	{ key: "roles", area: "billing" },
	{ key: "audit", area: "ai" },
	{ key: "api", area: "api" },
];

/** Inverted (ink) band: what is secure out of the box, as four facts. */
export function SecurityBand() {
	const t = useTranslations("home.security");

	return (
		<section className="px-4 pt-24 sm:px-6 md:pt-32">
			<div className="relative isolate mx-auto grid max-w-6xl items-center gap-10 overflow-hidden rounded-[2.5rem] bg-primary px-7 py-12 text-primary-foreground md:px-16 md:py-[4.5rem] lg:grid-cols-[1.1fr_1fr] lg:gap-14">
				<Blob className="-top-28 -right-20 h-80 w-[26rem] bg-area-ai opacity-25" />
				<div>
					<h2 className="text-balance font-extrabold font-heading text-[clamp(2.25rem,4.6vw,3.5rem)] leading-[1.02] tracking-display">
						{t("title")}
					</h2>
					<p className="mt-4 max-w-xl text-lg text-primary-foreground leading-8">
						{t("description")}
					</p>
					<Button
						size="lg"
						className={cn(
							PILL_BUTTON,
							"mt-7 bg-primary-foreground text-primary hover:bg-primary-foreground",
						)}
						asChild
					>
						<Link href="/contact">{t("cta")}</Link>
					</Button>
				</div>
				<ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
					{FACTS.map(({ key, area }) => (
						<li
							key={key}
							className="rounded-3xl bg-primary-foreground/[0.08] p-5 sm:p-[1.375rem]"
						>
							<span className="block font-extrabold font-heading text-[2.125rem] leading-tight tracking-display">
								{t(`facts.${key}.title`)}
							</span>
							<span className="mt-1 flex items-center gap-2 text-primary-foreground text-sm">
								<span
									aria-hidden="true"
									className={cn(
										"size-2.5 shrink-0 rounded-full",
										AREA_CLASSES[area].fill,
									)}
								/>
								{t(`facts.${key}.description`)}
							</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
