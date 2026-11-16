"use client";

import { authClient } from "@fuutu/auth/client";
import { config } from "@fuutu/config";
import {
	AreaBadge,
	AreaIcon,
	Button,
	Card,
	CardContent,
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	Input,
} from "@fuutu/ui";
import { slugify } from "@fuutu/utils";
import { ArrowRight, Building2, Check, CircleCheck, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { appOnboardingSteps } from "@/app-onboarding";
import { VerifyEmailForInvitations } from "@/modules/auth/components/verify-email-for-invitations";
import { orpc } from "@/utils/orpc";
import { completeOnboardingAction } from "./actions";
import {
	nextOnboardingStep,
	onboardingStepsFor,
	previousOnboardingStep,
	resumeOnboardingStep,
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
	/** Unverified: invitations stay hidden until the email is verified. */
	emailVerified: boolean;
	canCreateOrg: boolean;
	/** Support impersonation: Better Auth refuses `/update-user` (403). */
	impersonating: boolean;
	/**
	 * Forced organizations mode and the user already belongs to an org —
	 * the org step is left out of the flow.
	 */
	hasOrganization: boolean;
}

type SavedProgress = { step: string; orgCreated: boolean };

/** Progress of this tab's run, so a reload resumes instead of restarting. */
function readProgress(key: string): SavedProgress | null {
	try {
		const raw = window.sessionStorage.getItem(key);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null) return null;
		const { step, orgCreated } = parsed as Record<string, unknown>;
		return typeof step === "string"
			? { step, orgCreated: orgCreated === true }
			: null;
	} catch {
		return null;
	}
}

function writeProgress(key: string, progress: SavedProgress | null): void {
	try {
		if (progress) {
			window.sessionStorage.setItem(key, JSON.stringify(progress));
		} else {
			window.sessionStorage.removeItem(key);
		}
	} catch {
		// Storage blocked — the wizard still works, it just starts over.
	}
}

export function OnboardingWizard({
	initialName,
	userEmail,
	pendingInvitations: invitations,
	emailVerified,
	canCreateOrg,
	impersonating,
	hasOrganization,
}: OnboardingWizardProps) {
	const t = useTranslations("onboarding");
	const router = useRouter();
	const orgsEnabled = config.features.organizationsMode !== "off";
	const steps = onboardingStepsFor(
		config.features.organizationsMode,
		hasOrganization,
		appOnboardingSteps,
	);
	const progressKey = `fuutu.onboarding.${userEmail}`;
	const [name, setName] = useState(initialName);
	const [orgName, setOrgName] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Created in this flow — navigating back or forward (or reloading)
	// skips the org step so "Create" can't run a second time.
	const [orgCreated, setOrgCreated] = useState(false);
	const completed = orgCreated ? ["organization"] : [];
	const [step, setStep] = useState<string>(() =>
		resumeOnboardingStep(steps, completed, null),
	);
	// Saving starts on the render after the restore — the first commit
	// still holds the initial step and must not overwrite the saved one.
	const [restored, setRestored] = useState(false);

	// After hydration: pick up where this tab left off.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount
	useEffect(() => {
		const saved = readProgress(progressKey);
		if (saved) {
			const savedCompleted = saved.orgCreated ? ["organization"] : [];
			setOrgCreated(saved.orgCreated);
			setStep(resumeOnboardingStep(steps, savedCompleted, saved.step));
		}
		setRestored(true);
	}, []);

	useEffect(() => {
		if (restored) writeProgress(progressKey, { step, orgCreated });
	}, [restored, progressKey, step, orgCreated]);

	const currentIndex = steps.indexOf(step);
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
				setError(
					res.error.code === "IMPERSONATION_FORBIDDEN"
						? t("profile.impersonating")
						: t("failed"),
				);
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
			writeProgress(progressKey, null);
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
			<div className="space-y-2 text-center">
				<h1 className="break-words font-extrabold font-heading text-3xl leading-tight tracking-heading md:text-4xl">
					{t("title", { appName: config.app.name })}
				</h1>
				<p className="text-muted-foreground">{t("description")}</p>
			</div>
			<ol className="flex flex-wrap items-center justify-center gap-2">
				{steps.map((id, index) =>
					index === currentIndex ? (
						<li key={id}>
							<AreaBadge area="users">
								{t("step", { current: index + 1, total: steps.length })}
							</AreaBadge>
						</li>
					) : (
						<li key={id} aria-hidden="true">
							{index < currentIndex ? (
								<AreaBadge area="users">
									<Check />
								</AreaBadge>
							) : (
								<span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 font-bold text-muted-foreground text-xs tabular-nums">
									{index + 1}
								</span>
							)}
						</li>
					),
				)}
			</ol>
			<Card className="rounded-3xl py-0 shadow-md">
				<CardContent className="p-6 sm:p-8 md:p-9">
					{error && (
						<div className="mb-4 rounded-md bg-destructive/10 p-3 text-destructive text-sm">
							{error}
						</div>
					)}
					{step === "profile" && (
						<FieldGroup>
							<div className="flex items-center gap-3">
								<AreaIcon area="users">
									<User />
								</AreaIcon>
								<div>
									<h2 className="font-bold font-heading">
										{t("profile.heading")}
									</h2>
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
									disabled={impersonating}
									aria-describedby={
										impersonating ? "name-impersonating" : undefined
									}
								/>
								{impersonating && (
									<FieldDescription id="name-impersonating">
										{t("profile.impersonating")}
									</FieldDescription>
								)}
							</Field>
							<Button
								onClick={saveProfile}
								disabled={impersonating || isLoading || !name.trim()}
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
								<h2 className="font-bold font-heading">{t("org.heading")}</h2>
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
							{!emailVerified && (
								<VerifyEmailForInvitations
									email={userEmail}
									callbackPath="/onboarding"
								/>
							)}
							{invitations.length > 0 && (
								<div>
									<p className="mb-2 font-medium text-sm">
										{t("org.pendingInvitations")}
									</p>
									<ul className="divide-y overflow-hidden rounded-xl border">
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
													<span className="font-semibold text-sm underline underline-offset-4">
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
							<h2 className="font-bold font-heading">{t(appStep.titleKey)}</h2>
							<appStep.Component
								key={appStep.id}
								onNext={() => goNext(appStep.id)}
								onBack={() => goBack(appStep.id)}
							/>
						</FieldGroup>
					)}
					{step === "done" && (
						<div className="space-y-6 text-center">
							<div className="flex items-center justify-center text-success">
								<CircleCheck className="size-10" />
							</div>
							<div className="space-y-2">
								<h2 className="font-bold font-heading text-xl tracking-heading">
									{t("done.heading")}
								</h2>
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
