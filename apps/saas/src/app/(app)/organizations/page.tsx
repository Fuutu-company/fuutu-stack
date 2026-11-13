import { authConfig } from "@fuutu/auth/config";
import { listPendingInvitationsForUser } from "@fuutu/db";
import { requireAuth } from "@/lib/auth-server";
import { OrganizationsList } from "@/modules/app/organizations/organizations-list";

export default async function OrganizationsPage() {
	const session = await requireAuth();
	const orgCreation = authConfig.organizations.allowUserToCreateOrganization;
	const canCreateOrg =
		orgCreation === "all" ||
		(orgCreation === "admin" &&
			(session.user as { role?: string }).role === "admin");
	const pendingInvitations = (
		await listPendingInvitationsForUser(session.user.email)
	).map((inv) => ({
		id: inv.id,
		organizationName: inv.organization.name,
		role: inv.role ?? "member",
	}));
	return (
		<div className="mx-auto max-w-6xl">
			<OrganizationsList
				canCreateOrg={canCreateOrg}
				pendingInvitations={pendingInvitations}
			/>
		</div>
	);
}
