import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `completeOnboardingAction` is a server action — callable directly,
 * skipping every client-only wizard step. The app-owned server hook
 * (`apps/saas/src/app-onboarding.server.ts`) is the place to enforce
 * required app steps; the action must consult it before flipping the flag.
 */

const hook = vi.hoisted(() => ({
	appCanCompleteOnboarding: undefined as
		| ((userId: string) => Promise<boolean>)
		| undefined,
}));
const setOnboardingComplete = vi.hoisted(() => vi.fn());

// `@fuutu/db` by file: the action resolves it from apps/saas, not from here.
vi.mock("../../../db/index.ts", () => ({ setOnboardingComplete }));
vi.mock("@/lib/auth-server", () => ({
	requireAuth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/app-onboarding.server", () => ({
	get appCanCompleteOnboarding() {
		return hook.appCanCompleteOnboarding;
	},
}));

// Through a variable: the action's `@/` imports only resolve inside the
// saas app, so this package's type-check must not follow it.
const ACTIONS = join(
	import.meta.dirname,
	"../../../../apps/saas/src/modules/app/onboarding/actions.ts",
);
const { completeOnboardingAction } = (await import(
	/* @vite-ignore */ ACTIONS
)) as { completeOnboardingAction: () => Promise<{ ok: boolean }> };

beforeEach(() => {
	setOnboardingComplete.mockReset();
	hook.appCanCompleteOnboarding = undefined;
});

describe("completeOnboardingAction", () => {
	it("completes onboarding when the app sets no hook", async () => {
		await expect(completeOnboardingAction()).resolves.toEqual({ ok: true });
		expect(setOnboardingComplete).toHaveBeenCalledWith("user-1");
	});

	it("completes onboarding when the app hook allows it", async () => {
		const check = vi.fn(async () => true);
		hook.appCanCompleteOnboarding = check;
		await expect(completeOnboardingAction()).resolves.toEqual({ ok: true });
		expect(check).toHaveBeenCalledWith("user-1");
		expect(setOnboardingComplete).toHaveBeenCalledWith("user-1");
	});

	it("refuses when the app hook says required steps are missing", async () => {
		hook.appCanCompleteOnboarding = async () => false;
		await expect(completeOnboardingAction()).resolves.toEqual({ ok: false });
		expect(setOnboardingComplete).not.toHaveBeenCalled();
	});
});
