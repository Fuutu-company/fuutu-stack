import { ApiKeyList } from "@/modules/app/api-keys/components/api-key-list";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function OrgApiKeysPage({ params }: Props) {
	const { slug } = await params;
	return (
		<div className="mx-auto max-w-4xl">
			<ApiKeyList slug={slug} />
		</div>
	);
}
