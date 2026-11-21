"use client";

import { config } from "@fuutu/config";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	Badge,
	Button,
	Label,
	PageHeader,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Monitor } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { SignInPanel } from "@/components/access-gate";
import { useAccount } from "@/components/account-provider";
import { SettingsSection } from "@/components/settings-section";
import { apiFetch } from "@/lib/auth";
import { openExternal } from "@/lib/desktop";

const app = config.app.name;
const PERSONAL = "__personal__";

type Device = { id: string; signedInAt: string; lastActiveAt: string };

/** The user's signed-in installs (`GET /api/desktop/devices`, desktop token). */
function useDevices(enabled: boolean) {
	return useQuery({
		queryKey: ["desktop", "devices"],
		enabled,
		queryFn: async () => {
			const res = await apiFetch<{ devices: Device[] }>("/api/desktop/devices");
			if (res.status !== 200 || !res.data) throw new Error(`${res.status}`);
			return res.data.devices;
		},
	});
}

function BrowserButton({ url, label }: { url: string; label: string }) {
	return (
		<Button variant="outline" size="sm" onClick={() => void openExternal(url)}>
			<ExternalLink className="size-4" />
			{label}
		</Button>
	);
}

/**
 * Account, read from the SaaS app over its API. Changes to the account,
 * plan and billing happen in the SaaS app (opened in the browser).
 */
export default function AccountPage() {
	const t = useTranslations("desktop.account");
	const tAuth = useTranslations("desktop.auth.actions");
	const formatter = useFormatter();
	const { status, session, setOrganizationId, switchFailed, signOut } =
		useAccount();
	const online = session?.state === "online";
	const devices = useDevices(online);
	const date = (value: string) =>
		formatter.dateTime(new Date(value), { dateStyle: "medium" });

	const header = <PageHeader variant="compact" title={t("title")} />;

	if (status?.mode === "off") {
		return (
			<div className="mx-auto w-full max-w-4xl space-y-6">
				{header}
				<SettingsSection title={t("title")} description={t("off")} />
			</div>
		);
	}

	if (
		!session ||
		session.state === "signed_out" ||
		session.state === "unreachable"
	) {
		return (
			<div className="mx-auto w-full max-w-4xl space-y-6">
				{header}
				<SettingsSection
					title={t("signedOut.title")}
					description={t("signedOut.description", { app })}
				>
					<div className="max-w-xs">
						<SignInPanel />
					</div>
				</SettingsSection>
			</div>
		);
	}

	const data = session.session;
	const access = data?.access;

	return (
		<div className="mx-auto w-full max-w-4xl space-y-6">
			{header}
			{!online ? (
				<p
					role="status"
					className="rounded-xl bg-muted px-4 py-3 text-muted-foreground text-sm"
				>
					{t("offline")}
				</p>
			) : null}
			{data ? (
				<>
					<SettingsSection
						title={t("profile.title")}
						description={t("profile.description", { app })}
						actions={
							online ? (
								<BrowserButton
									url={data.links.account}
									label={t("actions.manageAccount")}
								/>
							) : null
						}
					>
						<div className="flex items-center gap-3">
							<Avatar className="size-10 rounded-lg">
								{data.user.image ? (
									<AvatarImage src={data.user.image} alt={data.user.name} />
								) : null}
								<AvatarFallback className="rounded-lg">
									{(data.user.name.trim()[0] ?? "?").toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 text-sm leading-tight">
								<p className="truncate font-semibold">{data.user.name}</p>
								<p className="truncate text-muted-foreground">
									{data.user.email}
								</p>
							</div>
						</div>
						{config.features.organizationsMode !== "off" ? (
							<div className="flex flex-col gap-2">
								<Label htmlFor="organization">{t("organization.label")}</Label>
								<Select
									disabled={!online}
									value={data.organization?.id ?? PERSONAL}
									onValueChange={(value) =>
										setOrganizationId(value === PERSONAL ? null : value)
									}
								>
									<SelectTrigger id="organization" className="w-full sm:w-72">
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
							</div>
						) : null}
					</SettingsSection>
					<SettingsSection
						title={t("plan.title")}
						description={t("plan.description", { app })}
						actions={
							online ? (
								<BrowserButton
									url={data.links.billing}
									label={t("actions.billing")}
								/>
							) : null
						}
					>
						<div className="flex flex-wrap items-center gap-2 text-sm">
							<span className="font-medium">
								{t("plan.tier", { tier: data.plan.tier })}
							</span>
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
										date: access.trialEndsAt ? date(access.trialEndsAt) : "",
									})}
								</Badge>
							) : null}
						</div>
					</SettingsSection>
					<SettingsSection
						title={t("devices.title")}
						description={
							data.devices.limit === null
								? t("plan.devicesUnlimited", { count: data.devices.count })
								: t("plan.devices", {
										count: data.devices.count,
										limit: data.devices.limit,
									})
						}
						actions={
							online ? (
								<BrowserButton
									url={data.links.devices}
									label={t("actions.devices")}
								/>
							) : null
						}
					>
						{devices.data && devices.data.length > 0 ? (
							<ul className="divide-y overflow-hidden rounded-xl border">
								{devices.data.map((device) => (
									<li key={device.id} className="flex items-center gap-3 p-4">
										<Monitor
											className="size-5 shrink-0 text-muted-foreground"
											aria-hidden
										/>
										<div className="space-y-0.5 text-sm">
											<p className="font-medium">
												{t("devices.signedIn", {
													date: date(device.signedInAt),
												})}
											</p>
											<p className="text-muted-foreground text-xs">
												{t("devices.lastActive", {
													date: date(device.lastActiveAt),
												})}
											</p>
										</div>
									</li>
								))}
							</ul>
						) : (
							<p className="text-muted-foreground text-sm">
								{devices.isError
									? t("devices.failed")
									: devices.isPending && online
										? t("devices.loading")
										: t("devices.manageHint", { app })}
							</p>
						)}
					</SettingsSection>
				</>
			) : null}
			<SettingsSection
				title={t("signOut.title")}
				description={t("signOut.description", { app })}
				actions={
					<Button variant="outline" size="sm" onClick={() => void signOut()}>
						{tAuth("signOut")}
					</Button>
				}
			/>
		</div>
	);
}
