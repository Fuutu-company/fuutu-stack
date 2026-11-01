import { authConfig } from "@fuutu/auth/config";
import { listPendingInvitationsForUser } from "@fuutu/db";
import { requireAuth } from "@/lib/auth-server";
import { OnboardingWizard } from "@/modules/app/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
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
		<div className="container mx-auto px-4 py-12 md:py-20">
			<OnboardingWizard
				initialName={session.user.name ?? ""}
				userEmail={session.user.email}
				canCreateOrg={canCreateOrg}
				pendingInvitations={pendingInvitations}
			/>
		</div>
	);
}
