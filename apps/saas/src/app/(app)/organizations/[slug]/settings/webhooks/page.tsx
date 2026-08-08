import { WebhookList } from "@/modules/app/webhooks/components/webhook-list";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function OrgWebhooksPage({ params }: Props) {
	const { slug } = await params;
	return (
		<div className="mx-auto max-w-4xl">
			<WebhookList slug={slug} />
		</div>
	);
}
