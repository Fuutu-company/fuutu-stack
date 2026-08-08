import { requireAuth } from "@/lib/auth-server";
import { OnboardingWizard } from "@/modules/app/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
	const session = await requireAuth();
	return (
		<div className="container mx-auto px-4 py-12 md:py-20">
			<OnboardingWizard
				initialName={session.user.name ?? ""}
				userEmail={session.user.email}
			/>
		</div>
	);
}
