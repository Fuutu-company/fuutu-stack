"use client";

import { config } from "@fuutu/config";
import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Label,
	PageHeader,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@fuutu/ui";
import { useFormatter, useTranslations } from "next-intl";
import { SignInPanel } from "@/components/access-gate";
import { useAccount } from "@/components/account-provider";
import { openExternal } from "@/lib/desktop";

const app = config.app.name;
const PERSONAL = "__personal__";

export default function AccountPage() {
	const t = useTranslations("desktop.account");
	const tAuth = useTranslations("desktop.auth.actions");
	const formatter = useFormatter();
	const { status, session, setOrganizationId, switchFailed, signOut } =
		useAccount();

	const header = (
		<PageHeader title={t("title")} description={t("description")} />
	);

	if (status?.mode === "off") {
		return (
			<>
				{header}
				<p className="text-muted-foreground text-sm">{t("off")}</p>
			</>
		);
	}

	if (
		!session ||
		session.state === "signed_out" ||
		session.state === "unreachable"
	) {
		return (
			<>
				{header}
				<Card>
					<CardHeader>
						<CardTitle>{t("signedOut.title")}</CardTitle>
						<CardDescription>
							{t("signedOut.description", { app })}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<SignInPanel />
					</CardContent>
				</Card>
			</>
		);
	}

	const data = session.session;
	const offline = session.state === "offline";
	const access = data?.access;

	return (
		<>
			{header}
			{offline ? (
				<p role="status" className="text-muted-foreground text-sm">
					{t("offline")}
				</p>
			) : null}
			{data ? (
				<>
					<Card>
						<CardHeader>
							<CardTitle>{t("profile")}</CardTitle>
							<CardDescription>
								{data.user.name} · {data.user.email}
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-2">
							<Label htmlFor="organization">{t("organization.label")}</Label>
							<Select
								disabled={offline}
								value={data.organization?.id ?? PERSONAL}
								onValueChange={(value) =>
									setOrganizationId(value === PERSONAL ? null : value)
								}
							>
								<SelectTrigger id="organization" className="w-72">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={PERSONAL}>
										{t("organization.personal")}
									</SelectItem>
									{data.organizations.map((org) => (
										<SelectItem key={org.id} value={org.id}>
											{org.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{switchFailed ? (
								<p className="text-destructive text-sm" role="alert">
									{t("organization.switchFailed")}
								</p>
							) : null}
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>{t("plan.title")}</CardTitle>
							<CardDescription>
								{t("plan.tier", { tier: data.plan.tier })}
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col items-start gap-2 text-sm">
							{access ? (
								<Badge
									variant={
										access.status === "granted" || access.status === "trial"
											? "secondary"
											: "destructive"
									}
								>
									{t(`plan.access.${access.status}`, {
										app,
										date: access.trialEndsAt
											? formatter.dateTime(new Date(access.trialEndsAt), {
													dateStyle: "medium",
												})
											: "",
									})}
								</Badge>
							) : null}
							<p className="text-muted-foreground">
								{data.devices.limit === null
									? t("plan.devicesUnlimited", { count: data.devices.count })
									: t("plan.devices", {
											count: data.devices.count,
											limit: data.devices.limit,
										})}
							</p>
						</CardContent>
					</Card>
				</>
			) : null}
			<div className="flex flex-wrap gap-2">
				{data && !offline ? (
					<>
						<Button
							variant="outline"
							onClick={() => void openExternal(data.links.account)}
						>
							{t("actions.manageAccount")}
						</Button>
						<Button
							variant="outline"
							onClick={() => void openExternal(data.links.billing)}
						>
							{t("actions.billing")}
						</Button>
						<Button
							variant="outline"
							onClick={() => void openExternal(data.links.devices)}
						>
							{t("actions.devices")}
						</Button>
					</>
				) : null}
				<Button variant="ghost" onClick={() => void signOut()}>
					{tAuth("signOut")}
				</Button>
			</div>
		</>
	);
}
