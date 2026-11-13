import { ProfileForm } from "@app/settings";
import { authConfig } from "@fuutu/auth/config";
import { mcpOAuth } from "@fuutu/auth/mcp-oauth";
import { paymentsConfig } from "@fuutu/payments/config";
import { getPlanPriceIds } from "@fuutu/payments/config.server";
import { Button, Card, CardContent } from "@fuutu/ui";
import { CreditCard } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CreditBalanceView } from "@/modules/app/credits/credit-balance-view";
import { ChangePasswordForm } from "@/modules/app/settings/components/change-password-form";
import { ConnectedAppsBlock } from "@/modules/app/settings/components/connected-apps-block";
import { DeleteAccountBlock } from "@/modules/app/settings/components/delete-account-block";
import { EmailChangeForm } from "@/modules/app/settings/components/email-change-form";
import { PasskeysBlock } from "@/modules/app/settings/components/passkeys-block";
import { SessionsBlock } from "@/modules/app/settings/components/sessions-block";
import { TwoFactorBlock } from "@/modules/app/settings/components/two-factor-block";
import { UserSettingsBilling } from "@/modules/app/settings/components/user-billing";

const BASE_TABS: readonly string[] = [
	"profile",
	"security",
	"sessions",
	"danger",
];
const ALL_TABS: readonly string[] = [...BASE_TABS, "billing", "credits"];
type Tab = (typeof ALL_TABS)[number];

export default async function SettingsPage({
	searchParams,
}: {
	searchParams: Promise<{ tab?: string }>;
}) {
	const t = await getTranslations("settings");
	const { tab } = await searchParams;
	const showBillingTab = paymentsConfig.billingAttachedTo === "user";
	const showCreditsTab = paymentsConfig.creditsEnabled;
	const validTabs = [
		...BASE_TABS,
		...(showBillingTab ? (["billing"] as const) : []),
		...(showCreditsTab ? (["credits"] as const) : []),
	];
	const activeTab: Tab = validTabs.includes(tab as Tab)
		? (tab as Tab)
		: "profile";

	return (
		<div className="mx-auto max-w-4xl space-y-6">
			<div>
				<h1 className="font-bold text-3xl tracking-tight">{t("title")}</h1>
				<p className="mt-2 text-muted-foreground">{t(`tabs.${activeTab}`)}</p>
			</div>
			<div className="space-y-6">
				{activeTab === "profile" && (
					<div className="space-y-6">
						<Card className="p-6 md:p-8">
							<ProfileForm />
						</Card>
						<Card className="p-6 md:p-8">
							<EmailChangeForm />
						</Card>
					</div>
				)}

				{activeTab === "security" && (
					<div className="space-y-6">
						<Card className="p-6 md:p-8">
							<ChangePasswordForm />
						</Card>
						{authConfig.features.twoFactor && (
							<Card className="p-6 md:p-8">
								<TwoFactorBlock />
							</Card>
						)}
						{authConfig.features.passkeys && (
							<Card className="p-6 md:p-8">
								<PasskeysBlock />
							</Card>
						)}
					</div>
				)}

				{activeTab === "sessions" && (
					<div className="space-y-6">
						<Card className="p-6 md:p-8">
							<SessionsBlock />
						</Card>
						{mcpOAuth.active && (
							<Card className="p-6 md:p-8">
								<ConnectedAppsBlock />
							</Card>
						)}
					</div>
				)}

				{activeTab === "danger" && <DeleteAccountBlock />}

				{showBillingTab && activeTab === "billing" && (
					<div className="space-y-6">
						<Card>
							<CardContent className="space-y-6 p-6 md:p-8">
								<div>
									<h3 className="font-semibold text-lg">
										{t("billing.title")}
									</h3>
									<p className="text-muted-foreground text-sm">
										{t("billing.description")}
									</p>
								</div>
								<div className="flex items-center gap-3 rounded-lg border p-4">
									<CreditCard className="size-5 text-muted-foreground" />
									<div className="flex-1">
										<p className="font-medium text-sm">
											{t("billing.manageHint")}
										</p>
									</div>
								</div>
								<Button asChild>
									<Link href="/choose-plan">{t("billing.upgrade")}</Link>
								</Button>
							</CardContent>
						</Card>
						<UserSettingsBilling priceIds={getPlanPriceIds()} />
					</div>
				)}
				{showCreditsTab && activeTab === "credits" && <CreditBalanceView />}
			</div>
		</div>
	);
}
