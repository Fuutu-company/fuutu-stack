import { Button } from "@fuutu/ui";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

const SAAS_URL = "https://stackapp.fuutu.com";
const DOCS_URL = "https://stack.fuutu.com/docs";

export function CTA() {
	const t = useTranslations("home.cta");

	return (
		<section className="py-24 md:py-32">
			<div className="container mx-auto max-w-5xl px-4">
				<div className="relative overflow-hidden rounded-2xl border bg-card p-10 text-center md:p-16">
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-br from-primary/5 via-transparent to-primary/10"
					/>
					<div
						aria-hidden
						className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-[200px] w-[500px] -translate-x-1/2 rounded-full bg-primary/30 blur-[100px]"
					/>
					<h2 className="mb-4 font-bold text-3xl tracking-tight md:text-5xl">
						{t("title")}
					</h2>
					<p className="mx-auto mb-8 max-w-xl text-balance text-muted-foreground md:text-lg">
						{t("description")}
					</p>
					<div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
						<Button size="lg" asChild>
							<a href={`${SAAS_URL}/auth/sign-up`}>
								{t("getStarted")}
								<ArrowRight className="ml-2 size-4" />
							</a>
						</Button>
						<Button size="lg" variant="outline" asChild>
							<a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
								{t("viewDocs")}
							</a>
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
