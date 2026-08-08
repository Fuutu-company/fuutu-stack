import { ChatLayout } from "@app/chat";
import { getTranslations } from "next-intl/server";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function OrgChatPage({ params }: Props) {
	const t = await getTranslations("chat");
	const { slug } = await params;

	return (
		<div className="space-y-4">
			<div>
				<h1 className="font-bold text-3xl">{t("title")}</h1>
				<p className="mt-2 text-muted-foreground">{t("description")}</p>
			</div>
			<ChatLayout slug={slug} />
		</div>
	);
}
