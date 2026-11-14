import { ChatLayout } from "@app/chat";
import { config } from "@fuutu/config";
import { PageHeader } from "@fuutu/ui";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function OrgChatPage({ params }: Props) {
	if (!config.features.aiChat) notFound();
	const t = await getTranslations("chat");
	const { slug } = await params;

	return (
		<div className="space-y-4">
			<PageHeader variant="compact" title={t("title")} />
			<ChatLayout slug={slug} />
		</div>
	);
}
