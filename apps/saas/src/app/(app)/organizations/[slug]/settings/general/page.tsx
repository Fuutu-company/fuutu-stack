import { OrgSettingsGeneral } from "@/modules/app/organizations/org-settings-general";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function GeneralPage({ params }: Props) {
	const { slug } = await params;
	return (
		<div className="mx-auto max-w-4xl">
			<OrgSettingsGeneral slug={slug} />
		</div>
	);
}
