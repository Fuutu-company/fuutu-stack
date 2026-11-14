import { Button } from "@fuutu/ui";
import { NotFoundLinks } from "@shared/components/not-found-links";
import { NotFoundView } from "@shared/components/not-found-view";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { appMarketing } from "@/app-marketing";
import { Link } from "@/navigation";

export default async function NotFound() {
	const t = await getTranslations("notFound");
	const tAll = await getTranslations();
	const links = (appMarketing.notFoundLinks ?? []).map((link) => ({
		...link,
		label: tAll(link.labelKey),
	}));
	return (
		<NotFoundView
			className="min-h-[calc(100svh-4.5rem)]"
			code={t("code")}
			title={t("title")}
			description={t("description")}
			action={
				<Button size="lg" asChild>
					<Link href="/">
						{t("cta")}
						<ArrowRight />
					</Link>
				</Button>
			}
			links={<NotFoundLinks label={t("linksLabel")} links={links} />}
		/>
	);
}
