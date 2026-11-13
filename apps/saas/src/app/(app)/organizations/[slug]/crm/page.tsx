import { CrmLayout } from "@app/crm";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function OrgCrmPage({ params }: Props) {
	const { slug } = await params;

	return <CrmLayout slug={slug} />;
}
