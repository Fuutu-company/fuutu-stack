"use client";

import { authClient } from "@fuutu/auth/client";
import { config } from "@fuutu/config";
import {
	Button,
	Card,
	CardContent,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	Progress,
} from "@fuutu/ui";
import { slugify } from "@fuutu/utils";
import { ArrowRight, Building2, Check, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { appOnboardingSteps } from "@/app-onboarding";
import { orpc } from "@/utils/orpc";
import { completeOnboardingAction } from "./actions";
import {
	buildOnboardingSteps,
	nextOnboardingStep,
	previousOnboardingStep,
} from "./onboarding-steps";

const forcedOrgs = config.features.organizationsMode === "forced";

type PendingInvitation = {
	id: string;
	organizationName: string;
	role: string;
};

interface OnboardingWizardProps {
	initialName: string;
	userEmail: string;
	pendingInvitations: PendingInvitation[];
	canCreateOrg: boolean;
}

export function OnboardingWizard({
	initialName,
	userEmail,
	pendingInvitations: invitations,
	canCreateOrg,
}: OnboardingWizardProps) {
	const t = useTranslations("onboarding");
	const router = useRouter();
	const [step, setStep] = useState<string>("profile");
	const [name, setName] = useState(initialName);
	const [orgName, setOrgName] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Created in this flow — navigating back or forward skips the org step
	// so "Create" can't run a second time.
	const [orgCreated, setOrgCreated] = useState(false);

	const orgsEnabled = config.features.organizationsMode !== "off";
	const steps = buildOnboardingSteps(orgsEnabled, appOnboardingSteps);
	const currentIndex = steps.indexOf(step);
	const progress = ((currentIndex + 1) / steps.length) * 100;
	const completed = orgCreated ? ["organization"] : [];
	const goNext = (from: string) =>
		setStep(nextOnboardingStep(steps, from, completed));
	const goBack = (from: string) =>
		setStep(previousOnboardingStep(steps, from, completed));
	const appStep = steps.includes(step)
		? appOnboardingSteps.find((s) => s.id === step)
		: undefined;

	async function saveProfile() {
		setIsLoading(true);
		setError(null);
		try {
			const res = await authClient.updateUser({ name });
			if (res.error) {
				setError(t("failed"));
				return;
			}
			goNext("profile");
		} catch {
			setError(t("failed"));
		} finally {
			setIsLoading(false);
		}
	}

	async function createOrgAndContinue(skip = false) {
		if (skip || !orgName.trim()) {
			// Forced mode never allows skipping the org step.
			if (forcedOrgs) return;
			goNext("organization");
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			const slug = slugify(orgName);
			await orpc.organizations.create.call({ name: orgName, slug });
			setOrgCreated(true);
			goNext("organization");
		} catch {
			setError(t("failed"));
		} finally {
			setIsLoading(false);
		}
	}

	async function finish() {
		setIsLoading(true);
		try {
			// Forced mode requires real membership before onboarding completes —
			// otherwise requireOrg() bounces the user back anyway.
			if (forcedOrgs) {
				const res = await authClient.organization.list();
				const orgs = Array.isArray(res?.data) ? res.data : [];
				if (orgs.length === 0) {
					setError(t("org.required"));
					setStep(orgsEnabled ? "organization" : "done");
					return;
				}
			}
			const result = await completeOnboardingAction();
			if (!result.ok) {
				setError(t("incomplete"));
				return;
			}
			// Refresh the cached session cookie so the server-side onboarding
			// guard sees onboardingComplete=true immediately (cookie cache TTL
			// would otherwise keep redirecting to /onboarding for minutes).
			await authClient.getSession({
				query: { disableCookieCache: true },
			});
		} finally {
			setIsLoading(false);
		}
		router.push("/dashboard");
		router.refresh();
	}

	return (
		<div className="mx-auto flex w-full max-w-lg flex-col gap-6">
			<div className="space-y-3 text-center">
				<h1 className="font-semibold text-3xl tracking-tight">
					{t("title", { appName: config.app.name })}
				</h1>
				<p className="text-muted-foreground">{t("description")}</p>
			</div>
			<Progress value={progress} />
			<Card className="shadow-xl">
				<CardContent className="p-6 md:p-8">
					{error && (
						<div className="mb-4 rounded-md bg-destructive/10 p-3 text-destructive text-sm">
							{error}
						</div>
					)}
					{step === "profile" && (
						<FieldGroup>
							<div className="flex items-center gap-3">
								<div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
									<User className="size-5" />
								</div>
								<div>
									<h2 className="font-semibold">{t("profile.heading")}</h2>
									<p className="text-muted-foreground text-xs">{userEmail}</p>
								</div>
							</div>
							<Field>
								<FieldLabel htmlFor="name">{t("profile.fullName")}</FieldLabel>
								<Input
									id="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder={t("profile.placeholder")}
									required
								/>
							</Field>
							<Button
								onClick={saveProfile}
								disabled={isLoading || !name.trim()}
								className="w-full"
							>
								{t("profile.continue")}
								<ArrowRight className="ml-2 size-4" />
							</Button>
						</FieldGroup>
					)}
					{step === "organization" && (
						<FieldGroup>
							<div>
								<h2 className="font-semibold">{t("org.heading")}</h2>
								<p className="text-muted-foreground text-sm">
									{canCreateOrg
										? t(
												forcedOrgs
													? "org.forcedDescription"
													: "org.description",
											)
										: t("org.createDisabled")}
								</p>
							</div>
							{canCreateOrg && (
								<Field>
									<FieldLabel htmlFor="org">{t("org.name")}</FieldLabel>
									<Input
										id="org"
										value={orgName}
										onChange={(e) => setOrgName(e.target.value)}
										placeholder={t("org.placeholder")}
									/>
								</Field>
							)}
							{(canCreateOrg || !forcedOrgs) && (
								<div className="flex gap-3">
									{!forcedOrgs && (
										<Button
											variant="outline"
											onClick={() => createOrgAndContinue(true)}
											disabled={isLoading}
											className="flex-1"
										>
											{t("org.skip")}
										</Button>
									)}
									{canCreateOrg && (
										<Button
											onClick={() => createOrgAndContinue(false)}
											disabled={isLoading || !orgName.trim()}
											className="flex-1"
										>
											{t("org.create")}
											<ArrowRight className="ml-2 size-4" />
										</Button>
									)}
								</div>
							)}
							{invitations.length > 0 && (
								<div>
									<p className="mb-2 font-medium text-sm">
										{t("org.pendingInvitations")}
									</p>
									<ul className="divide-y rounded-lg border">
										{invitations.map((inv) => (
											<li key={inv.id}>
												<Link
													href={`/auth/accept-invitation?id=${inv.id}`}
													className="flex items-center justify-between gap-4 p-3 transition-colors hover:bg-accent"
												>
													<span className="flex items-center gap-2 font-medium text-sm">
														<Building2 className="size-4 text-muted-foreground" />
														{inv.organizationName}
													</span>
													<span className="text-primary text-sm">
														{t("org.acceptInvitation")}
													</span>
												</Link>
											</li>
										))}
									</ul>
								</div>
							)}
						</FieldGroup>
					)}
					{appStep && (
						<FieldGroup>
							<h2 className="font-semibold">{t(appStep.titleKey)}</h2>
							<appStep.Component
								key={appStep.id}
								onNext={() => goNext(appStep.id)}
								onBack={() => goBack(appStep.id)}
							/>
						</FieldGroup>
					)}
					{step === "done" && (
						<div className="space-y-6 text-center">
							<div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
								<Check className="size-7" />
							</div>
							<div className="space-y-2">
								<h2 className="font-semibold text-xl">{t("done.heading")}</h2>
								<p className="text-muted-foreground text-sm">
									{t("done.description")}
								</p>
							</div>
							<Button onClick={finish} className="w-full">
								{t("done.cta")}
								<ArrowRight className="ml-2 size-4" />
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
