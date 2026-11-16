import { Badge } from "@fuutu/ui";
import { useTranslations } from "next-intl";

type PlanSubscription = {
	planId: string | null;
	status: string;
} | null;

/** Plan name with the subscription status; muted text without a subscription. */
export function OrgPlan({
	subscription,
	statusLabel,
}: {
	subscription: PlanSubscription;
	statusLabel: (status: string) => string;
}) {
	const t = useTranslations("admin.organizations");
	const tPlans = useTranslations("payments.plans");
	if (!subscription) {
		return <span className="text-muted-foreground text-xs">{t("noPlan")}</span>;
	}
	const known =
		subscription.planId && tPlans.has(`${subscription.planId}.name`);
	return (
		<span className="flex flex-wrap items-center gap-2">
			<span className="font-medium text-xs">
				{subscription.planId && known
					? tPlans(`${subscription.planId}.name`)
					: t("otherPlan")}
			</span>
			<Badge variant="outline">{statusLabel(subscription.status)}</Badge>
		</span>
	);
}
