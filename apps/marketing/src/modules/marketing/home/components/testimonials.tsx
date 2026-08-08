import { Quote } from "lucide-react";
import { useTranslations } from "next-intl";

interface Testimonial {
	quote: string;
	author: string;
	role: string;
}

export function Testimonials() {
	const t = useTranslations("home.testimonials");
	const items = t.raw("items") as Testimonial[];

	return (
		<section className="py-24 md:py-32">
			<div className="container mx-auto max-w-6xl px-4">
				<div className="mb-16 max-w-2xl">
					<h2 className="mb-4 font-bold text-3xl tracking-tight md:text-4xl">
						{t("title")}
					</h2>
					<p className="text-lg text-muted-foreground">{t("description")}</p>
				</div>
				<div className="grid gap-4 md:grid-cols-3">
					{items.map((item) => (
						<figure
							key={item.author}
							className="relative flex flex-col gap-6 rounded-xl border bg-card p-6 md:p-8"
						>
							<Quote
								aria-hidden
								className="size-6 text-primary/60"
								strokeWidth={1.5}
							/>
							<blockquote className="text-base leading-relaxed">
								{item.quote}
							</blockquote>
							<figcaption className="mt-auto">
								<div className="font-medium text-sm">{item.author}</div>
								<div className="text-muted-foreground text-xs">{item.role}</div>
							</figcaption>
						</figure>
					))}
				</div>
			</div>
		</section>
	);
}
