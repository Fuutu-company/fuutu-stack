import { Button } from "@fuutu/ui";
import { NotFoundView } from "@shared/components/not-found-view";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/navigation";

export default async function NotFound() {
	const t = await getTranslations("notFound");
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
		/>
	);
}
