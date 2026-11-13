import { ChatLayout } from "@app/chat";
import { PageHeader } from "@fuutu/ui";
import { getTranslations } from "next-intl/server";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function OrgChatPage({ params }: Props) {
	const t = await getTranslations("chat");
	const { slug } = await params;

	return (
		<div className="space-y-4">
			<PageHeader variant="compact" title={t("title")} />
			<ChatLayout slug={slug} />
		</div>
	);
}
