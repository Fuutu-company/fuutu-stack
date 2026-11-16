import { authConfig } from "@fuutu/auth/config";
import { config } from "@fuutu/config";
import {
	countOrganizationsForUser,
	listPendingInvitationsForUser,
} from "@fuutu/db";
import { requireAuth } from "@/lib/auth-server";
import { OnboardingWizard } from "@/modules/app/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
	const session = await requireAuth();
	const orgCreation = authConfig.organizations.allowUserToCreateOrganization;
	const canCreateOrg =
		orgCreation === "all" ||
		(orgCreation === "admin" &&
			(session.user as { role?: string }).role === "admin");
	// Unverified: no invitations (anyone can sign up with an invited
	// address) — the page asks the user to verify the email instead.
	const emailVerified = session.user.emailVerified === true;
	const pendingInvitations = emailVerified
		? (
				await listPendingInvitationsForUser({
					email: session.user.email,
					emailVerified,
				})
			).map((inv) => ({
				id: inv.id,
				organizationName: inv.organization.name,
				role: inv.role ?? "member",
			}))
		: [];
	// Forced mode: an org is required, so one membership completes the org
	// step — a reload or second visit never offers "Create" again.
	const hasOrganization =
		config.features.organizationsMode === "forced" &&
		(await countOrganizationsForUser(session.user.id)) > 0;
	return (
		<div className="container mx-auto px-4 py-12 md:py-20">
			<OnboardingWizard
				initialName={session.user.name ?? ""}
				userEmail={session.user.email}
				canCreateOrg={canCreateOrg}
				pendingInvitations={pendingInvitations}
				emailVerified={emailVerified}
				hasOrganization={hasOrganization}
				impersonating={Boolean(
					(session.session as { impersonatedBy?: string | null })
						.impersonatedBy,
				)}
			/>
		</div>
	);
}
