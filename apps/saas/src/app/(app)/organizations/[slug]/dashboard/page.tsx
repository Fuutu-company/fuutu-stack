import { DashboardOverview } from "@app/dashboard";
import { renderSlot } from "@app/slots";
import { appSlots } from "@/app-slots";
import { requireAuth } from "@/lib/auth-server";

export default async function OrgDashboardPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const session = await requireAuth();
	const firstName = session.user.name?.trim().split(/\s+/)[0] || null;

	return (
		<div className="space-y-6">
			<DashboardOverview
				firstName={firstName}
				userId={session.user.id}
				orgSlug={slug}
			/>
			{renderSlot(appSlots.dashboard, { orgSlug: slug })}
		</div>
	);
}
