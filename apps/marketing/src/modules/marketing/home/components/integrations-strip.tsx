import { useTranslations } from "next-intl";

/** Providers the product connects to out of the box (brand names, not translated). */
const INTEGRATIONS = [
	"Stripe",
	"Polar",
	"Creem",
	"OpenAI",
	"Anthropic",
	"Resend",
	"S3",
] as const;

export function IntegrationsStrip() {
	const t = useTranslations("home.integrations");

	return (
		<section className="px-4 pt-20 text-center sm:px-6 md:pt-24">
			<p
				id="integrations-title"
				className="font-semibold text-muted-foreground text-sm"
			>
				{t("title")}
			</p>
			<ul
				aria-labelledby="integrations-title"
				className="mx-auto mt-5 flex max-w-4xl flex-wrap justify-center gap-x-10 gap-y-3 font-extrabold font-heading text-muted-foreground text-xl tracking-heading md:gap-x-12 md:text-[1.375rem]"
			>
				{INTEGRATIONS.map((name) => (
					<li key={name}>{name}</li>
				))}
			</ul>
		</section>
	);
}
