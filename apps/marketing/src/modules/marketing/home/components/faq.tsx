import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@fuutu/ui";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { SectionHeading } from "./section-heading";

interface FaqItem {
	q: string;
	a: string;
}

/** Product FAQ: rounded cards with an accessible disclosure, plus FAQPage structured data from the same messages. */
export function FAQ() {
	const t = useTranslations("home.faq");
	const items = t.raw("items") as FaqItem[];

	if (!items.length) return null;

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: items.map((item) => ({
			"@type": "Question",
			name: item.q,
			acceptedAnswer: { "@type": "Answer", text: item.a },
		})),
	};

	return (
		<section
			id="faq"
			aria-labelledby="faq-title"
			className="scroll-mt-28 px-4 pt-24 sm:px-6 md:pt-32"
		>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
				}}
			/>
			<SectionHeading
				title={<span id="faq-title">{t("title")}</span>}
				description={t("description")}
			/>
			<div className="mx-auto mt-12 flex max-w-3xl flex-col gap-3 md:mt-14">
				{items.map((item) => (
					<Collapsible
						key={item.q}
						className="group rounded-3xl bg-card text-card-foreground shadow-md"
					>
						<h3 className="m-0">
							<CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-3xl px-6 py-5 text-left font-bold font-heading text-lg leading-snug tracking-heading outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 md:px-7">
								{item.q}
								<Plus
									aria-hidden="true"
									className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-45 motion-reduce:transition-none"
								/>
							</CollapsibleTrigger>
						</h3>
						<CollapsibleContent>
							<p className="px-6 pb-6 text-base text-muted-foreground leading-7 md:px-7">
								{item.a}
							</p>
						</CollapsibleContent>
					</Collapsible>
				))}
			</div>
		</section>
	);
}
