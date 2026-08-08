import { OrgSettingsDanger } from "@/modules/app/organizations/org-settings-danger";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function DangerPage({ params }: Props) {
	const { slug } = await params;
	return (
		<div className="mx-auto max-w-4xl">
			<OrgSettingsDanger slug={slug} />
		</div>
	);
}
