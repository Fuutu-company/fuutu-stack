import { AreaBadge, Badge } from "@fuutu/ui";
import { Ban, CircleCheck, CircleDashed, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

const SUCCESS = "border-transparent bg-success text-success-foreground";
const WARNING = "border-transparent bg-warning text-warning-foreground";

export function RoleBadge({ isAdmin }: { isAdmin: boolean }) {
	const t = useTranslations("admin.users.roleValue");
	return isAdmin ? (
		<AreaBadge area="users">{t("admin")}</AreaBadge>
	) : (
		<Badge variant="outline">{t("user")}</Badge>
	);
}

export function BanBadge({ banned }: { banned: boolean }) {
	const t = useTranslations("admin.users");
	return banned ? (
		<Badge variant="destructive">
			<Ban aria-hidden="true" />
			{t("banned")}
		</Badge>
	) : (
		<Badge className={SUCCESS}>
			<CircleCheck aria-hidden="true" />
			{t("active")}
		</Badge>
	);
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
	const t = useTranslations("admin.users");
	return verified ? (
		<Badge className={SUCCESS}>
			<CircleCheck aria-hidden="true" />
			{t("verified")}
		</Badge>
	) : (
		<Badge className={WARNING}>
			<CircleDashed aria-hidden="true" />
			{t("unverified")}
		</Badge>
	);
}

export function TwoFactorBadge({ enabled }: { enabled: boolean }) {
	const t = useTranslations("admin.users");
	return enabled ? (
		<Badge variant="secondary">
			<ShieldCheck aria-hidden="true" />
			{t("twoFactorOn")}
		</Badge>
	) : (
		<Badge variant="outline">{t("twoFactorOff")}</Badge>
	);
}
