import { authConfig } from "@fuutu/auth/config";
import { getSession } from "@/lib/auth-server";
import { ImpersonationBannerView } from "./impersonation-banner-view";

/**
 * Shown on every signed-in page while an admin acts as another user.
 * Renders nothing for a normal session.
 */
export async function ImpersonationBanner() {
	const session = await getSession();
	if (!session) return null;
	const { impersonatedBy, createdAt } = session.session as {
		impersonatedBy?: string | null;
		createdAt: Date | string;
	};
	if (!impersonatedBy) return null;

	const endsAt =
		new Date(createdAt).getTime() +
		authConfig.admin.impersonationMinutes * 60_000;

	return (
		<ImpersonationBannerView
			userId={session.user.id}
			name={session.user.name}
			email={session.user.email}
			endsAt={endsAt}
		/>
	);
}
