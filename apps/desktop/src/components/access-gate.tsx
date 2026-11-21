"use client";

import { config } from "@fuutu/config";
import { AuthCard, Button } from "@fuutu/ui";
import { useMutation } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import type { PropsWithChildren } from "react";
import { cancelSignIn, DesktopAuthError, signIn } from "@/lib/auth";
import { logError, openExternal } from "@/lib/desktop";
import { useAccount } from "./account-provider";
import { GateScreen } from "./gate-screen";
import { SetupSteps } from "./setup-steps";

const app = config.app.name;

function GateCard({
	title,
	description,
	children,
}: PropsWithChildren<{ title: string; description: string }>) {
	return (
		<GateScreen>
			<AuthCard title={title} description={description}>
				<div className="flex flex-wrap gap-2">{children}</div>
			</AuthCard>
		</GateScreen>
	);
}

/** Sign-in in the system browser (shared by the gate and the account page). */
export function useSignIn() {
	const t = useTranslations("desktop.auth.signIn");
	const { refresh } = useAccount();
	return useMutation({
		mutationFn: () =>
			signIn({
				title: t("callbackTitle", { app }),
				body: t("callbackBody", { app }),
			}),
		onSuccess: () => refresh(),
		onError: (err) => {
			if (!(err instanceof DesktopAuthError && err.kind === "cancelled")) {
				void logError("sign-in failed", err);
			}
		},
	});
}

export function SignInPanel() {
	const t = useTranslations("desktop.auth.signIn");
	const { status } = useAccount();
	const mutation = useSignIn();
	const error = mutation.error;
	const message =
		error instanceof DesktopAuthError
			? error.kind === "cancelled"
				? null
				: error.kind === "timeout"
					? t("timeout")
					: t("failed")
			: null;
	if (!status?.available) {
		return <p className="text-muted-foreground text-sm">{t("unavailable")}</p>;
	}
	return (
		<div className="flex flex-col gap-3">
			{mutation.isPending ? (
				<div className="flex flex-wrap items-center gap-3">
					<p className="text-muted-foreground text-sm" aria-live="polite">
						{t("waiting")}
					</p>
					<Button variant="outline" onClick={() => void cancelSignIn()}>
						{t("cancel")}
					</Button>
				</div>
			) : (
				<Button className="w-full" onClick={() => mutation.mutate()}>
					{t("button")}
				</Button>
			)}
			{message ? (
				<p className="text-destructive text-sm" role="alert">
					{message}
				</p>
			) : null}
		</div>
	);
}

function SignOutButton() {
	const t = useTranslations("desktop.auth.actions");
	const { signOut } = useAccount();
	return (
		<Button variant="ghost" onClick={() => void signOut()}>
			{t("signOut")}
		</Button>
	);
}

function RetryButton() {
	const t = useTranslations("desktop.auth.actions");
	const { refresh } = useAccount();
	return (
		<Button variant="outline" onClick={() => void refresh()}>
			{t("retry")}
		</Button>
	);
}

/**
 * Blocks the app while `desktopConfig.auth` is `required` and the account
 * has no access (sign-in, plan, device limit, licensed major, offline
 * grace). `optional` / `off` never block.
 */
export function AccessGate({ children }: PropsWithChildren) {
	const t = useTranslations("desktop.auth");
	const { decision, session } = useAccount();
	const links = session?.state === "online" ? session.session.links : null;

	if (!decision) {
		return (
			<GateScreen>
				<p
					className="text-center text-muted-foreground text-sm"
					aria-live="polite"
				>
					{t("loading")}
				</p>
			</GateScreen>
		);
	}

	switch (decision.kind) {
		case "open":
		case "granted":
			// Your first-run steps (src/app-setup-steps.tsx), then the app.
			return <SetupSteps decision={decision.kind}>{children}</SetupSteps>;
		case "sign_in":
			// Pre-auth steps stand in front of the sign-in card — never the app.
			return (
				<SetupSteps decision="sign_in">
					<GateScreen>
						<AuthCard
							title={t("signIn.title", { app })}
							description={t("signIn.description", { app })}
						>
							<SignInPanel />
						</AuthCard>
					</GateScreen>
				</SetupSteps>
			);
		case "missing":
			return (
				<GateCard
					title={t("missing.title", { app })}
					description={t("missing.description", { app })}
				>
					{links ? (
						<Button onClick={() => void openExternal(links.billing)}>
							{t("actions.buy")}
						</Button>
					) : null}
					<RetryButton />
					<SignOutButton />
				</GateCard>
			);
		case "device_limit": {
			const devices =
				session?.state === "online" ? session.session.devices : null;
			return (
				<GateCard
					title={t("deviceLimit.title")}
					description={t("deviceLimit.description", {
						count: devices?.count ?? 0,
						limit: devices?.limit ?? 0,
					})}
				>
					{links ? (
						<Button onClick={() => void openExternal(links.devices)}>
							{t("actions.manageDevices")}
						</Button>
					) : null}
					<RetryButton />
					<SignOutButton />
				</GateCard>
			);
		}
		case "upgrade":
			return (
				<GateCard
					title={t("upgrade.title")}
					description={t("upgrade.description", {
						major: decision.licensedMajor,
					})}
				>
					{links ? (
						<Button onClick={() => void openExternal(links.billing)}>
							{t("actions.buy")}
						</Button>
					) : null}
					<RetryButton />
					<SignOutButton />
				</GateCard>
			);
		case "unreachable":
			return (
				<GateCard
					title={t("unreachable.title", { app })}
					description={t("unreachable.description", { app })}
				>
					<RetryButton />
					<SignOutButton />
				</GateCard>
			);
	}
}

/** Offline / trial notice above the page content. */
export function AccessNotice() {
	const t = useTranslations("desktop.auth");
	const formatter = useFormatter();
	const { decision, session } = useAccount();
	if (decision?.kind !== "granted") return null;
	const format = (value: Date) =>
		formatter.dateTime(value, { dateStyle: "medium" });
	let text: string | null = null;
	if (decision.offline && session?.state === "offline") {
		text = t("offlineBanner", {
			date: format(new Date(session.claim.exp * 1000)),
		});
	} else if (decision.trialEndsAt) {
		text = t("trialBanner", { date: format(new Date(decision.trialEndsAt)) });
	}
	if (!text) return null;
	return (
		<p
			role="status"
			className="mx-auto w-full max-w-4xl rounded-xl bg-muted px-4 py-3 text-muted-foreground text-sm"
		>
			{text}
		</p>
	);
}
