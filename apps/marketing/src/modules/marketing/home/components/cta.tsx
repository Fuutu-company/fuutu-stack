import { LIMITS } from "@fuutu/payments/config";
import { Button } from "@fuutu/ui";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { urls } from "@/lib/urls";
import { INK_BUTTON, SOFT_BUTTON } from "./landing-styles";
import { Blob } from "./section-heading";

export function CTA() {
	const t = useTranslations("home.cta");
	const freeMembers = LIMITS.free.membersPerOrg;

	return (
		<section className="px-4 pt-24 sm:px-6 md:pt-32">
			<div className="relative isolate mx-auto flex max-w-6xl flex-col items-center overflow-hidden rounded-[2.5rem] bg-card px-6 py-16 text-center text-card-foreground shadow-md md:px-8 md:py-24">
				<Blob className="-top-20 -left-24 h-[22rem] w-[26rem] bg-area-users" />
				<Blob className="-right-24 -bottom-28 h-[22rem] w-[26rem] bg-area-billing" />
				<Blob className="-top-36 left-[45%] h-60 w-72 bg-area-ai opacity-60" />
				<h2 className="max-w-3xl text-balance font-extrabold font-heading text-[clamp(2.5rem,6vw,4.75rem)] leading-[1.02] tracking-display">
					{t("title")}
				</h2>
				<p className="mt-5 max-w-lg text-balance text-lg text-muted-foreground leading-8 md:text-[1.1875rem]">
					{t("description", {
						members: typeof freeMembers === "number" ? freeMembers : 0,
					})}
				</p>
				<div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
					<Button size="lg" className={INK_BUTTON} asChild>
						<a href={urls.auth.signUp}>
							{t("start")}
							<ArrowRight />
						</a>
					</Button>
					<Button size="lg" variant="outline" className={SOFT_BUTTON} asChild>
						<a href={urls.auth.signIn}>{t("signIn")}</a>
					</Button>
				</div>
			</div>
		</section>
	);
}
