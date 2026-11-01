import { getOrganizationBySlug } from "@fuutu/db";
import { getOrgEntitlement } from "@fuutu/payments";
import { OrgSettingsMembers } from "@/modules/app/organizations/org-settings-members";

interface Props {
	params: Promise<{ slug: string }>;
}

export default async function MembersPage({ params }: Props) {
	const { slug } = await params;
	const org = await getOrganizationBySlug(slug);
	const entitlement = org ? await getOrgEntitlement(org.id) : null;
	// "unlimited"/false mean no numeric seat cap to render against.
	const seatsTotal =
		typeof entitlement?.limits.membersPerOrg === "number"
			? entitlement.limits.membersPerOrg
			: null;
	return (
		<div className="mx-auto max-w-4xl">
			<OrgSettingsMembers
				slug={slug}
				seatsTotal={seatsTotal}
				upgradeUrl={`/organizations/${slug}/settings/billing`}
			/>
		</div>
	);
}
