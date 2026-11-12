import { OrgSettingsMembers } from "@/modules/app/organizations/org-settings-members";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function MembersPage({ params }: Props) {
	const { slug } = await params;
	return (
		<div className="mx-auto max-w-4xl">
			<OrgSettingsMembers slug={slug} />
		</div>
	);
}
