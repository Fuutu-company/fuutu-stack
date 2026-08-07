import { useTranslations } from "next-intl";

interface FaqItem {
	q: string;
	a: string;
}

export function FAQ() {
	const t = useTranslations("home.faq");
	const items = t.raw("items") as FaqItem[];

	return (
		<section className="py-24 md:py-32">
			<div className="container mx-auto max-w-3xl px-4">
				<div className="mb-12 text-center">
					<h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
						{t("title")}
					</h2>
					<p className="text-lg text-muted-foreground">{t("description")}</p>
				</div>
				<dl className="divide-y border-y">
					{items.map((item) => (
						<div key={item.q} className="py-6">
							<dt className="mb-2 font-semibold text-lg">{item.q}</dt>
							<dd className="text-muted-foreground leading-relaxed">
								{item.a}
							</dd>
						</div>
					))}
				</dl>
			</div>
		</section>
	);
}
