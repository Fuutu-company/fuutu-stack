import { CrmLayout } from "@app/crm";
import { getTranslations } from "next-intl/server";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function OrgCrmPage({ params }: Props) {
	const t = await getTranslations("crm");
	const { slug } = await params;

	return (
		<div className="space-y-4">
			<div>
				<h1 className="font-bold text-3xl">{t("title")}</h1>
				<p className="mt-2 text-muted-foreground">{t("description")}</p>
			</div>
			<CrmLayout slug={slug} />
		</div>
	);
}
